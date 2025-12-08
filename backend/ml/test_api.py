import requests

BASE_URL = "http://localhost:8000"

# Test 1: Health Check
response = requests.get(f"{BASE_URL}/health")
print("Health Check:", response.json())

# Test 2: Register
response = requests.post(
    f"{BASE_URL}/auth/register",
    json={
        "name": "Test User",
        "email": "test@example.com",
        "password": "password123"
    }
)
print("Register:", response.json())
token = response.json()["token"]

# Test 3: Protected Endpoint
headers = {"Authorization": f"Bearer {token}"}
response = requests.post(
    f"{BASE_URL}/onboarding",
    headers=headers,
    json={
        "role": "Frontend Developer",
        "experience": "Beginner",
        "goal": "Belajar React"
    }
)
print("Onboarding:", response.json())

# Test 4: ML Extract Skills
response = requests.post(
    f"{BASE_URL}/ml/extract_skills",
    json={"text": "React Python Machine Learning"}
)
print("Extract Skills:", response.json())