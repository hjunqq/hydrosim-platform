import sys
import os

# Add current dir to path
sys.path.append(os.getcwd())

try:
    from app.main import app
    print("SUCCESS: Successfully imported app.main")
except Exception as e:
    print(f"FAILURE: {e}")
    # Print traceback
    import traceback
    traceback.print_exc()
