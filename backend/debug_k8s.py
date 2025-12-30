
import sys
import os

# Add backend directory to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir))
sys.path.append(backend_dir)

print(f"Backend dir: {backend_dir}")

try:
    from app.services.deployment_monitor import get_deployment_status, NAMESPACE_MAP
    print("Successfully imported deployment_monitor")
    
    print(f"Namespace Map: {NAMESPACE_MAP}")
    
    print("Testing get_deployment_status for platform...")
    status = get_deployment_status("system", "platform")
    print(f"Result: {status}")

except Exception as e:
    print(f"CRITICAL ERROR: {e}")
    import traceback
    traceback.print_exc()
