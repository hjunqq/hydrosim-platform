import sys
import os

# Add project root to path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, ".."))
sys.path.append(project_root)

from app.main import app

print("Registered Routes:")
for route in app.routes:
    if hasattr(route, "path"):
        print(f" - {route.path} [{','.join(route.methods)}]")
