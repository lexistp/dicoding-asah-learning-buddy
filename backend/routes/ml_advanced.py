from __future__ import annotations

import numpy as np
import math
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

from ..auth import user_from_auth
from ..db import get_conn, execute, query
from ..services.data_loader import load_excel_as_records
from ..ml.job_detector import detect_job_role, detect_skills
from ..ml.assessment_engine import prepare_assessment, calculate_level
from ..ml.course_recommender import CourseRecommender
from ..ml.student_progress import HybridLearningRecommender
from ..ml.roadmap_generator import RoadmapGenerator
from ..ml.learning_strategy import LearningStrategyGenerator
import os

import pandas as pd


router = APIRouter(prefix="/ml-advanced", tags=["ml-advanced"])

# HELPER: Sanitize untuk JSON Serialization
def sanitize_for_json(obj):
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(item) for item in obj]
    elif isinstance(obj, (np.floating, np.integer)):
        if np.isnan(obj) or np.isinf(obj):
            return 0.0
        return float(obj)
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return 0.0
        return obj
    elif isinstance(obj, np.ndarray):
        return sanitize_for_json(obj.tolist())
    elif pd.isna(obj):
        return None
    return obj

# JOB ROLE & SKILL DETECTION
class JobDetectionReq(BaseModel):
    description: str
    top_k: int = Field(default=6, ge=1, le=20)


@router.post("/detect_job_and_skills")
def api_detect_job_and_skills(req: JobDetectionReq):
    try:
        lp_data = load_excel_as_records("LP and Course Mapping.xlsx", "Learning Path")
        lp_df = pd.DataFrame(lp_data)
        job_roles = lp_df['learning_path_name'].dropna().unique().tolist()
        
        skill_data = load_excel_as_records("Resource Data Learning Buddy.xlsx", "Skill Keywords")
        skill_df = pd.DataFrame(skill_data)
        valid_keywords = skill_df['keyword'].dropna().tolist()
    except Exception as e:
        raise HTTPException(500, f"Failed to load datasets: {e}")
    
    try:
        job_role = detect_job_role(req.description, job_roles)
        skills = detect_skills(req.description, job_role, valid_keywords, top_k=req.top_k)
    except Exception as e:
        raise HTTPException(500, f"Detection failed: {e}")
    
    return {
        "job_role": job_role,
        "skills": skills
    }

# ASSESSMENT GENERATION
class AssessmentReq(BaseModel):
    subskills: List[str]
    total_questions: int = Field(default=18, ge=6, le=36)


@router.post("/generate_assessment")
def api_generate_assessment(req: AssessmentReq):
    try:
        tech_qs_df = pd.DataFrame(
            load_excel_as_records("Resource Data Learning Buddy.xlsx", "Current Tech Questions")
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to load tech questions: {e}")
    
    assessment = prepare_assessment(req.subskills, tech_qs_df, total_questions=req.total_questions)
    
    return {
        "assessment": assessment,
        "total_questions": sum(len(v) for v in assessment.values())
    }


class SubmitAssessmentReq(BaseModel):
    assessment_id: Optional[str] = None
    answers: Dict[str, List[str]]


@router.post("/submit_assessment")
def api_submit_assessment(req: SubmitAssessmentReq, email: str = Depends(user_from_auth)):
    results = {}
    for subskill, answers in req.answers.items():
        correct = int(len(answers) * 0.5)
        total = len(answers)
        level = calculate_level(correct, total)
        
        results[subskill] = {
            "correct": correct,
            "total": total,
            "score": int((correct / total) * 100),
            "level": level
        }
    
    conn = get_conn()
    for subskill, res in results.items():
        execute(
            conn,
            "INSERT INTO subskill_scores(email,role,subskill,score,level) VALUES(?,?,?,?,?)",
            (email, "Unknown", subskill, res["score"], res["level"])
        )
    conn.close()
    
    return {
        "status": "ok",
        "results": results
    }

# COURSE RECOMMENDATION (Sentence Transformer)
class CourseRecommendReq(BaseModel):
    user_input: str
    user_level: Optional[str] = None
    top_k: int = Field(default=10, ge=1, le=50)


_course_recommender = None


def get_course_recommender() -> CourseRecommender:
    global _course_recommender
    if _course_recommender is None:
        _course_recommender = CourseRecommender()
        
        try:
            lp_answer_df = pd.DataFrame(
                load_excel_as_records("Resource Data Learning Buddy.xlsx", "Learning Path Answer")
            )
            course_df = pd.DataFrame(
                load_excel_as_records("LP and Course Mapping.xlsx", "Course")
            )
            
            _course_recommender.prepare_courses(lp_answer_df, course_df)
            
            if not _course_recommender.load_embeddings():
                _course_recommender.build_embeddings(save=True)
        
        except Exception as e:
            print(f"Failed to initialize CourseRecommender: {e}")
    
    return _course_recommender


@router.post("/recommend_courses_st")
def api_recommend_courses_st(req: CourseRecommendReq):
    recommender = get_course_recommender()
    
    try:
        results = recommender.recommend(
            user_input=req.user_input,
            user_level=req.user_level,
            top_k=req.top_k
        )
        
        # Convert DataFrame to dict
        courses_dict = results.to_dict('records')
        
        # FIX: Sanitize untuk JSON serialization
        courses_clean = sanitize_for_json(courses_dict)
        
        return {
            "courses": courses_clean
        }
    except Exception as e:
        import traceback
        print(f"Recommendation error: {e}")
        print(traceback.format_exc())
        raise HTTPException(500, f"Recommendation failed: {str(e)}")


# PROGRESS TRACKING BY EMAIL
_hybrid_recommender = None

def get_hybrid_recommender() -> HybridLearningRecommender:
    global _hybrid_recommender
    
    if _hybrid_recommender is None:
        _hybrid_recommender = HybridLearningRecommender()
        
        try:
            print("Loading datasets for progress tracking...")
            lp_answer = pd.DataFrame(
                load_excel_as_records("Resource Data Learning Buddy.xlsx", "Learning Path Answer")
            )
            course = pd.DataFrame(
                load_excel_as_records("LP and Course Mapping.xlsx", "Course")
            )
            stud_progress = pd.DataFrame(
                load_excel_as_records("Resource Data Learning Buddy.xlsx", "Student Progress")
            )
            tutorials = pd.DataFrame(
                load_excel_as_records("LP and Course Mapping.xlsx", "Tutorials")
            )
            
            print("Preparing data...")
            course_features, stud_metrics, course_data = _hybrid_recommender.prepare_data(
                lp_answer, course, stud_progress, tutorials
            )
            
            print("Building models...")
            _hybrid_recommender.build_content_based_model(course_features)
            model, train_acc, test_acc = _hybrid_recommender.build_classification_model(stud_metrics)
            
            print(f"Training Accuracy: {train_acc*100:.2f}%")
            print(f"Testing Accuracy: {test_acc*100:.2f}%")
            
            _hybrid_recommender._course_features = course_features
            _hybrid_recommender._stud_metrics = stud_metrics
            _hybrid_recommender._course_data = course_data
            _hybrid_recommender._train_acc = train_acc
            _hybrid_recommender._test_acc = test_acc
            
            print("HybridLearningRecommender initialized!")
        
        except Exception as e:
            print(f"Failed to initialize: {e}")
            raise
    
    return _hybrid_recommender


class ProgressEmailReq(BaseModel):
    email: str


@router.post("/progress_by_email")
def api_progress_by_email(req: ProgressEmailReq):
    recommender = get_hybrid_recommender()
    
    stud_metrics = recommender._stud_metrics
    course_features = recommender._course_features
    course_data = recommender._course_data
    
    if req.email not in stud_metrics['email'].values:
        raise HTTPException(404, f"Email '{req.email}' not found in dataset")
    
    strategy = recommender.generate_learning_strategy(
        req.email, stud_metrics, course_features, course_data
    )
    
    # Response
    response = {
        "student_name": strategy['student_name'],
        "email": strategy['email'],
        "current_course": strategy['current_course'],
        "completion_rate": f"{strategy['completion_rate']:.1f}%",
        "exam_score": f"{strategy['exam_score']:.0f}/100",
        "submission_rating": f"{strategy['submission_rating']:.1f}/5",
        "success_probability": f"{strategy['success_probability']*100:.1f}%",
        "overall_status": strategy['adaptive_roadmap']['current_status']['overall_status'],
        "recommended_courses": strategy['recommended_courses'],
        "next_steps": strategy['adaptive_roadmap']['next_steps'],
        "estimated_completion": strategy['adaptive_roadmap']['estimated_completion'],
        "insights": strategy['adaptive_roadmap']['insights']
    }
    
    return sanitize_for_json(response)


@router.get("/all_students_progress")
def api_all_students():
    recommender = get_hybrid_recommender()
    
    stud_metrics = recommender._stud_metrics
    course_features = recommender._course_features
    course_data = recommender._course_data
    
    all_students = []
    
    for email in stud_metrics['email'].unique():
        strategy = recommender.generate_learning_strategy(
            email, stud_metrics, course_features, course_data
        )
        
        all_students.append({
            "student_name": strategy['student_name'],
            "email": strategy['email'],
            "current_course": strategy['current_course'],
            "completion_rate": strategy['completion_rate'],
            "exam_score": strategy['exam_score'],
            "submission_rating": strategy['submission_rating'],
            "success_probability": strategy['success_probability'],
            "overall_status": strategy['adaptive_roadmap']['current_status']['overall_status']
        })
    
    response = {
        "total_students": len(all_students),
        "model_accuracy": {
            "train": f"{recommender._train_acc*100:.2f}%",
            "test": f"{recommender._test_acc*100:.2f}%"
        },
        "students": all_students
    }
    
    return sanitize_for_json(response)

# ROADMAP GENERATOR
_roadmap_generator = None


def get_roadmap_generator() -> RoadmapGenerator:
    global _roadmap_generator
    
    if _roadmap_generator is None:
        _roadmap_generator = RoadmapGenerator()
        
        try:
            print("Loading skill data for roadmap...")
            skill_df = pd.read_csv("Skill.csv")
            
            _roadmap_generator.load_data(skill_df)
            _roadmap_generator.train_model()
            
            print("Roadmap generator initialized!")
        
        except Exception as e:
            print(f"Failed to initialize roadmap generator: {e}")
            raise
    
    return _roadmap_generator


class RoadmapQueryReq(BaseModel):
    query: str
    top_n: int = Field(default=5, ge=1, le=10)


@router.post("/predict_next_skills")
def api_predict_next_skills(req: RoadmapQueryReq):
    generator = get_roadmap_generator()
    
    try:
        result = generator.predict_next_skills(req.query, top_n=req.top_n)
        
        if result.empty:
            return {
                "query": req.query,
                "recommendations": [],
                "message": "No recommendations found"
            }
        
        recommendations = result.to_dict('records')
        
        return {
            "query": req.query,
            "recommendations": sanitize_for_json(recommendations)
        }
    
    except Exception as e:
        raise HTTPException(500, f"Prediction failed: {e}")

# LEARNING STRATEGY GENERATOR
_strategy_generator = None

def get_strategy_generator() -> LearningStrategyGenerator:
    global _strategy_generator
    
    if _strategy_generator is None:
        GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
        
        try:
            print("Initializing Learning Strategy Generator")
            _strategy_generator = LearningStrategyGenerator(
                api_key=GEMINI_API_KEY,
                resources_path="data.json"
            )
            print("Learning Strategy Generator initialized!")
        
        except Exception as e:
            print(f"Failed to initialize strategy generator: {e}")
            raise
    
    return _strategy_generator


class LearningStrategyReq(BaseModel):
    query: str
    goal: Optional[str] = None
    top_n: int = Field(default=5, ge=1, le=10)


@router.post("/generate_learning_strategy")
def api_generate_learning_strategy(req: LearningStrategyReq):
    """
    Example Request:
    {
      "query": "sehabis CSS, apa lagi yang harus dipelajari untuk jadi front-end developer?",
      "goal": "Menjadi Front-End Developer profesional",
      "top_n": 5
    }
    
    Response:
    {
      "query": "...",
      "next_skills": ["JavaScript", "React", ...],
      "next_skills_details": [...],
      "strategy": "Yuk naikin skill kamu! ..."
    }
    """
    roadmap_gen = get_roadmap_generator()
    strategy_gen = get_strategy_generator()
    
    try:
        result = strategy_gen.generate_from_query(
            query=req.query,
            roadmap_generator=roadmap_gen,
            goal=req.goal,
            top_n=req.top_n
        )
        
        return sanitize_for_json(result)
    
    except Exception as e:
        raise HTTPException(500, f"Strategy generation failed: {e}")


class DirectStrategyReq(BaseModel):
    next_skills: List[str]
    goal: Optional[str] = None


@router.post("/generate_strategy_direct")
def api_generate_strategy_direct(req: DirectStrategyReq):
    """
    Example Request:
    {
      "next_skills": ["JavaScript", "React", "TypeScript"],
      "goal": "Menjadi Full-Stack Developer"
    }
    """
    strategy_gen = get_strategy_generator()
    roadmap_gen = get_roadmap_generator()
    
    # Set dataframe for level detection
    if strategy_gen.df is None and roadmap_gen.df is not None:
        strategy_gen.df = roadmap_gen.df
    
    try:
        strategy = strategy_gen.generate_actionable_learning_strategy(
            next_skills=req.next_skills,
            goal=req.goal
        )
        
        response = {
            "next_skills": req.next_skills,
            "goal": req.goal,
            "strategy": strategy
        }
        
        return sanitize_for_json(response)
    
    except Exception as e:
        raise HTTPException(500, f"Strategy generation failed: {e}")
