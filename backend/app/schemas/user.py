from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    STUDENT = "student"
    ADMIN = "admin"


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
