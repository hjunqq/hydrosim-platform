import os
import sqlite3
from pathlib import Path

from fastapi import FastAPI

DATA_DIR = os.getenv("DATA_DIR", "/data")
DB_FILE = os.getenv("DB_FILE") or str(Path(DATA_DIR) / "app.db")

app = FastAPI()


def init_db() -> None:
    Path(DATA_DIR).mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_FILE)
    try:
        cur = conn.cursor()
        cur.execute(
            "CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT)"
        )
        conn.commit()
    finally:
        conn.close()


@app.on_event("startup")
async def startup_event():
    init_db()


@app.get("/")
def read_root():
    return {"status": "ok", "db": DB_FILE}
