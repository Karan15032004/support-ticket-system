"""
schemas.py — Pydantic Models (Request & Response Shapes)

Phase 1: LoginRequest, TokenResponse, UserResponse, UserBriefResponse
Phase 2: Ticket, Reply, Event, Collaborator schemas
Phase 3: BulkAssignRequest, BulkCloseRequest, BulkResultItem, BulkResultResponse
"""

from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List
from .models import UserRole, TicketStatus, TicketPriority, TicketCategory, EventType


# ─────────────────────────────────────────────
# Auth schemas
# ─────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: int
    name: str


# ─────────────────────────────────────────────
# User schemas
# ─────────────────────────────────────────────

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: UserRole
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class UserBriefResponse(BaseModel):
    """Compact user info embedded inside ticket responses."""
    id: int
    name: str
    email: str
    role: UserRole

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Ticket schemas
# ─────────────────────────────────────────────

class TicketCreate(BaseModel):
    subject: str
    description: str
    requester_name: str
    priority: TicketPriority
    category: TicketCategory
    assignee_id: Optional[int] = None


class TicketUpdate(BaseModel):
    """All fields optional — partial update pattern."""
    subject: Optional[str] = None
    description: Optional[str] = None
    requester_name: Optional[str] = None
    priority: Optional[TicketPriority] = None
    category: Optional[TicketCategory] = None
    assignee_id: Optional[int] = None


class StatusChangeRequest(BaseModel):
    new_status: TicketStatus


class CollaboratorAdd(BaseModel):
    agent_id: int


class TicketResponse(BaseModel):
    """
    Full ticket returned to browser.
    sla_remaining_seconds is computed in the router, not stored in DB.
    Negative = already breached.
    """
    id: int
    subject: str
    description: str
    requester_name: str
    priority: TicketPriority
    category: TicketCategory
    status: TicketStatus
    assignee_id: Optional[int]
    assignee: Optional[UserBriefResponse]
    created_by: int
    creator: Optional[UserBriefResponse]
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime]
    response_due_at: Optional[datetime]
    total_paused_seconds: float
    archived: bool
    sla_remaining_seconds: Optional[float] = None

    class Config:
        from_attributes = True


class TicketListResponse(BaseModel):
    """
    Paginated ticket list.
    total_count is needed for frontend to show "Showing 1-20 of 347"
    and render prev/next buttons correctly.
    """
    tickets: List[TicketResponse]
    total_count: int
    page: int
    page_size: int


# ─────────────────────────────────────────────
# Reply schemas
# ─────────────────────────────────────────────

class ReplyCreate(BaseModel):
    body: str
    is_internal: bool = False


class ReplyResponse(BaseModel):
    id: int
    ticket_id: int
    author_id: int
    author: UserBriefResponse
    body: str
    is_internal: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Ticket Event schemas
# ─────────────────────────────────────────────

class TicketEventResponse(BaseModel):
    id: int
    ticket_id: int
    event_type: EventType
    old_value: Optional[str]
    new_value: Optional[str]
    actor_id: int
    actor: UserBriefResponse
    created_at: datetime

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Collaborator schemas
# ─────────────────────────────────────────────

class CollaboratorResponse(BaseModel):
    ticket_id: int
    agent_id: int
    agent: UserBriefResponse
    added_at: datetime

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Bulk Action schemas (Phase 3)
# ─────────────────────────────────────────────

class BulkAssignRequest(BaseModel):
    """
    Body for POST /tickets/bulk-assign.
    ticket_ids: which tickets to reassign.
    assignee_id: which agent to assign them all to.
    """
    ticket_ids: List[int]
    assignee_id: int


class BulkCloseRequest(BaseModel):
    """Body for POST /tickets/bulk-close."""
    ticket_ids: List[int]


class BulkResultItem(BaseModel):
    """
    One entry in the bulk action results array.
    The assignment explicitly requires this format:
      [{ticket_id, success: true/false, reason: "..."}]
    so the frontend can show per-ticket outcomes, not just a total count.
    """
    ticket_id: int
    success: bool
    reason: str


class BulkResultResponse(BaseModel):
    results: List[BulkResultItem]