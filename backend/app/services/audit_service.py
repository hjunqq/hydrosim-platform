"""
Audit logging service for tracking user actions.
"""
from typing import Optional, Any, Dict
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import Request

from app.models.audit_log import AuditLog, AuditAction, AuditResourceType


class AuditService:
    """Service for creating and querying audit logs."""
    
    @staticmethod
    def log(
        db: Session,
        action: str,
        resource_type: str,
        resource_id: Optional[int] = None,
        resource_name: Optional[str] = None,
        user_id: Optional[int] = None,
        username: Optional[str] = None,
        user_role: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        message: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AuditLog:
        """
        Create an audit log entry.
        
        Args:
            db: Database session
            action: Action type (CREATE, UPDATE, DELETE, etc.)
            resource_type: Type of resource affected
            resource_id: ID of the affected resource
            resource_name: Human-readable name of the resource
            user_id: ID of the user performing the action
            username: Username of the user
            user_role: Role of the user
            details: Additional context as dict
            message: Human-readable description
            ip_address: Client IP address
            user_agent: Client user agent
            
        Returns:
            Created AuditLog instance
        """
        log_entry = AuditLog(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            user_id=user_id,
            username=username,
            user_role=user_role,
            details=details,
            message=message,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        return log_entry
    
    @staticmethod
    def log_from_request(
        db: Session,
        request: Request,
        action: str,
        resource_type: str,
        resource_id: Optional[int] = None,
        resource_name: Optional[str] = None,
        current_user: Optional[Any] = None,
        details: Optional[Dict[str, Any]] = None,
        message: Optional[str] = None,
    ) -> AuditLog:
        """
        Create an audit log entry with request context.
        
        Extracts IP address and user agent from the request,
        and user info from current_user.
        """
        # Extract IP address
        ip_address = None
        if request:
            # Handle X-Forwarded-For header for proxied requests
            forwarded_for = request.headers.get("X-Forwarded-For")
            if forwarded_for:
                ip_address = forwarded_for.split(",")[0].strip()
            else:
                ip_address = request.client.host if request.client else None
        
        # Extract user agent
        user_agent = request.headers.get("User-Agent") if request else None
        
        # Extract user info
        user_id = None
        username = None
        user_role = None
        if current_user:
            user_id = getattr(current_user, "id", None)
            username = getattr(current_user, "username", None) or getattr(current_user, "student_code", None)
            role_attr = getattr(current_user, "role", None)
            user_role = role_attr.value if hasattr(role_attr, "value") else str(role_attr)
        
        return AuditService.log(
            db=db,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            user_id=user_id,
            username=username,
            user_role=user_role,
            details=details,
            message=message,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    
    @staticmethod
    def get_logs(
        db: Session,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        user_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 100,
    ):
        """Query audit logs with optional filters."""
        query = db.query(AuditLog)
        
        if action:
            query = query.filter(AuditLog.action == action)
        if resource_type:
            query = query.filter(AuditLog.resource_type == resource_type)
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        if start_date:
            query = query.filter(AuditLog.created_at >= start_date)
        if end_date:
            query = query.filter(AuditLog.created_at <= end_date)
        
        return query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def count_logs(
        db: Session,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        user_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> int:
        """Count audit logs with optional filters."""
        query = db.query(AuditLog)
        
        if action:
            query = query.filter(AuditLog.action == action)
        if resource_type:
            query = query.filter(AuditLog.resource_type == resource_type)
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        if start_date:
            query = query.filter(AuditLog.created_at >= start_date)
        if end_date:
            query = query.filter(AuditLog.created_at <= end_date)
        
        return query.count()


# Convenience functions
def log_action(
    db: Session,
    action: str,
    resource_type: str,
    resource_id: Optional[int] = None,
    resource_name: Optional[str] = None,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    user_role: Optional[str] = None,
    message: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    """Convenience function to log an action."""
    return AuditService.log(
        db=db,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        resource_name=resource_name,
        user_id=user_id,
        username=username,
        user_role=user_role,
        message=message,
        details=details,
    )
