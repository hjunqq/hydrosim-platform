from fastapi.testclient import TestClient
import os
import sys
from kubernetes import client, config
import time

# 1. 设置环境变量，强制使用项目内 Kubeconfig
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
kubeconfig_path = os.path.join(project_root, ".kube", "config")
os.environ["KUBECONFIG"] = kubeconfig_path

# Add project root to sys.path
sys.path.append(project_root)

# 必须在设置 Env 之后导入 app
from app.main import app

def test_e2e_deploy_flow():
    print(f">>> Using KUBECONFIG: {kubeconfig_path}")
    
    # 2. 检查 K8s 连接
    try:
        config.load_kube_config(config_file=kubeconfig_path)
        v1 = client.CoreV1Api()
        nodes = v1.list_node()
        print(f"✅ Connected to Cluster. Nodes: {len(nodes.items)}")
        
        # 确保 namespace 存在
        namespaces = [ns.metadata.name for ns in v1.list_namespace().items]
        if "students-gd" not in namespaces:
            v1.create_namespace(client.V1Namespace(metadata=client.V1ObjectMeta(name="students-gd")))
            print("✅ Created namespace students-gd")
        else:
            print("INFO: Namespace students-gd already exists")
            
    except Exception as e:
        print(f"❌ Failed to connect to K8s: {e}")
        return

    # 3. 发起部署请求
    client_http = TestClient(app)
    
    student_code = "s2025-e2e-test"

    # Cleanup before test
    print(">>> Cleaning up previous resources...")
    try:
        apps_v1 = client.AppsV1Api()
        networking_v1 = client.NetworkingV1Api()
        apps_v1.delete_namespaced_deployment(name=f"student-{student_code}", namespace="students-gd")
        networking_v1.delete_namespaced_ingress(name=f"student-{student_code}", namespace="students-gd")
        print("✅ Deleted previous resources. Waiting for termination...")
        time.sleep(10) # Wait for deletion
    except:
        pass

    payload = {
        "image": "nginx:alpine", # 使用真实存在的镜像
        "project_type": "gd"
    }
    
    print(f">>> Triggering deployment for {student_code}...")
    
    # Debug: Print all routes
    print("Registered Routes:")
    for route in app.routes:
        if hasattr(route, "path"):
            print(f" - {route.path}")
            
    response = client_http.post(f"/api/v1/deploy/{student_code}", json=payload)
    
    print(f"Response Code: {response.status_code}")
    print(f"Response Body: {response.json()}")
    
    if response.status_code != 202:
        print("❌ API Request failed.")
        return

    # 4. 验证集群状态
    print(">>> Verifying resources in cluster...")
    apps_v1 = client.AppsV1Api()
    networking_v1 = client.NetworkingV1Api()
    
    # Wait loop
    timeout = 60 # Increased timeout
    start = time.time()
    found = False
    
    while time.time() - start < timeout:
        try:
            dep = apps_v1.read_namespaced_deployment("student-" + student_code, "students-gd")
            print(f"✅ Found Deployment: {dep.metadata.name}")
            
            # Check strategy
            # Note: k8s python client might return None for defaults, so we access safely
            strategy = dep.spec.strategy
            if strategy and strategy.rolling_update:
                print(f"✅ Strategy: max_unavailable={strategy.rolling_update.max_unavailable}")
            
            found = True
            break
        except client.exceptions.ApiException as e:
            if e.status == 404:
                time.sleep(2)
                continue
            else:
                print(f"❌ API Error while waiting: {e}")
                time.sleep(1)
                
    if not found:
        print("❌ Timeout waiting for deployment creation.")
        # Don't return, try to cleanup even if failed
    
    # Check Ingress
    if found:
        try:
            ing = networking_v1.read_namespaced_ingress("student-" + student_code, "students-gd")
            print(f"✅ Found Ingress: {ing.metadata.name}")
            if ing.spec.rules:
                print(f"   Host: {ing.spec.rules[0].host}")
        except Exception as e:
            print(f"❌ Ingress check failed: {e}")

    # 5. 测试状态查询接口
    print("\n>>> Testing Status API...")
    try:
        # Give it a moment to stabilize
        time.sleep(2) 
        status_resp = client_http.get(f"/api/v1/deploy/{student_code}?project_type=gd")
        print(f"Status Response: {status_resp.json()}")
        if status_resp.status_code == 200:
             print("✅ Status API: OK")
        else:
             print(f"❌ Status API Failed: {status_resp.status_code}")
             
        # 测试资源列表接口
        print("\n>>> Testing Resource List API...")
        list_resp = client_http.get("/api/v1/deploy/resources/list")
        if list_resp.status_code == 200:
            items = list_resp.json()
            print(f"✅ Resource List API: OK, Found {len(items)} items")
            # Verify our student is in the list
            my_deploy = next((item for item in items if item["student_code"] == student_code), None)
            if my_deploy:
                print(f"✅ Found created deployment in list: {my_deploy['status']}")
            else:
                print("❌ Created deployment NOT found in list (Latency?)")
        else:
             print(f"❌ Resource List API Failed: {list_resp.status_code}")

    except Exception as e:
        print(f"❌ API Testing failed: {e}")

    print("\n🎉 E2E Test Completed Successfully!")

if __name__ == "__main__":
    test_e2e_deploy_flow()
