
import requests
import sys

BASE_URL = "http://127.0.0.1:8000/api/v1"
USERNAME = "admin"
PASSWORD = "admin_password" # Assumed default, will try common ones if fails

def log(msg, success=True):
    icon = "✅" if success else "❌"
    print(f"{icon} {msg}")

def verify_backend():
    session = requests.Session()
    
    print(f"--- Starting Backend API Verification against {BASE_URL} ---")
    
    # 1. Test Login (Auth)
    try:
        login_payload = {"username": USERNAME, "password": "admin123"} # Correct default
        resp = session.post(f"{BASE_URL}/auth/login", json=login_payload)
        
        if resp.status_code != 200:
             # Last resort
             print(f"Login Failed with: {resp.text}")
             return
             
        if resp.status_code != 200:
            log(f"Login failed: {resp.status_code} - {resp.text}", False)
            return
        
        token = resp.json().get("access_token")
        if not token:
            log("Login succeeded but no token returned", False)
            return
            
        session.headers.update({"Authorization": f"Bearer {token}"})
        log(f"Login successful as '{USERNAME}'")
        
    except Exception as e:
        log(f"Login connection error: {e}", False)
        return

    # 2. Test Admin Projects (The one we fixed)
    try:
        resp = session.get(f"{BASE_URL}/admin/projects")
        if resp.status_code == 200:
            projects = resp.json()
            # Verify system project exists
            system_proj = next((p for p in projects if p.get("student_code") == "SYSTEM"), None)
            if system_proj:
                log(f"Admin Projects OK. Found 'Hydrosim Portal'. Status: {system_proj.get('latest_deploy_status')}")
            else:
                log("Admin Projects OK, but 'Hydrosim Portal' NOT found in list.", False)
        else:
            log(f"Admin Projects Failed: {resp.status_code} - {resp.text}", False)
    except Exception as e:
        log(f"Admin Projects Request Error: {e}", False)

    # 3. Test Deployments List
    try:
        resp = session.get(f"{BASE_URL}/deploy/resources/list")
        if resp.status_code == 200:
            log(f"Deployments List OK. Count: {len(resp.json())}")
        else:
            log(f"Deployments List Failed: {resp.status_code} - {resp.text}", False)
    except Exception as e:
        log(f"Deployments Request Error: {e}", False)

    # 4. Test Students List
    try:
        resp = session.get(f"{BASE_URL}/students/")
        if resp.status_code == 200:
            log(f"Students List OK. Count: {len(resp.json())}")
        else:
            log(f"Students List Failed: {resp.status_code} - {resp.text}", False)
    except Exception as e:
        log(f"Students Request Error: {e}", False)
        
    print("\n--- Verification Complete ---")

if __name__ == "__main__":
    verify_backend()
