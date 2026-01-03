import os
import sys
import time
from typing import Any, Dict, Optional, Tuple

import httpx


def _bool_env(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


BASE_URL = os.environ.get("PORTAL_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
API_BASE = f"{BASE_URL}/api/v1"

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

STUDENT_USERNAME = os.environ.get("STUDENT_USERNAME")
STUDENT_PASSWORD = os.environ.get("STUDENT_PASSWORD")

DEPLOY_TOKEN = os.environ.get("DEPLOY_TOKEN")
ALLOW_WRITE = _bool_env("ALLOW_WRITE_TESTS", False)


def _log(line: str) -> None:
    print(line)


def _format_result(name: str, ok: bool, status: Optional[int], detail: str) -> str:
    status_text = f"status={status}" if status is not None else "status=-"
    return f"[{'OK' if ok else 'FAIL'}] {name} ({status_text}) {detail}"


def _request(
    session: httpx.Client,
    method: str,
    path: str,
    expected: Tuple[int, ...] = (200,),
    **kwargs: Any,
) -> Tuple[bool, Optional[int], str, Optional[Dict[str, Any]]]:
    url = path if path.startswith("http") else f"{API_BASE}{path}"
    try:
        resp = session.request(method, url, timeout=10, **kwargs)
        ok = resp.status_code in expected
        detail = resp.text[:500] if not ok else "ok"
        try:
            payload = resp.json()
        except Exception:
            payload = None
        return ok, resp.status_code, detail, payload
    except Exception as exc:
        return False, None, f"{type(exc).__name__}: {exc}", None


def _login(session: httpx.Client, username: str, password: str) -> Optional[str]:
    ok, status, detail, payload = _request(
        session,
        "POST",
        "/auth/login/",
        json={"username": username, "password": password},
        expected=(200,),
    )
    _log(_format_result(f"POST /auth/login/ ({username})", ok, status, detail))
    if not ok or not payload:
        return None
    token = payload.get("access_token")
    if token:
        session.headers.update({"Authorization": f"Bearer {token}"})
    return token


def main() -> int:
    _log(f"API base: {API_BASE}")
    _log(f"Write tests enabled: {ALLOW_WRITE}")

    admin = httpx.Client()
    student = httpx.Client()

    # Health check
    ok, status, detail, _ = _request(admin, "GET", f"{BASE_URL}/health", expected=(200,))
    _log(_format_result("GET /health", ok, status, detail))
    if not ok:
        _log("Backend is not healthy or not reachable.")
        return 1

    # Admin login
    admin_token = _login(admin, ADMIN_USERNAME, ADMIN_PASSWORD)
    if not admin_token and ADMIN_USERNAME == "admin":
        _log("Admin login failed; try setting ADMIN_USERNAME/ADMIN_PASSWORD.")
        return 1

    # Optional student login
    if STUDENT_USERNAME and STUDENT_PASSWORD:
        _login(student, STUDENT_USERNAME, STUDENT_PASSWORD)

    # Profile
    ok, status, detail, _ = _request(admin, "GET", "/profile/me/", expected=(200,))
    _log(_format_result("GET /profile/me/", ok, status, detail))

    # Projects
    ok, status, detail, payload = _request(admin, "GET", "/projects/", expected=(200,))
    _log(_format_result("GET /projects/", ok, status, detail))
    project_id = payload[0]["id"] if ok and isinstance(payload, list) and payload else None
    if project_id:
        ok, status, detail, _ = _request(admin, "GET", f"/projects/{project_id}/", expected=(200,))
        _log(_format_result(f"GET /projects/{project_id}/", ok, status, detail))

    # Students
    ok, status, detail, payload = _request(admin, "GET", "/students/", expected=(200,))
    _log(_format_result("GET /students/", ok, status, detail))
    student_id = payload[0]["id"] if ok and isinstance(payload, list) and payload else None
    student_code = payload[0]["student_code"] if ok and isinstance(payload, list) and payload else None
    if student_id:
        ok, status, detail, _ = _request(admin, "GET", f"/students/{student_id}/", expected=(200,))
        _log(_format_result(f"GET /students/{student_id}/", ok, status, detail))

    # Deployments
    ok, status, detail, payload = _request(admin, "GET", "/deployments/", expected=(200,))
    _log(_format_result("GET /deployments/", ok, status, detail))
    deployment_id = payload[0]["id"] if ok and isinstance(payload, list) and payload else None
    if deployment_id:
        ok, status, detail, _ = _request(admin, "GET", f"/deployments/{deployment_id}/", expected=(200,))
        _log(_format_result(f"GET /deployments/{deployment_id}/", ok, status, detail))

    # Deploy controller status + list
    if student_code:
        ok, status, detail, _ = _request(
            admin, "GET", f"/deploy/{student_code}?project_type=gd", expected=(200, 404)
        )
        _log(_format_result(f"GET /deploy/{student_code}?project_type=gd", ok, status, detail))
    ok, status, detail, _ = _request(admin, "GET", "/deploy/resources/list", expected=(200,))
    _log(_format_result("GET /deploy/resources/list", ok, status, detail))

    # Admin projects
    ok, status, detail, payload = _request(admin, "GET", "/admin/projects/", expected=(200,))
    _log(_format_result("GET /admin/projects/", ok, status, detail))
    admin_project_id = payload[0]["id"] if ok and isinstance(payload, list) and payload else None
    if admin_project_id:
        ok, status, detail, _ = _request(admin, "GET", f"/admin/projects/{admin_project_id}/", expected=(200,))
        _log(_format_result(f"GET /admin/projects/{admin_project_id}/", ok, status, detail))

    # Admin settings
    ok, status, detail, _ = _request(admin, "GET", "/admin/settings/", expected=(200,))
    _log(_format_result("GET /admin/settings/", ok, status, detail))
    ok, status, detail, _ = _request(admin, "GET", "/admin/semesters/", expected=(200,))
    _log(_format_result("GET /admin/semesters/", ok, status, detail))

    # Admin monitoring
    ok, status, detail, _ = _request(admin, "GET", "/admin/monitoring/overview", expected=(200,))
    _log(_format_result("GET /admin/monitoring/overview", ok, status, detail))
    ok, status, detail, _ = _request(admin, "GET", "/admin/monitoring/namespaces", expected=(200,))
    _log(_format_result("GET /admin/monitoring/namespaces", ok, status, detail))

    # Registries
    ok, status, detail, payload = _request(admin, "GET", "/admin/registries/", expected=(200,))
    _log(_format_result("GET /admin/registries/", ok, status, detail))

    # Workflows
    if student_id:
        ok, status, detail, _ = _request(
            admin, "GET", f"/workflows/?student_id={student_id}", expected=(200, 400, 503)
        )
        _log(_format_result(f"GET /workflows/?student_id={student_id}", ok, status, detail))

    # Builds
    ok, status, detail, payload = _request(admin, "GET", "/builds/", expected=(200,))
    _log(_format_result("GET /builds/", ok, status, detail))
    build_id = payload[0]["id"] if ok and isinstance(payload, list) and payload else None
    if student_id:
        ok, status, detail, _ = _request(admin, "GET", f"/build-configs/{student_id}", expected=(200,))
        _log(_format_result(f"GET /build-configs/{student_id}", ok, status, detail))
    if build_id:
        ok, status, detail, _ = _request(admin, "GET", f"/builds/{build_id}/logs", expected=(200, 404))
        _log(_format_result(f"GET /builds/{build_id}/logs", ok, status, detail))

    # Student-only APIs
    if STUDENT_USERNAME and STUDENT_PASSWORD:
        ok, status, detail, _ = _request(student, "GET", "/projects/me/", expected=(200, 403))
        _log(_format_result("GET /projects/me/", ok, status, detail))
        ok, status, detail, _ = _request(student, "GET", "/build-configs/me", expected=(200, 403))
        _log(_format_result("GET /build-configs/me", ok, status, detail))

    # Optional write tests (disabled by default)
    if not ALLOW_WRITE:
        _log("[SKIP] Write tests disabled. Set ALLOW_WRITE_TESTS=true to exercise POST/PUT/DELETE.")
        return 0

    if student_id:
        ok, status, detail, _ = _request(
            admin,
            "POST",
            f"/build-configs/{student_id}/deploy-key",
            json={"force": False},
            expected=(200, 403),
        )
        _log(_format_result(f"POST /build-configs/{student_id}/deploy-key", ok, status, detail))

    _log("[WARN] Write tests are enabled but not exhaustive in this script.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
