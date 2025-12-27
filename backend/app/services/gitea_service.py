import logging
import requests
from typing import List, Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

class GiteaService:
    def __init__(self):
        self.base_url = settings.GITEA_URL
        self.token = settings.GITEA_TOKEN
        self.headers = {
            "Authorization": f"token {self.token}",
            "Content-Type": "application/json"
        }

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
