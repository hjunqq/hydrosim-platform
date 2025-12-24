"""
Project management endpoints
"""
from typing import List, Optional
from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def list_projects(student_id: Optional[str] = None):
    """查询项目列表"""
    # TODO: 实现从 k8s 查询项目
    return {"message": "Projects endpoint - to be implemented"}


@router.get("/{project_id}")
def get_project(project_id: str):
    """获取项目详情"""
    # TODO: 实现项目详情查询
    return {"message": f"Get project {project_id} - to be implemented"}
