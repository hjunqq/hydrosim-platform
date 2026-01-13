"""
Unified exception handling for HydroSim Portal API.

This module provides:
- AppException: Base exception class with HTTP status code
- NotFoundError: 404 errors
- PermissionDeniedError: 403 errors  
- BadRequestError: 400 errors
- ConflictError: 409 errors
- InternalServerError: 500 errors
"""
from typing import Any, Optional


class AppException(Exception):
    """Base exception for application errors with HTTP status support."""
    
    def __init__(
        self,
        message: str,
        status_code: int = 400,
        error_code: Optional[str] = None,
        details: Optional[Any] = None
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code or self._default_error_code()
        self.details = details
    
    def _default_error_code(self) -> str:
        return self.__class__.__name__.upper()
    
    def to_dict(self) -> dict:
        """Convert exception to JSON response format."""
        result = {
            "error": self.error_code,
            "message": self.message,
            "status_code": self.status_code,
        }
        if self.details:
            result["details"] = self.details
        return result


class NotFoundError(AppException):
    """Resource not found (HTTP 404)."""
    
    def __init__(self, resource: str = "Resource", id: Optional[Any] = None):
        message = f"{resource} not found"
        if id is not None:
            message = f"{resource} with id '{id}' not found"
        super().__init__(message=message, status_code=404)


class PermissionDeniedError(AppException):
    """Permission denied (HTTP 403)."""
    
    def __init__(self, message: str = "Permission denied"):
        super().__init__(message=message, status_code=403)


class BadRequestError(AppException):
    """Bad request (HTTP 400)."""
    
    def __init__(self, message: str = "Bad request", details: Optional[Any] = None):
        super().__init__(message=message, status_code=400, details=details)


class ConflictError(AppException):
    """Resource conflict (HTTP 409)."""
    
    def __init__(self, message: str = "Resource conflict"):
        super().__init__(message=message, status_code=409)


class InternalServerError(AppException):
    """Internal server error (HTTP 500)."""
    
    def __init__(self, message: str = "Internal server error"):
        super().__init__(message=message, status_code=500)


class ValidationError(AppException):
    """Validation error (HTTP 422)."""
    
    def __init__(self, message: str = "Validation failed", details: Optional[Any] = None):
        super().__init__(message=message, status_code=422, details=details)


class UnauthorizedError(AppException):
    """Unauthorized (HTTP 401)."""
    
    def __init__(self, message: str = "Authentication required"):
        super().__init__(message=message, status_code=401)
