from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException
from app.api import auth_deps
from app.models.user import UserRole
from app.services.monitoring_service import monitoring_service

router = APIRouter()


def _role_value(user: object) -> str:
    return getattr(getattr(user, "role", None), "value", getattr(user, "role", ""))


def _require_monitoring_role(user: object) -> None:
    role = _role_value(user)
    if role not in [UserRole.admin.value, UserRole.teacher.value]:
        raise HTTPException(status_code=403, detail="Not authorized to access monitoring")

@router.get("/overview", response_model=Dict[str, Any])
def get_cluster_overview(
    current_user = Depends(auth_deps.get_current_user),
):
    _require_monitoring_role(current_user)
    return monitoring_service.get_cluster_overview()

@router.get("/namespaces", response_model=List[Dict[str, Any]])
def get_namespace_usage(
    current_user = Depends(auth_deps.get_current_user),
):
    _require_monitoring_role(current_user)
    return monitoring_service.get_namespace_usage()
