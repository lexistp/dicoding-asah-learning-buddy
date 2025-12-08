import sys
import os

# Setup environment
os.environ['GEMINI_API_KEY'] = 'AIzaSyC9IZj0_dZ8nSVwjm6FGo1urmnaZQdJViM'
os.environ['GEMINI_MODEL'] = 'gemini-2.0-flash-lite'

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

import pandas as pd
from backend.services.data_loader import load_excel_as_records
from backend.ml.job_detector import detect_job_role, detect_skills
from backend.ml.assessment_engine import prepare_assessment, run_assessment, aggregate_user_level_majority
from backend.ml.course_recommender import CourseRecommender

# Load data 
print("\nLoading datasets")
try:
    # Learning Path data
    learning_path_data = load_excel_as_records("LP and Course Mapping.xlsx", "Learning Path")
    learning_path = pd.DataFrame(learning_path_data)
    
    # Skill Keywords data
    skill_keywords_data = load_excel_as_records("Resource Data Learning Buddy.xlsx", "Skill Keywords")
    skill_keywords = pd.DataFrame(skill_keywords_data)
    
    # Tech Questions data (untuk assessment)
    tech_qs_data = load_excel_as_records("Resource Data Learning Buddy.xlsx", "Current Tech Questions")
    tech_qs = pd.DataFrame(tech_qs_data)
    
    # Learning Path Answer & Course (untuk course recommendation)
    lp_answer_data = load_excel_as_records("Resource Data Learning Buddy.xlsx", "Learning Path Answer")
    lp_answer = pd.DataFrame(lp_answer_data)
    
    course_data = load_excel_as_records("LP and Course Mapping.xlsx", "Course")
    course = pd.DataFrame(course_data)
    
    print(f"Loaded {len(learning_path)} learning paths")
    print(f"Loaded {len(skill_keywords)} skill keywords")
    print(f"Loaded {len(tech_qs)} tech questions")
    print(f"Loaded {len(course)} courses")
    
except Exception as e:
    print(f"Failed to load data: {e}")
    sys.exit(1)

# Ambil job_role dari dataset 
job_role = learning_path['learning_path_name'].dropna().unique().tolist()

# Initialize Course Recommender
print("\nInitializing Course Recommender...")
recommender = CourseRecommender()
recommender.load_data(lp_answer, course)

print("\nML Models ready!")
print(f"Available job roles: {len(job_role)}")

# Interactive loop
while True:
    print("\nFULL ASSESSMENT FLOW")
    
    # STEP 1: INPUT USER
    user_input = input("\nMasukkan deskripsi Anda (atau 'exit' untuk keluar): ").strip()
    
    if user_input.lower() == 'exit':
        print("\nGoodbye!")
        break
    
    if not user_input:
        print("Input tidak boleh kosong!")
        continue
    
    # STEP 2: DETECT JOB ROLE
    print("\nDetecting job role...")
    try:
        job_role_detected = detect_job_role(user_input, job_role)
        print(f"Job Role: {job_role_detected}")
        
    except Exception as e:
        print(f"Error detecting job role: {e}")
        continue
    
    # STEP 3: DETECT SKILLS
    print("\nDetecting skills...")
    try:
        skills_detected = detect_skills(user_input, job_role_detected, skill_keywords, top_k=6)
        print(f"Skills detected:")
        for i, skill in enumerate(skills_detected, 1):
            print(f"   {i}. {skill}")
        
    except Exception as e:
        print(f"Error detecting skills: {e}")
        continue
    
    # STEP 4: PILIH JUMLAH PERTANYAAN
    print("\n" + "="*80)
    print("ASSESSMENT SETUP")
    print("="*80)
    
    while True:
        try:
            total_q = input("\nPilih total pertanyaan (18 atau 36): ").strip()
            total_q = int(total_q)
            if total_q in [18, 36]:
                break
            else:
                print("Pilih 18 atau 36!")
        except ValueError:
            print("Masukkan angka!")
    
    # STEP 5: PREPARE ASSESSMENT
    print(f"\nPreparing {total_q} questions...")
    try:
        assessment = prepare_assessment(skills_detected, tech_qs, total_questions=total_q)
        print(f"Assessment ready!")
        
        # Show summary
        total_prepared = sum(len(v) for v in assessment.values())
        print(f"Total questions: {total_prepared}")
        for skill, questions in assessment.items():
            print(f"   • {skill}: {len(questions)} questions")
        
    except Exception as e:
        print(f"Error preparing assessment: {e}")
        continue
    
    # STEP 6: RUN ASSESSMENT
    print("\n" + "="*80)
    print("MULAI ASSESSMENT")
    print("="*80)
    
    input("\nTekan Enter untuk memulai...")
    
    try:
        results = run_assessment(assessment)
        
    except KeyboardInterrupt:
        print("\nAssessment dibatalkan!")
        continue
    except Exception as e:
        print(f"\nError running assessment: {e}")
        continue
    
    # STEP 7: SHOW RESULTS
    print("\n" + "="*80)
    print("HASIL ASSESSMENT")
    print("="*80)
    
    for skill, res in results.items():
        score_pct = (res['correct'] / res['total']) * 100
        print(f"\n{skill}:")
        print(f"   Benar: {res['correct']}/{res['total']} ({score_pct:.1f}%)")
        print(f"   Level: {res['level']}")
    
    # Overall summary
    total_correct = sum(r['correct'] for r in results.values())
    total_all = sum(r['total'] for r in results.values())
    overall_pct = (total_correct / total_all) * 100
    
    print(f"\n{'='*80}")
    print(f"OVERALL: {total_correct}/{total_all} benar ({overall_pct:.1f}%)")
    print(f"{'='*80}")
    
    # STEP 8: AGGREGATE LEVEL (MAJORITY VOTING)
    final_level = aggregate_user_level_majority(results)
    print(f"\nLevel User Berdasarkan Assessment: {final_level}")
    
    # STEP 9: COURSE RECOMMENDATION
    print("\n" + "="*80)
    print("REKOMENDASI COURSE")
    print("="*80)
    
    print(f"\nMencari course untuk:")
    print(f"   Job Role: {job_role_detected}")
    print(f"   Level: {final_level}")
    
    try:
        recommended_courses = recommender.recommend(
            user_input=job_role_detected,
            user_level=final_level,
            top_k=5
        )
        
        if len(recommended_courses) > 0:
            print(f"\nMenemukan {len(recommended_courses)} rekomendasi:\n")
            
            for i, (idx, row) in enumerate(recommended_courses.iterrows(), 1):
                print(f"{i}. {row['course_name']}")
                print(f"   Level: {row['course_level']}")
                print(f"   Path: {row['learning_path']}")
                
                # Summary jika ada
                if 'summary' in row and pd.notna(row['summary']) and row['summary'] != '':
                    summary_text = str(row['summary'])[:100] + "..." if len(str(row['summary'])) > 100 else str(row['summary'])
                    print(f"   Summary: {summary_text}")
                
                # Price jika ada
                if 'course_price' in row and pd.notna(row['course_price']) and row['course_price'] != '':
                    try:
                        price_value = float(row['course_price'])
                        if price_value > 0:
                            print(f"   Price: Rp {price_value:,.0f}")
                        else:
                            print(f"   Price: FREE")
                    except (ValueError, TypeError):
                        print(f"   Price: {row['course_price']}")
                
                print()
        else:
            print("\nTidak ada course yang cocok dengan kriteria")
            
    except Exception as e:
        print(f"Error recommending courses: {e}")
        import traceback
        traceback.print_exc()
    
    # Ask untuk test lagi
    print("\n")
    test_again = input("Test lagi? (y/n): ").strip().lower()
    if test_again != 'y':
        print("\nGoodbye!")
        break