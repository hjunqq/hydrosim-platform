
import requests
import json
import sys

BASE_URL = "http://localhost:8000/api/v1"

def test_connection():
    try:
        # 1. Health check (via main app, not api router usually)
        # Check main.py: app.get("/health")
        resp = requests.get("http://localhost:8000/health")
        print(f"Health Check: {resp.status_code} {resp.json()}")
    except Exception as e:
        print(f"Health Check Failed: {e}")
        return

    # 2. Login
    login_data = {
        "username": "teacher",
        "password": "changeme"
    }
    try:
        # Note: Backend auth endpoint might expect JSON body as per previous check
        resp = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        print(f"Login Status: {resp.status_code}")
        if resp.status_code != 200:
            print(f"Login Failed: {resp.text}")
            return
        
        token_data = resp.json()
        token = token_data['access_token']
        print(f"Got Token: {token[:10]}...")
        
        # 3. List Students
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/students", headers=headers)
        print(f"List Students Status: {resp.status_code}")
        if resp.status_code == 200:
            students = resp.json()
            print(f"Found {len(students)} students")
            if len(students) > 0:
                print(f"First student: {students[0]}")
        else:
            print(f"List Students Failed: {resp.text}")

    except Exception as e:
        print(f"API Test Failed: {e}")

if __name__ == "__main__":
    test_connection()
