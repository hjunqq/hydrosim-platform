import urllib.request
import urllib.parse
import urllib.error
import json
import sys

BASE_URL = "http://localhost:8000/api/v1"

def post_json(url, data):
    req = urllib.request.Request(url)
    req.add_header('Content-Type', 'application/json')
    jsondata = json.dumps(data).encode('utf-8')
    req.add_header('Content-Length', len(jsondata))
    return urllib.request.urlopen(req, jsondata)

def get_json(url, token):
    req = urllib.request.Request(url)
    req.add_header('Authorization', f'Bearer {token}')
    return urllib.request.urlopen(req)

def test_student_flow():
    # 1. Login
    print("Attempting to login as student...")
    login_data = {
        "username": "student",
        "password": "student123"
    }
    
    try:
        with post_json(f"{BASE_URL}/auth/login/", login_data) as response:
            if response.status != 200:
                print(f"Login failed: {response.status}")
                return False
            data = json.loads(response.read().decode())
            token = data.get("access_token")
            if not token:
                print("No access token in response.")
                return False
            print("Login successful. Token received.")
    except urllib.error.HTTPError as e:
        print(f"Login HTTP Error: {e.code} - {e.read().decode()}")
        return False
    except urllib.error.URLError as e:
        print(f"Login Connection Error: {e.reason}")
        return False

    # 2. Get My Project
    print("\nAttempting to fetch /projects/me/ ...")
    try:
        with get_json(f"{BASE_URL}/projects/me/", token) as response:
            if response.status == 200:
                print("Success! /projects/me/ returned 200.")
                print(response.read().decode())
            else:
                 print(f"Failed to fetch /projects/me/: {response.status}")
                 return False
    except urllib.error.HTTPError as e:
         print(f"Project HTTP Error: {e.code} - {e.read().decode()}")
         return False

    # 3. List Students
    print("\nAttempting to check /students/ ...")
    try:
        with get_json(f"{BASE_URL}/students/", token) as response:
            if response.status == 200:
                print("Success! /students/ returned 200.")
                students = json.loads(response.read().decode())
                print(f"Found {len(students)} student(s).")
            else:
                 print(f"Failed to fetch /students/: {response.status}")
                 return False
    except urllib.error.HTTPError as e:
         print(f"Students List HTTP Error: {e.code} - {e.read().decode()}")
         return False

    return True

if __name__ == "__main__":
    success = test_student_flow()
    if success:
        print("\nStudent verification PASSED.")
        sys.exit(0)
    else:
        print("\nStudent verification FAILED.")
        sys.exit(1)
