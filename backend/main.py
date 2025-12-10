from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Learning Buddy API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5175", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/chat")
def chat(req: ChatRequest):
    text = req.message.strip()
    reply = f"Kamu berkata: {text}. Aku akan bantu menyiapkan saran belajar."
    return {"reply": reply}

# -------- Data endpoints (membaca .xlsx lokal) --------
from typing import Optional, List
from fastapi import Query
from .services.data_loader import load_excel_as_records
from .db import init_db, get_conn, execute, query
from .auth import create_user, find_user, verify_password, issue_token, get_email_from_token
from pathlib import Path


# Inisialisasi DB saat start
init_db()


@app.get("/data/lp_course_mapping")
def lp_course_mapping(sheet: Optional[str] = Query(default=None)):
    filename = "LP and Course Mapping.xlsx"
    return {"filename": filename, "sheet": sheet, "rows": load_excel_as_records(filename, sheet)}


@app.get("/data/resource_data")
def resource_data(sheet: Optional[str] = Query(default=None)):
    filename = "Resource Data Learning Buddy.xlsx"
    return {"filename": filename, "sheet": sheet, "rows": load_excel_as_records(filename, sheet)}

# Jalankan: uvicorn backend.main:app --reload --port 8000

# Mount routers
from .routes.recommend import router as recommend_router
from .routes.assessment import router as assessment_router
from .routes.ml_advanced import router as ml_router, get_strategy_generator, get_roadmap_generator, get_course_recommender
from .routes.ml_simple import router as ml_simple_router
from .routes.progress import router as progress_router, build_progress_text
# from .routes.ml_advanced import router as ml_advanced_router  # ✨ BARU
from .ml.simple_nlp import recommend_by_query, extract_skills
from .llm.gemini_client import generate_message
import logging

app.include_router(recommend_router)
app.include_router(assessment_router)
app.include_router(ml_simple_router)
app.include_router(ml_router)
app.include_router(progress_router)
# app.include_router(ml_advanced_router)  # ✨ BARU

logger = logging.getLogger(__name__)


# -------- Auth endpoints --------
class RegisterReq(BaseModel):
    name: str
    email: str
    password: str


class LoginReq(BaseModel):
    email: str
    password: str


@app.post("/auth/register")
def register(req: RegisterReq):
    if find_user(req.email):
        raise HTTPException(400, "Email sudah terdaftar")
    create_user(req.name, req.email, req.password)
    token = issue_token(req.email)
    return {"token": token, "email": req.email, "name": req.name}


@app.post("/auth/login")
def login(req: LoginReq):
    user = find_user(req.email)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Email atau password salah")
    token = issue_token(req.email)
    return {"token": token, "email": req.email, "name": user["name"]}


def user_from_auth(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Token tidak ditemukan")
    token = authorization.split(" ", 1)[1]
    email = get_email_from_token(token)
    if not email:
        raise HTTPException(401, "Token tidak valid")
    return email


# -------- Onboarding --------
class OnboardingReq(BaseModel):
    role: Optional[str] = None
    experience: Optional[str] = None
    goal: Optional[str] = None


@app.post("/onboarding")
def save_onboarding(req: OnboardingReq, email: str = Depends(user_from_auth)):
    conn = get_conn()
    execute(
        conn,
        "INSERT INTO onboarding(email,role,experience,goal) VALUES(?,?,?,?)",
        (email, req.role, req.experience, req.goal),
    )
    conn.close()
    return {"status": "ok"}


@app.get("/onboarding/last")
def get_onboarding_latest(email: str = Depends(user_from_auth)):
    info = get_latest_onboarding(email)
    if not info:
        raise HTTPException(404, "Belum ada data onboarding")
    return info


# -------- Conversations --------
class NewConvReq(BaseModel):
    title: Optional[str] = None


@app.post("/conversations")
def create_conversation(req: NewConvReq, email: str = Depends(user_from_auth)):
    conn = get_conn()
    title = req.title or "Obrolan baru"
    cid = execute(conn, "INSERT INTO conversations(user_email,title) VALUES(?,?)", (email, title))
    conn.close()
    return {"id": cid, "title": title}


@app.delete("/conversations/{cid}")
def delete_conversation(cid: int, email: str = Depends(user_from_auth)):
    conn = get_conn()
    rows = query(conn, "SELECT user_email FROM conversations WHERE id=?", (cid,))
    if not rows or rows[0]["user_email"] != email:
        conn.close()
        raise HTTPException(404, "Percakapan tidak ditemukan")
    execute(conn, "DELETE FROM messages WHERE conversation_id=?", (cid,))
    execute(conn, "DELETE FROM conversations WHERE id=?", (cid,))
    conn.close()
    return {"status": "deleted"}


@app.get("/conversations")
def list_conversations(email: str = Depends(user_from_auth)):
    conn = get_conn()
    rows = query(conn, "SELECT id,title,created_at FROM conversations WHERE user_email=? ORDER BY id DESC", (email,))
    conn.close()
    return [dict(r) for r in rows]


@app.get("/conversations/{cid}/messages")
def get_messages(cid: int, email: str = Depends(user_from_auth)):
    conn = get_conn()
    # verifikasi kepemilikan
    rows = query(conn, "SELECT user_email FROM conversations WHERE id=?", (cid,))
    if not rows or rows[0]["user_email"] != email:
        conn.close()
        raise HTTPException(404, "Percakapan tidak ditemukan")
    msgs = query(conn, "SELECT role,text,created_at FROM messages WHERE conversation_id=? ORDER BY id ASC", (cid,))
    conn.close()
    return [dict(m) for m in msgs]


class NewMessageReq(BaseModel):
    text: str


async def bot_reply(text: str, email: str) -> str:
    """Prioritas: ML advanced (learning strategy/recommender). Fallback: Gemini, lalu rekomendasi lokal ringkas."""
    info = get_latest_onboarding(email) or {}
    goal = info.get("goal") or "-"
    role = info.get("role") or "-"
    experience = info.get("experience") or "-"
    persona = f"Role: {role}, Level: {experience}, Goal: {goal}"
    progress_summary = build_progress_text(email)
    lower_text = text.lower()

    def clean_val(v):
        try:
            import math
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                return "-"
        except Exception:
            pass
        if v is None:
            return "-"
        s = str(v).strip()
        return "-" if s.lower() in ("nan", "none", "") else s

    # 0) Intent rekomendasi kursus (SentenceTransformer)
    if any(k in lower_text for k in ["rekomendasi", "kelas", "course"]):
        try:
            recommender = get_course_recommender()
            results = recommender.recommend(
                user_input=text,
                user_level=experience if experience != "-" else None,
                top_k=5
            )
            df = results if hasattr(results, "to_dict") else None
            items = df.to_dict("records") if df is not None else []
            lines = []
            for idx, item in enumerate(items[:5], start=1):
                name = clean_val(item.get("course_name") or item.get("name") or "Kursus Dicoding")
                level = clean_val(item.get("course_level") or item.get("level") or "")
                lines.append(f"{idx}. {name}{f' ({level})' if level and level != '-' else ''}")
            body = "\n".join(lines) if lines else "- Belum ada rekomendasi."
            return (
                "Rekomendasi kursus (ML advanced):\n"
                f"Persona: {persona}\n"
                f"{body}\n"
                "Next: pilih satu, klik Mulai di Dashboard, rekam progres."
            )
        except Exception:
            logger.exception("Course recommender failed")

    # 1) Coba generator strategi (ML advanced)
    try:
        roadmap_gen = get_roadmap_generator()
        strategy_gen = get_strategy_generator()
        result = strategy_gen.generate_from_query(
            query=text,
            roadmap_generator=roadmap_gen,
            goal=goal if goal != "-" else None,
            top_n=5
        )
        next_skills = result.get("next_skills") or []
        strategy_text = result.get("strategy") or ""
        details = result.get("next_skills_details") or []

        if isinstance(strategy_text, str):
            lowered = strategy_text.lower()
            # Jika Gemini menolak (403/leaked) atau generator mengirim pesan error, jatuhkan ke fallback
            if "error generating" in lowered or "403" in lowered or "api key" in lowered:
                raise RuntimeError(strategy_text)

        detail_lines = []
        for idx, item in enumerate(details[:5], start=1):
            skill_name = clean_val(item.get("skill") or f"Skill {idx}")
            score = item.get("score", "")
            detail_lines.append(f"{idx}. {skill_name}{f' (score {score:.2f})' if isinstance(score, (int,float)) else ''}")

        numbered_strategy = []
        for i, line in enumerate((strategy_text or "").split("\n"), start=1):
            line = line.strip()
            if line:
                numbered_strategy.append(f"{i}. {line}")
        return (
            "Rencana belajar (ML Advanced):\n"
            f"Persona: {persona}\n"
            f"Next skills:\n"
            + ("\n".join(f"{i+1}. {s}" for i, s in enumerate(next_skills)) if next_skills else "-\n")
            + ("\nDetail:\n" + "\n".join(detail_lines) + "\n" if detail_lines else "")
            + ("Strategi:\n" + "\n".join(numbered_strategy) if numbered_strategy else (strategy_text or ""))
        )
    except Exception:
        logger.exception("ML advanced strategy failed")

    # 2) Coba Gemini (jika tersedia)
    prompt_intro = (
        "Kamu adalah Learning Buddy, asisten belajar Dicoding. "
        "Jawablah singkat (maks 3 paragraf), beri langkah praktis & rekomendasi kursus relevan. "
        "Jika data terbatas, jelaskan apa yang perlu pengguna lengkapi."
    )
    prompt = [
        prompt_intro,
        f"Persona pengguna: {persona}",
        f"Ringkasan progres: {progress_summary}",
        f"Pertanyaan terbaru: {text}",
    ]
    try:
        return generate_message(prompt)
    except Exception:
        logger.exception("Gemini failed")

    # 3) Fallback lokal sederhana
    skills = extract_skills(text, limit=5)
    items = recommend_by_query(text, limit=5)
    rec_lines = []
    for idx, item in enumerate(items, start=1):
        name = clean_val(item.get("course_name") or item.get("name") or item.get("title") or "Kursus Dicoding")
        level = clean_val(item.get("course_level") or item.get("level") or item.get("category") or "")
        rec_lines.append(f"{idx}. {name}{f' ({level})' if level and level != '-' else ''}")
    skill_line = f"Topik terdeteksi: {', '.join(skills)}" if skills else "Topik belum terdeteksi, sebutkan skill/tujuan."
    rekom = "\n".join(rec_lines) if rec_lines else "- Belum ada rekomendasi, sebutkan kursus/skill yang dicari."
    return (
        "Mode offline (tanpa Gemini):\n"
        f"{skill_line}\n"
        f"Rekomendasi lokal:\n{rekom}\n"
        "Next: pilih kursus, klik Mulai, dan rekam progres di Dashboard."
    )


@app.post("/conversations/{cid}/messages")
async def post_message(cid: int, req: NewMessageReq, email: str = Depends(user_from_auth)):
    conn = get_conn()
    # verifikasi
    rows = query(conn, "SELECT user_email FROM conversations WHERE id=?", (cid,))
    if not rows or rows[0]["user_email"] != email:
        conn.close()
        raise HTTPException(404, "Percakapan tidak ditemukan")

    execute(conn, "INSERT INTO messages(conversation_id,role,text) VALUES(?,?,?)", (cid, "user", req.text))
    # update judul percakapan jika masih default
    conv_rows = query(conn, "SELECT title FROM conversations WHERE id=?", (cid,))
    if conv_rows:
        current_title = conv_rows[0]["title"] or ""
        snippet = req.text.strip()[:40]
        if current_title.lower().startswith("obrolan baru") and snippet:
            execute(conn, "UPDATE conversations SET title=? WHERE id=?", (snippet, cid))
    reply = await bot_reply(req.text, email)
    execute(conn, "INSERT INTO messages(conversation_id,role,text) VALUES(?,?,?)", (cid, "bot", reply))
    conn.close()
    return {"reply": reply}


def get_latest_onboarding(email: str):
    conn = get_conn()
    rows = query(
        conn,
        "SELECT role, experience, goal FROM onboarding WHERE email=? ORDER BY id DESC LIMIT 1",
        (email,),
    )
    conn.close()
    if rows:
        return dict(rows[0])
    return None
