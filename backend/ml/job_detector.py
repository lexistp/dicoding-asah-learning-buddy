from __future__ import annotations

import os
import re
from typing import List
from difflib import get_close_matches
import pandas as pd

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False
    httpx = None


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-lite")
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

# DETECT JOB ROLE 
def detect_job_role(user_input: str, job_role: List[str]) -> str:
    if not GEMINI_API_KEY:
        raise ValueError(
            "GEMINI_API_KEY tidak ditemukan!\n"
            "Buat file .env dan isi: GEMINI_API_KEY=your-key-here"
        )
    
    # PROMPT 
    prompt = f"""
    Anda adalah asisten pintar yang bertugas untuk mengklasifikasikan deskripsi pengguna ke job role yang paling tepat.

    Petunjuk:
    1. Analisis deskripsi pengguna secara menyeluruh.
    2. Bandingkan dengan daftar job role berikut, pilih yang paling relevan.
    3. Hanya pilih **satu job role** yang paling cocok.
    4. Jawaban **hanya berupa nama job role**, tanpa penjelasan, tanda kutip, atau teks tambahan.
    5. Jika tidak yakin, pilih job role yang paling mendekati, jangan buat job role baru.

    Job role valid:
    {job_role}

    Deskripsi pengguna:
    "{user_input}"
    """
    
    with httpx.Client(timeout=30) as client:
        resp = client.post(
            f"{API_URL}?key={GEMINI_API_KEY}",
            json={"contents": [{"parts": [{"text": prompt}]}]}
        )
        resp.raise_for_status()
        data = resp.json()
    
    candidates = data.get("candidates", [])
    if not candidates:
        raise Exception("Gemini tidak return candidates!")
    
    parts = candidates[0].get("content", {}).get("parts", [])
    if not parts:
        raise Exception("Gemini tidak return parts!")
    
    result = parts[0].get("text", "").strip()
    
    # Clean
    result = result.replace('"', '').replace("'", "").strip()
    
    print(f"Job Role detected: {result}")
    return result

# DETECT SKILLS 
def detect_skills(user_input: str, job_role: str, skill_keywords, top_k: int = 6) -> List[str]:
    if not GEMINI_API_KEY:
        raise ValueError(
            "GEMINI_API_KEY tidak ditemukan!\n"
            "Buat file .env dan isi: GEMINI_API_KEY=your-key-here"
        )
    
    # PROMPT 
    prompt = f"""
    Anda adalah AI pakar dalam technical skill assessment untuk berbagai job role IT.

    ATURAN SUPER KETAT:
    1. Hanya ambil skill dari dataset berikut: {skill_keywords}.
    2. Skill harus sesuai job role (bahasa pemrograman, framework, library, library/framework cloud, library/framework yang relevan dengan AI/ML.)
    3. DILARANG: skill generik, teori, platform software/cloud, metodologi, tools non-teknis/desain, version control, platform dan library yang tidak relevan dengan job role.
    4. Untuk job role Gen AI Engineer menggunakan skill yang sama seperti AI Engineer.
    5. Output HARUS EXACT {top_k} skill, pisah koma, tanpa penjelasan.
    Job Role: {job_role}
    User Input: {user_input}

    Output:
    """
    
    # Call Gemini
    with httpx.Client(timeout=30) as client:
        resp = client.post(
            f"{API_URL}?key={GEMINI_API_KEY}",
            json={"contents": [{"parts": [{"text": prompt}]}]}
        )
        resp.raise_for_status()
        data = resp.json()
    
    candidates = data.get("candidates", [])
    if not candidates:
        raise Exception("Gemini tidak return candidates!")
    
    parts = candidates[0].get("content", {}).get("parts", [])
    if not parts:
        raise Exception("Gemini tidak return parts!")
    
    raw_text = parts[0].get("text", "")
    raw_items = [s.strip() for s in raw_text.replace("\n", "").split(",") if s.strip()]
    
    # Ambil skill yang valid dari dataset saja 
    valid_keywords = skill_keywords['keyword'].dropna().tolist()
    filtered = []
    
    for item in raw_items:
        match = get_close_matches(item, valid_keywords, n=1, cutoff=0.6)
        if match and match[0] not in filtered:
            filtered.append(match[0])
    
    # Jika kurang dari top_k, isi dengan skill lain dari dataset 
    if len(filtered) < top_k:
        remaining = [k for k in valid_keywords if k not in filtered]
        filtered.extend(remaining[:top_k - len(filtered)])
    
    print(f"Skills detected: {filtered[:top_k]}")
    return filtered[:top_k]