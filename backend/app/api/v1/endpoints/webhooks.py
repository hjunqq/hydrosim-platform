import hashlib
import hmac
import json
import logging
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Header, HTTPException, Depends, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.models.build_config import BuildConfig
from app.services.build_orchestrator import build_orchestrator

router = APIRouter()
logger = logging.getLogger(__name__)


def _normalize_repo_url(repo_url: str) -> Optional[str]:
    if not repo_url:
        return None
    repo_url = repo_url.strip()
    host = ""
    path = ""

    if repo_url.startswith("git@"):
        host_path = repo_url.split("@", 1)[1]
        if ":" in host_path:
            host, path = host_path.split(":", 1)
        else:
            host = host_path
    elif repo_url.startswith("ssh://"):
        parsed = urlparse(repo_url)
        host = parsed.hostname or ""
        path = (parsed.path or "").lstrip("/")
    elif "://" in repo_url:
        parsed = urlparse(repo_url)
        host = parsed.hostname or parsed.netloc
        path = (parsed.path or "").lstrip("/")
    else:
        parts = repo_url.split("/", 1)
        host = parts[0]
        if len(parts) > 1:
            path = parts[1]

    if not host or not path:
        return None

    if path.endswith(".git"):
        path = path[:-4]

    return f"{host}/{path}".lower()


def _extract_repo_url(repo_info: dict) -> Optional[str]:
    for key in ["ssh_url", "clone_url", "html_url", "url"]:
        value = repo_info.get(key)
        if value:
            return value
    return None


@router.post("/gitea")
async def gitea_webhook(
    request: Request,
    x_gitea_signature: str = Header(None),
    x_gitea_event: str = Header(None),
    db: Session = Depends(deps.get_db),
):
    """
    Handle Gitea webhooks (push events)
    """
    raw_body = await request.body()
    if settings.GITEA_WEBHOOK_SECRET:
        if not x_gitea_signature:
            raise HTTPException(status_code=403, detail="Missing webhook signature")
        signature = x_gitea_signature
        if signature.startswith("sha256="):
            signature = signature.split("=", 1)[1]
        digest = hmac.new(
            settings.GITEA_WEBHOOK_SECRET.encode("utf-8"),
            raw_body,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(signature, digest):
            raise HTTPException(status_code=403, detail="Invalid webhook signature")

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    if x_gitea_event != "push":
        return {"msg": "Ignored event type"}

    repo_info = payload.get("repository", {})
    repo_url = _extract_repo_url(repo_info)
    normalized_repo = _normalize_repo_url(repo_url or "")
    if not normalized_repo:
        raise HTTPException(status_code=400, detail="Missing repository URL")

    config = None
    for item in db.query(BuildConfig).all():
        if _normalize_repo_url(item.repo_url or "") == normalized_repo:
            config = item
            break

    if not config:
        logger.warning(f"No build config found for repo: {repo_url}")
        return {"msg": "No config found", "repo": repo_url}

    if not config.auto_build:
        return {"msg": "Auto build disabled"}

    ref = payload.get("ref", "")
    branch = ref.split("/")[-1] if ref else "main"
    if branch != config.branch:
        return {"msg": "Branch mismatch, skipping"}

    commit_sha = payload.get("after")
    commits = payload.get("commits", [])
    if commits:
        commit_sha = commits[-1].get("id") or commit_sha

    try:
        build = build_orchestrator.trigger_build(
            db=db,
            student_id=config.student_id,
            commit_sha=commit_sha or "latest",
            branch=branch,
        )
        return {"msg": "Build triggered", "build_id": build.id}
    except Exception as e:
        logger.error(f"Failed to trigger build via webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))
