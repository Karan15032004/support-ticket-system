"""
schemas.py — Pydantic Models (Request & Response Shapes)

These are NOT database tables. These define the shapes of data that:
  - Come INTO the API (request bodies — what the browser sends us)
  - Go OUT of the API (response bodies — what we send back to the browser)

Pydantic validates automatically. If a request sends the wrong type or
misses a required field, FastAPI returns a 422 error before your code runs.

Think of these as "contracts":
  - The frontend promises to send data in this shape
  - The backend promises to respond in this shape

Naming convention:
  TicketCreate   → data needed to CREATE a ticket (sent by browser)
  TicketUpdate   → data allowed when EDITING a ticket
  TicketResponse → full ticket data returned to the browser

Phase 1 schemas: LoginRequest, TokenResponse, UserResponse
Phase 2 schemas: Everything below the Phase 1 section
"""

from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List
from .models import UserRole, TicketStatus, TicketPriority, TicketCategory, EventType


# ─────────────────────────────────────────────
# Auth schemas (Phase 1 — unchanged)
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
# User schemas (Phase 1 — unchanged)
# ─────────────────────────────────────────────

class UserResponse(BaseModel):
    """
    Safe user representation — password_hash is NEVER included.
    
    'from_attributes = True' means Pydantic can read from a SQLAlchemy
    model object directly, instead of needing a plain dictionary.
    Without this, you'd have to manually convert every SQLAlchemy object.
    """
    id: int
    email: str
    name: str
    role: UserRole
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class UserBriefResponse(BaseModel):
    """
    Compact user info — used inside ticket responses.
    We don't need the full user object, just enough to display
    who the assignee is, who wrote a reply, etc.
    """
    id: int
    name: str
    email: str
    role: UserRole

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Ticket schemas (Phase 2 — NEW)
# ─────────────────────────────────────────────

class TicketCreate(BaseModel):
    """
    What the browser sends when creating a new ticket.
    POST /tickets receives this.
    
    Notice: no 'status', 'created_at', 'id' — those are set by the server,
    not the client. The client only provides what it actually knows.
    
    assignee_id is Optional — a ticket can be created unassigned.
    """
    subject: str
    description: str
    requester_name: str
    priority: TicketPriority
    category: TicketCategory
    assignee_id: Optional[int] = None


class TicketUpdate(BaseModel):
    """
    What the browser sends when editing a ticket's basic fields.
    PUT /tickets/{id} receives this.
    
    All fields are Optional — you only send what you're changing.
    This is called a "partial update" pattern.
    
    Example: browser sends {"subject": "New Subject"} — only subject updates,
    everything else stays the same.
    
    Note: status changes go through PUT /tickets/{id}/status separately
    because status changes have validation logic (legal transitions, SLA pause, etc.)
    We don't want regular edits to accidentally bypass that logic.
    """
    subject: Optional[str] = None
    description: Optional[str] = None
    requester_name: Optional[str] = None
    priority: Optional[TicketPriority] = None
    category: Optional[TicketCategory] = None
    assignee_id: Optional[int] = None


class StatusChangeRequest(BaseModel):
    """
    What the browser sends when changing a ticket's status.
    PUT /tickets/{id}/status receives this.
    
    That's literally it — just the new status.
    The server figures out if the transition is legal.
    """
    new_status: TicketStatus


class CollaboratorAdd(BaseModel):
    """
    What the browser sends when adding a collaborator.
    POST /tickets/{id}/collaborators receives this.
    """
    agent_id: int


class TicketResponse(BaseModel):
    """
    Full ticket data returned to the browser.
    
    Notice we include nested objects (assignee, creator) using UserBriefResponse —
    so the browser gets the name and email of those users without a second API call.
    
    sla_remaining_seconds: computed field.
    We calculate this in the router (not stored in DB) and include it here
    so the frontend can show a countdown without any extra math.
    A negative value means the SLA has already been breached.
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
    What GET /tickets returns — a page of tickets + the total count.
    
    Why include total_count? Because the frontend needs to show
    "Showing 1-20 of 347 tickets" and render pagination buttons.
    Without total_count, you'd have to fetch ALL tickets just to count them.
    """
    tickets: List[TicketResponse]
    total_count: int
    page: int
    page_size: int


# ─────────────────────────────────────────────
# Reply schemas (Phase 2 — NEW)
# ─────────────────────────────────────────────

class ReplyCreate(BaseModel):
    """
    What the browser sends when adding a reply.
    POST /tickets/{id}/replies receives this.
    
    is_internal: True = amber "Internal Note", False = customer-visible reply
    """
    body: str
    is_internal: bool = False


class ReplyResponse(BaseModel):
    """
    A single reply returned to the browser.
    We include the full author object so the UI can show "Replied by Priya Patel".
    """
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
# Ticket Event schemas (Phase 2 — NEW)
# ─────────────────────────────────────────────

class TicketEventResponse(BaseModel):
    """
    A single event in the immutable timeline.
    
    old_value / new_value are strings — for a status change, that's "open" / "pending".
    For a reassignment, it might be "Priya Patel" / "Rahul Sharma".
    
    actor: the user who caused this event.
    """
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
# Collaborator schemas (Phase 2 — NEW)
# ─────────────────────────────────────────────

class CollaboratorResponse(BaseModel):
    """
    A collaborator entry returned to the browser.
    Includes the agent's full brief info so the UI can display their name.
    """
    ticket_id: int
    agent_id: int
    agent: UserBriefResponse
    added_at: datetime

    class Config:
        from_attributes = True