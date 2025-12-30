from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class RegistryBase(BaseModel):
    name: str
    url: str
    username: Optional[str] = None
    is_active: Optional[bool] = True

class RegistryCreate(RegistryBase):
    password: Optional[str] = None

class RegistryUpdate(RegistryBase):
    password: Optional[str] = None

class Registry(RegistryBase):
    id: int
    created_at: datetime
    # Don't return password
    
    class Config:
        from_attributes = True

class RegistryTestRequest(BaseModel):
    url: str
    username: Optional[str] = None
    password: Optional[str] = None
