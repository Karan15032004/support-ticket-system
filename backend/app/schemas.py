"""
schemas.py — Pydantic Models (Request & Response Shapes)

These are NOT database tables. These are the shapes of data that:
  - Come INTO the API (request bodies)
  - Go OUT of the API (response bodies)

Pydantic validates automatically. If a request sends the wrong type,
FastAPI returns a 422 error before your code even runs.

Naming convention used here:
  UserCreate   → data needed to create a user
  UserResponse → data returned when reading a user (never includes password)
  TokenResponse → what /auth/login returns
"""

from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional
from .models import UserRole


# ─────────────────────────────────────────────
# Auth schemas
# ─────────────────────────────────────────────

class LoginRequest(BaseModel):
    """What the client sends to POST /auth/login"""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """What POST /auth/login returns on success"""
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: int
    name: str


# ─────────────────────────────────────────────
# User schemas
# ─────────────────────────────────────────────

class UserResponse(BaseModel):
    """Safe user representation — password_hash is NEVER included"""
    id: int
    email: str
    name: str
    role: UserRole
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True  # Allows creating from SQLAlchemy model instances