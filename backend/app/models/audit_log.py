"""
Audit Log model for tracking user actions.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class AuditLog(Base):
    """Audit log for tracking user actions in the system."""
    
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Action info
    action = Column(String(50), nullable=False, index=True)  # CREATE, UPDATE, DELETE, DEPLOY, BUILD, LOGIN, etc.
    resource_type = Column(String(50), nullable=False, index=True)  # student, project, deployment, build, etc.
    resource_id = Column(Integer, nullable=True)  # ID of the affected resource
    resource_name = Column(String(200), nullable=True)  # Human-readable name of the resource
    
    # User info
    user_id = Column(Integer, ForeignKey("teachers.id"), nullable=True)
    username = Column(String(100), nullable=True)  # Stored separately in case user is deleted
    user_role = Column(String(20), nullable=True)  # admin, teacher, student
    
    # Details
    details = Column(JSON, nullable=True)  # Additional context as JSON
    message = Column(Text, nullable=True)  # Human-readable description
    
    # Request info
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    user_agent = Column(String(500), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships (optional - user might be deleted)
    # user = relationship("Teacher", back_populates="audit_logs")
    
    def __repr__(self):
        return f"<AuditLog {self.id}: {self.action} {self.resource_type}>"


class AuditAction:
    """Constants for audit actions."""
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    DEPLOY = "DEPLOY"
    BUILD = "BUILD"
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    PASSWORD_RESET = "PASSWORD_RESET"
    STATUS_CHANGE = "STATUS_CHANGE"
    IMPORT = "IMPORT"
    EXPORT = "EXPORT"


class AuditResourceType:
    """Constants for resource types."""
    STUDENT = "student"
    PROJECT = "project"
    DEPLOYMENT = "deployment"
    BUILD = "build"
    BUILD_CONFIG = "build_config"
    USER = "user"
    SYSTEM_SETTINGS = "system_settings"
