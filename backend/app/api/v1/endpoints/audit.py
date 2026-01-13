"""
Audit log API endpoints.
"""
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api import deps
from app.api.auth_deps import get_current_user
from app.models.audit_log import AuditLog, AuditAction, AuditResourceType
from app.services.audit_service import AuditService
from app.core.exceptions import PermissionDeniedError
from app.models.user import UserRole

router = APIRouter()


class AuditLogOut(BaseModel):
    """Audit log response schema."""
    id: int
    action: str
    resource_type: str
    resource_id: Optional[int] = None
    resource_name: Optional[str] = None
    user_id: Optional[int] = None
    username: Optional[str] = None
    user_role: Optional[str] = None
    message: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    """Paginated audit log list response."""
    items: List[AuditLogOut]
    total: int
    page: int
    page_size: int


class AuditStatsResponse(BaseModel):
    """Audit statistics response."""
    total_logs: int
    action_counts: dict
    resource_type_counts: dict
    recent_activity: List[AuditLogOut]


@router.get("/", response_model=AuditLogListResponse)
def list_audit_logs(
    db: Session = Depends(deps.get_db),
    current_user = Depends(get_current_user),
    action: Optional[str] = Query(None, description="Filter by action type"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    start_date: Optional[datetime] = Query(None, description="Filter from date"),
    end_date: Optional[datetime] = Query(None, description="Filter to date"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
):
    """
    List audit logs with optional filters (Admin only).
    """
    # Check permission
    role = getattr(getattr(current_user, "role", None), "value", getattr(current_user, "role", ""))
    if role != UserRole.admin.value:
        raise PermissionDeniedError("Only administrators can view audit logs")
    
    skip = (page - 1) * page_size
    
    logs = AuditService.get_logs(
        db=db,
        action=action,
        resource_type=resource_type,
        user_id=user_id,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=page_size,
    )
    
    total = AuditService.count_logs(
        db=db,
        action=action,
        resource_type=resource_type,
        user_id=user_id,
        start_date=start_date,
        end_date=end_date,
    )
    
    return AuditLogListResponse(
        items=[AuditLogOut.model_validate(log) for log in logs],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/stats/", response_model=AuditStatsResponse)
def get_audit_stats(
    db: Session = Depends(deps.get_db),
    current_user = Depends(get_current_user),
    days: int = Query(7, ge=1, le=30, description="Number of days to analyze"),
):
    """
    Get audit log statistics (Admin only).
    """
    # Check permission
    role = getattr(getattr(current_user, "role", None), "value", getattr(current_user, "role", ""))
    if role != UserRole.admin.value:
        raise PermissionDeniedError("Only administrators can view audit stats")
    
    from datetime import timedelta
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Count total logs
    total = AuditService.count_logs(db=db, start_date=start_date)
    
    # Count by action
    action_counts = {}
    for action in [AuditAction.CREATE, AuditAction.UPDATE, AuditAction.DELETE, 
                   AuditAction.DEPLOY, AuditAction.BUILD, AuditAction.LOGIN]:
        count = AuditService.count_logs(db=db, action=action, start_date=start_date)
        if count > 0:
            action_counts[action] = count
    
    # Count by resource type
    resource_counts = {}
    for resource in [AuditResourceType.STUDENT, AuditResourceType.PROJECT,
                     AuditResourceType.DEPLOYMENT, AuditResourceType.BUILD]:
        count = AuditService.count_logs(db=db, resource_type=resource, start_date=start_date)
        if count > 0:
            resource_counts[resource] = count
    
    # Get recent activity
    recent = AuditService.get_logs(db=db, start_date=start_date, limit=10)
    
    return AuditStatsResponse(
        total_logs=total,
        action_counts=action_counts,
        resource_type_counts=resource_counts,
        recent_activity=[AuditLogOut.model_validate(log) for log in recent],
    )


@router.get("/actions/", response_model=List[str])
def list_action_types(
    current_user = Depends(get_current_user),
):
    """
    List available action types.
    """
    return [
        AuditAction.CREATE,
        AuditAction.UPDATE,
        AuditAction.DELETE,
        AuditAction.DEPLOY,
        AuditAction.BUILD,
        AuditAction.LOGIN,
        AuditAction.LOGOUT,
        AuditAction.PASSWORD_RESET,
        AuditAction.STATUS_CHANGE,
        AuditAction.IMPORT,
        AuditAction.EXPORT,
    ]


@router.get("/resource-types/", response_model=List[str])
def list_resource_types(
    current_user = Depends(get_current_user),
):
    """
    List available resource types.
    """
    return [
        AuditResourceType.STUDENT,
        AuditResourceType.PROJECT,
        AuditResourceType.DEPLOYMENT,
        AuditResourceType.BUILD,
        AuditResourceType.BUILD_CONFIG,
        AuditResourceType.USER,
        AuditResourceType.SYSTEM_SETTINGS,
    ]
