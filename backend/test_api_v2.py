
import urllib.request
import urllib.error
import json

BASE_URL = "http://localhost:8000/api/v1"

def request(url, method="GET", data=None, headers=None):
    if headers is None:
        headers = {}
    
    if data:
        data_bytes = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    else:
        data_bytes = None
    
    req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            status = response.getcode()
            body = response.read().decode('utf-8')
            try:
                json_body = json.loads(body)
            except:
                json_body = body
            return status, json_body
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8')
    except Exception as e:
        return 999, str(e)

def test_connection():
    print("Testing Backend Connection...")
    
    # 1. Health
    status, body = request("http://localhost:8000/health")
    print(f"Health: {status} {body}")
    
    if status != 200:
        return

    # 2. Login
    print("Testing Login...")
    login_data = {"username": "teacher", "password": "changeme"}
    status, body = request(f"{BASE_URL}/auth/login", method="POST", data=login_data)
    print(f"Login: {status}")
    
    if status != 200:
        print(f"Login Body: {body}")
        return

    token = body['access_token']
    print("Got Token.")

    # 3. List Students
    print("Testing List Students...")
    headers = {"Authorization": f"Bearer {token}"}
    status, body = request(f"{BASE_URL}/students", headers=headers)
    print(f"List Students: {status}")
    if status == 200:
        print(f"Count: {len(body)}")
    else:
        print(f"Error: {body}")

if __name__ == "__main__":
    test_connection()
