from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.ml.simple_nlp import extract_skills, recommend_by_query


router = APIRouter(prefix="/ml", tags=["ml"])


class ExtractReq(BaseModel):
    text: str
    limit: int = Field(default=6, ge=1, le=50)


@router.post("/extract_skills")
def api_extract_skills(req: ExtractReq):
    return {"skills": extract_skills(req.text, limit=req.limit)}


class RecommendReq(BaseModel):
    query: str
    limit: int = Field(default=6, ge=1, le=50)


@router.post("/recommend_by_query")
def api_recommend_by_query(req: RecommendReq):
    return {"courses": recommend_by_query(req.query, limit=req.limit)}
