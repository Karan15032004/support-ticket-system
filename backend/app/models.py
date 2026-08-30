"""
models.py — Database Table Definitions

Every class here maps to one table in PostgreSQL.
SQLAlchemy reads these classes and knows how to:
  - Create the tables (CREATE TABLE)
  - Insert rows (INSERT INTO)
  - Query rows (SELECT)
  - Update rows (UPDATE)

We define ALL tables here even though Phase 1 only uses 'users'.
Reason: it's cleaner to create all tables at once in one go, and the
assignment schema is fully defined — no reason to defer.

Tables:
  1. users           — agents and supervisors who log in
  2. tickets         — the core support tickets
  3. replies         — messages inside tickets (customer-visible or internal)
  4. ticket_events   — immutable audit log of everything that happens
  5. collaborators   — join table linking agents to tickets they help on
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime,
    ForeignKey, Enum, Float
)
from sqlalchemy.orm import relationship
import enum

from .database import Base


# ─────────────────────────────────────────────
# Enums — fixed sets of allowed values
# Using Python enums + SQLAlchemy Enum keeps values validated at DB level
# ─────────────────────────────────────────────

class UserRole(str, enum.Enum):
    supervisor = "supervisor"
    agent = "agent"


class TicketStatus(str, enum.Enum):
    new = "new"
    open = "open"
    pending = "pending"
    resolved = "resolved"
    closed = "closed"


class TicketPriority(str, enum.Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class TicketCategory(str, enum.Enum):
    billing = "billing"
    technical = "technical"
    how_to = "how_to"
    account = "account"
    feature_request = "feature_request"
    other = "other"


class EventType(str, enum.Enum):
    ticket_created = "ticket_created"
    status_changed = "status_changed"
    reassigned = "reassigned"
    reply_added = "reply_added"
    collaborator_added = "collaborator_added"
    collaborator_removed = "collaborator_removed"
    ticket_archived = "ticket_archived"
    ticket_restored = "ticket_restored"


# ─────────────────────────────────────────────
# Table 1: users
# ─────────────────────────────────────────────

class User(Base):
    """
    Stores everyone who can log in — both supervisors and agents.
    Customers never log in; they appear only as 'requester_name' on tickets.
    
    password_hash: we NEVER store plain passwords. passlib hashes them.
    role: 'supervisor' or 'agent' — this is what the JWT carries and
          what the server checks on every protected endpoint.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(100), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships (SQLAlchemy — not extra DB columns, just Python conveniences)
    tickets_assigned = relationship("Ticket", back_populates="assignee",
                                    foreign_keys="Ticket.assignee_id")
    tickets_created = relationship("Ticket", back_populates="creator",
                                   foreign_keys="Ticket.created_by")
    replies = relationship("Reply", back_populates="author")
    events = relationship("TicketEvent", back_populates="actor")
    collaborations = relationship("Collaborator", back_populates="agent")


# ─────────────────────────────────────────────
# Table 2: tickets
# ─────────────────────────────────────────────

class Ticket(Base):
    """
    The central table. One row per support ticket.
    
    SLA fields explained:
      response_due_at        — set at creation based on priority
                               Critical=1h, High=4h, Medium=8h, Low=24h
      pending_since          — timestamp when ticket entered 'pending' status.
                               NULL if not currently pending.
      total_paused_seconds   — cumulative seconds the clock was paused.
                               Every time we leave 'pending', we add the
                               duration of that pause to this column.
    
    Effective SLA deadline = response_due_at + total_paused_seconds
    Remaining time = effective_deadline - now()
    
    archived: soft-delete. Hides from queues but history is preserved.
    closed_at: timestamp when closed. Used to enforce the 7-day reopen window.
    """
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String(500), nullable=False)
    description = Column(Text, nullable=False)
    requester_name = Column(String(200), nullable=False)
    priority = Column(Enum(TicketPriority), nullable=False, default=TicketPriority.medium)
    category = Column(Enum(TicketCategory), nullable=False)
    status = Column(Enum(TicketStatus), nullable=False, default=TicketStatus.new)

    # Foreign keys
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow, nullable=False)
    closed_at = Column(DateTime, nullable=True)

    # SLA columns
    response_due_at = Column(DateTime, nullable=True)
    pending_since = Column(DateTime, nullable=True)
    total_paused_seconds = Column(Float, default=0.0, nullable=False)

    # Soft delete
    archived = Column(Boolean, default=False, nullable=False)

    # Relationships
    assignee = relationship("User", back_populates="tickets_assigned",
                            foreign_keys=[assignee_id])
    creator = relationship("User", back_populates="tickets_created",
                           foreign_keys=[created_by])
    replies = relationship("Reply", back_populates="ticket",
                           order_by="Reply.created_at")
    events = relationship("TicketEvent", back_populates="ticket",
                          order_by="TicketEvent.created_at")
    collaborators = relationship("Collaborator", back_populates="ticket")


# ─────────────────────────────────────────────
# Table 3: replies
# ─────────────────────────────────────────────

class Reply(Base):
    """
    Every message inside a ticket — both customer-visible replies and
    internal agent notes.
    
    is_internal: True  → amber background in UI, only agents see it
                 False → normal, customer can see it (in a real system
                         this would be emailed to the customer)
    
    IMPORTANT: This table is append-only. No UPDATE or DELETE ever.
    The assignment explicitly requires this.
    """
    __tablename__ = "replies"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    ticket = relationship("Ticket", back_populates="replies")
    author = relationship("User", back_populates="replies")


# ─────────────────────────────────────────────
# Table 4: ticket_events (IMMUTABLE AUDIT LOG)
# ─────────────────────────────────────────────

class TicketEvent(Base):
    """
    The immutable timeline. Every single thing that happens to a ticket
    writes a row here.
    
    RULE: This table NEVER gets UPDATE or DELETE operations.
    Not even supervisors can modify it.
    
    event_type: what happened (status_changed, reassigned, reply_added, etc.)
    old_value:  what it was before (e.g., "open" for a status change)
    new_value:  what it became (e.g., "pending")
    actor_id:   who did it
    
    The GET /tickets/{id}/events endpoint returns these in created_at order,
    read-only, forever.
    """
    __tablename__ = "ticket_events"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    event_type = Column(Enum(EventType), nullable=False)
    old_value = Column(String(500), nullable=True)
    new_value = Column(String(500), nullable=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    ticket = relationship("Ticket", back_populates="events")
    actor = relationship("User", back_populates="events")


# ─────────────────────────────────────────────
# Table 5: collaborators (join table)
# ─────────────────────────────────────────────

class Collaborator(Base):
    """
    Many-to-many relationship between tickets and agents.
    
    One ticket can have many collaborators.
    One agent can collaborate on many tickets.
    
    The composite primary key (ticket_id + agent_id) ensures an agent
    can't be added as collaborator twice on the same ticket.
    
    Note: The primary assignee is NOT stored here — that's assignee_id
    on the tickets table. Collaborators are the additional helpers.
    """
    __tablename__ = "collaborators"

    ticket_id = Column(Integer, ForeignKey("tickets.id"), primary_key=True)
    agent_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    added_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    ticket = relationship("Ticket", back_populates="collaborators")
    agent = relationship("User", back_populates="collaborations")


# ─────────────────────────────────────────────
# Table 6: sla_alerts
# ─────────────────────────────────────────────

class SlaAlert(Base):
    """
    Tracks which agents have acknowledged SLA breach alerts.
    
    Why a separate table and not just a flag on tickets?
    Because the alert must RE-FIRE if a ticket is reopened and breaches again.
    A single boolean on tickets can't capture "acknowledged for THIS breach,
    but should reappear for a FUTURE breach."
    
    Logic:
      - When a ticket breaches SLA → check if an unacknowledged alert exists
        If not, create one.
      - Agent acknowledges → acknowledged = True
      - Ticket is reopened → if it breaches again later, create a NEW alert row
        (or reset acknowledged = False on the existing one)
    
    The assignment explicitly calls out: "If the ticket is later reopened
    and breaches again → alert reappears." This table makes that clean.
    """
    __tablename__ = "sla_alerts"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False,
                       unique=True)
    acknowledged = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    acknowledged_at = Column(DateTime, nullable=True)