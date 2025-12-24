import os

# Files to check for BOM
files_to_check = [
    "package.json", 
    "vite.config.ts", 
    "tsconfig.json", 
    "postcss.config.mjs"
]

def remove_bom(filepath):
    try:
        if not os.path.exists(filepath):
            return
            
        with open(filepath, 'rb') as f:
            content = f.read()
            
        # Check for UTF-8 BOM
        if content.startswith(b'\xef\xbb\xbf'):
            print(f"[FIXING] Found BOM in {filepath}. Removing...")
            new_content = content[3:]
            with open(filepath, 'wb') as f:
                f.write(new_content)
            print(f"[SUCCESS] Cleaned {filepath}")
        else:
            print(f"[OK] {filepath} is clean")
            
    except Exception as e:
        print(f"[ERROR] processing {filepath}: {e}")

if __name__ == "__main__":
    print("Scanning for Byte Order Marks (BOM)...")
    cwd = os.getcwd()
    print(f"Working directory: {cwd}")
    
    for filename in files_to_check:
        remove_bom(filename)
