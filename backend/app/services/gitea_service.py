import logging
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import urlparse

import requests
from app.core.config import settings

logger = logging.getLogger(__name__)

class GiteaService:
    def __init__(self):
        self.base_url = settings.GITEA_URL.rstrip("/") if settings.GITEA_URL else None
        self.token = settings.GITEA_TOKEN
        self.headers = {
            "Authorization": f"token {self.token}",
            "Content-Type": "application/json"
        }

    def is_configured(self) -> bool:
        return bool(self.base_url and self.token)

    def _parse_repo_full_name(self, repo_url: str) -> Optional[Tuple[str, str]]:
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

        segments = [seg for seg in path.split("/") if seg]
        if len(segments) < 2:
            return None
        owner = segments[-2]
        repo = segments[-1]
        return owner, repo

    def create_deploy_key(self, repo_url: str, title: str, key: str, read_only: bool = True) -> bool:
        if not self.is_configured():
            return False
        repo_info = self._parse_repo_full_name(repo_url)
        if not repo_info:
            raise ValueError("Invalid repository URL")
        owner, repo_name = repo_info
        url = f"{self.base_url}/api/v1/repos/{owner}/{repo_name}/keys"
        payload = {
            "title": title,
            "key": key,
            "read_only": read_only,
        }
        try:
            response = requests.post(url, headers=self.headers, json=payload, timeout=8)
        except Exception as exc:
            logger.error(f"Gitea request failed: {exc}")
            return False

        if response.status_code in (200, 201):
            return True
        if response.status_code in (409, 422):
            # Key already exists or conflicts; treat as success for idempotency.
            logger.info("Deploy key already exists for %s", repo_url)
            return True

        logger.error(f"Gitea API error {response.status_code}: {response.text}")
        return False

    def _get(self, path: str) -> Optional[Any]:
        if not self.base_url or not self.token:
            logger.warning("Gitea configuration missing")
            return None
            
        url = f"{self.base_url}/api/v1{path}"
        try:
            response = requests.get(url, headers=self.headers, timeout=5)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Gitea API error {response.status_code}: {response.text}")
                return None
        except Exception as e:
            logger.error(f"Gitea request failed: {e}")
            return None

    def get_repo(self, owner: str, repo_name: str) -> Optional[Dict]:
        return self._get(f"/repos/{owner}/{repo_name}")

    def get_workflows(self, owner: str, repo_name: str) -> List[Dict]:
        """
        Gitea Actions API for workflows (if available, mostly mimics GitHub Actions)
        Note: Standard Gitea API might not fully support workflow listing yet depending on version.
        We will try to fetch runs directly if workflows list is unavailable.
        """
        # Placeholder: returning empty list as specific endpoint depends on Gitea version/plugin
        # Often /repos/{owner}/{repo}/actions/workflows
        return self._get(f"/repos/{owner}/{repo_name}/actions/workflows") or []

    def get_workflow_runs(self, owner: str, repo_name: str, page: int = 1, limit: int = 20) -> List[Dict]:
        """
        Get all workflow runs for a repository
        """
        data = self._get(f"/repos/{owner}/{repo_name}/actions/runs?page={page}&limit={limit}")
        return data if isinstance(data, list) else (data.get("workflow_runs", []) if data else [])

gitea_service = GiteaService()
