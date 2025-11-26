from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

from ..ml.simple_nlp import extract_skills, recommend_by_query


router = APIRouter(prefix="/ml", tags=["ml-lite"])


class ExtractReq(BaseModel):
    text: str


@router.post("/extract_skills")
def api_extract_skills(req: ExtractReq):
    skills = extract_skills(req.text)
    return {"skills": [{"name": n, "score": s} for n, s in skills]}


class RecoReq(BaseModel):
    query: str
    limit: int = 10


@router.post("/recommend_by_query")
def api_recommend_by_query(req: RecoReq):
    try:
        items = recommend_by_query(req.query, limit=req.limit)
        return {"items": items[: req.limit]}
    except Exception as e:
        raise HTTPException(500, str(e))

