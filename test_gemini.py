import os
import httpx

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyCsZFdR6MajP4O7E1HzROFK3xM35F17_0M")
GEMINI_MODEL = "gemini-2.0-flash-lite"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

print("Testing Gemini API Key")
print(f"API Key: {GEMINI_API_KEY[:20]}...")
print(f"Model: {GEMINI_MODEL}\n")

try:
    with httpx.Client(timeout=20) as client:
        resp = client.post(
            f"{API_URL}?key={GEMINI_API_KEY}",
            json={
                "contents": [{
                    "parts": [{"text": "Hello, respond with just 'OK'"}]
                }]
            }
        )
        
        print(f"Status Code: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    text = parts[0].get("text", "")
                    print(f"Response: {text}")
                    print("\nGemini API Working!")
                else:
                    print("No text in response")
            else:
                print("No candidates in response")
        else:
            print(f"Error: {resp.text}")
            
except Exception as e:
    print(f"Exception: {e}")
