from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException
from app.api import auth_deps
from app.services.monitoring_service import monitoring_service

router = APIRouter()

@router.get("/overview", response_model=Dict[str, Any])
def get_cluster_overview(
    current_user = Depends(auth_deps.get_current_user),
):
    return monitoring_service.get_cluster_overview()

@router.get("/namespaces", response_model=List[Dict[str, Any]])
def get_namespace_usage(
    current_user = Depends(auth_deps.get_current_user),
):
    return monitoring_service.get_namespace_usage()
