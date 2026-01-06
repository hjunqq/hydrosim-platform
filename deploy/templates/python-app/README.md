# Python App Template (PVC-ready)

This template reads persistent paths from the platform-injected env vars:

- DATA_DIR: /data
- DB_FILE: /data/app.db

Recommended usage in your code:

```
import os
from pathlib import Path

DATA_DIR = os.getenv("DATA_DIR", "/data")
DB_FILE = os.getenv("DB_FILE") or str(Path(DATA_DIR) / "app.db")
```

If you use SQLite or file storage, always write inside DATA_DIR.
