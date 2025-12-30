from datetime import date
from typing import Optional
from pydantic import BaseModel

class SemesterBase(BaseModel):
    name: str
    start_date: date
    end_date: date
    is_active: Optional[bool] = True

class SemesterCreate(SemesterBase):
    pass

class SemesterUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None

class SemesterRead(SemesterBase):
    id: int

    class Config:
        from_attributes = True
