from __future__ import annotations

import os
import httpx
from typing import List


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-lite")
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"


def _make_payload(parts: List[str]):
    return {
        "contents": [
            {
                "parts": [{"text": text} for text in parts if text],
            }
        ]
    }


def generate_message(parts: List[str]) -> str:
    if not GEMINI_API_KEY:
        return "(Mode offline) Tetap semangat! Susun target kecil mingguan dan lanjutkan progresmu."

    def _call_model(model_name: str):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
        with httpx.Client(timeout=20) as client:
            resp = client.post(f"{url}?key={GEMINI_API_KEY}", json=_make_payload(parts))
            resp.raise_for_status()
            return resp.json()

    def _extract_text(data: dict) -> str | None:
        candidates = data.get("candidates") or []
        if candidates:
            parts_list = candidates[0].get("content", {}).get("parts", [])
            if parts_list:
                return parts_list[0].get("text")
        return None

    # Urutan model: env -> fallback 1.5 -> offline teks pendek
    models_to_try = [GEMINI_MODEL, "gemini-1.5-flash"]

    for model_name in models_to_try:
        try:
            data = _call_model(model_name)
            text = _extract_text(data)
            if text:
                return text
        except httpx.HTTPStatusError:
            continue
        except Exception:
            continue

    return "(Layanan motivasi tidak tersedia) Tetap semangat dan lanjutkan belajar dengan langkah kecil."
