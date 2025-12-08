from __future__ import annotations

from pathlib import Path
from typing import List, Dict, Any

import pandas as pd
from rapidfuzz import fuzz, process

from backend.services.data_loader import load_excel_as_records

SKILL_CSV = Path(__file__).parent / "Skill.csv"

_SKILLS: List[str] | None = None
_COURSES: List[Dict[str, Any]] | None = None


def _load_skills() -> List[str]:
    """Load unique skill keywords from the bundled CSV once."""
    global _SKILLS
    if _SKILLS is not None:
        return _SKILLS

    if SKILL_CSV.exists():
        try:
            df = pd.read_csv(SKILL_CSV)
            _SKILLS = sorted(set(df["skill"].dropna().astype(str)))
        except Exception:
            _SKILLS = []
    else:
        _SKILLS = []
    return _SKILLS


def extract_skills(text: str, limit: int = 6) -> List[str]:
    skills = _load_skills()
    if not text or not skills:
        return []
    matches = process.extract(
        text,
        skills,
        scorer=fuzz.partial_ratio,
        limit=limit,
        score_cutoff=60,
    )
    return [m[0] for m in matches]


def _level_name(raw_level: Any) -> str:
    try:
        lvl = int(raw_level)
    except (TypeError, ValueError):
        return "Unknown"
    if lvl <= 2:
        return "Beginner"
    if lvl == 3:
        return "Intermediate"
    if lvl >= 4:
        return "Advanced"
    return "Unknown"


def _load_courses() -> List[Dict[str, Any]]:
    """Read course data from the Excel mapping file lazily."""
    global _COURSES
    if _COURSES is not None:
        return _COURSES

    try:
        rows = load_excel_as_records("LP and Course Mapping.xlsx", "Course")
    except Exception as exc:
        print(f"[simple_nlp] gagal memuat data course: {exc}")
        rows = []

    courses: List[Dict[str, Any]] = []
    for r in rows:
        name = str(r.get("course_name") or "").strip()
        if not name:
            continue
        courses.append(
            {
                "course_id": r.get("course_id"),
                "course_name": name,
                "learning_path_id": r.get("learning_path_id"),
                "course_level": _level_name(r.get("course_level_str")),
            }
        )
    _COURSES = courses
    return _COURSES


def recommend_by_query(query: str, limit: int = 6) -> List[Dict[str, Any]]:
    courses = _load_courses()
    if not query or not courses:
        return []

    matches = process.extract(
        query,
        [c["course_name"] for c in courses],
        scorer=fuzz.token_sort_ratio,
        limit=limit,
    )
    results: List[Dict[str, Any]] = []
    for _, score, idx in matches:
        course = dict(courses[idx])
        course["score"] = float(score)
        results.append(course)
    return results
