from typing import Optional
from pydantic import BaseModel, EmailStr

class SystemSettingBase(BaseModel):
    platform_name: Optional[str] = None
    portal_title: Optional[str] = None
    env_type: Optional[str] = None
    domain_name: Optional[str] = None
    student_domain_prefix: Optional[str] = None
    student_domain_base: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    help_url: Optional[str] = None
    footer_text: Optional[str] = None

class SystemSettingUpdate(SystemSettingBase):
    pass

class SystemSettingRead(SystemSettingBase):
    id: int

    class Config:
        from_attributes = True
