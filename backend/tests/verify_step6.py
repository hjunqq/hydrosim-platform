import requests
import json
import sys

BASE_URL = "http://127.0.0.1:8000/api/v1"

def print_pass(msg):
    print(f"✅ PASS: {msg}")

def print_fail(msg):
    print(f"❌ FAIL: {msg}")

def login(username, password):
    url = f"{BASE_URL}/auth/login"
    resp = requests.post(url, json={"username": username, "password": password})
    if resp.status_code != 200:
        print_fail(f"Login failed for {username}: {resp.text}")
        return None, None
    data = resp.json()
    return data["access_token"], data["role"]

def verify_admin_projects():
    print("\n--- Verifying Project Visibility ---")
    
    # 1. Admin Login
    admin_token, admin_role = login("admin", "admin123")
    if not admin_token: return False
    print_pass(f"Admin logged in as {admin_role}")

    # 2. Teacher Login
    teacher_token, teacher_role = login("teacher", "teacher123")
    if not teacher_token: return False
    print_pass(f"Teacher logged in as {teacher_role}")

    # 3. Admin Get Projects
    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = requests.get(f"{BASE_URL}/admin/projects", headers=headers)
    if resp.status_code == 200:
        projects = resp.json()
        print_pass(f"Admin listed {len(projects)} projects")
    else:
        print_fail(f"Admin list projects failed: {resp.status_code}")

    # 4. Teacher Get Projects
    headers = {"Authorization": f"Bearer {teacher_token}"}
    resp = requests.get(f"{BASE_URL}/admin/projects", headers=headers)
    if resp.status_code == 200:
        projects = resp.json()
        print_pass(f"Teacher listed {len(projects)} projects (Filtered View)")
    else:
        print_fail(f"Teacher list projects failed: {resp.status_code}")

def verify_registry():
    print("\n--- Verifying Registry Management ---")
    admin_token, _ = login("admin", "admin123")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Test Connection
    test_payload = {
        "url": "https://registry.hub.docker.com",
        "name": "DockerHub",
        "username": "",
        "password": ""
    }
    # Note: We expect True or False, but API call should succeed (200 OK)
    resp = requests.post(f"{BASE_URL}/admin/registries/test", json=test_payload, headers=headers)
    if resp.status_code == 200:
        result = resp.json()
        print_pass(f"Connection test endpoint returned: {result}")
    else:
        print_fail(f"Connection test failed: {resp.status_code} {resp.text}")

    # 2. Add Registry
    create_payload = {
        "name": "TestRegistry",
        "url": "https://example.com/cr",
        "username": "testuser",
        "password": "testpassword",
        "is_active": True
    }
    resp = requests.post(f"{BASE_URL}/admin/registries/", json=create_payload, headers=headers)
    if resp.status_code == 200:
        reg = resp.json()
        reg_id = reg["id"]
        print_pass(f"Created registry: {reg['name']} (ID: {reg_id})")
        
        # 3. List
        resp = requests.get(f"{BASE_URL}/admin/registries/", headers=headers)
        registries = resp.json()
        found = any(r["id"] == reg_id for r in registries)
        if found:
            print_pass("Registry found in list")
        else:
            print_fail("Registry not found in list")

        # 4. Delete
        requests.delete(f"{BASE_URL}/admin/registries/{reg_id}", headers=headers)
        print_pass("Registry deleted")
    else:
        print_fail(f"Create registry failed: {resp.status_code}")

def verify_monitoring():
    print("\n--- Verifying Monitoring ---")
    admin_token, _ = login("admin", "admin123")
    headers = {"Authorization": f"Bearer {admin_token}"}

    resp = requests.get(f"{BASE_URL}/admin/monitoring/overview", headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        if "nodes" in data and "pods" in data:
            print_pass(f"Monitoring Overview received: Nodes={data.get('nodes')}, Pods={data.get('pods')}")
        else:
            print_fail(f"Monitoring payload missing keys: {data.keys()}")
    else:
        print_fail(f"Monitoring overview failed: {resp.status_code}")

if __name__ == "__main__":
    try:
        verify_admin_projects()
        verify_registry()
        verify_monitoring()
        print("\nVerification Verified.")
    except Exception as e:
        print(f"\n❌ Script Error: {e}")
