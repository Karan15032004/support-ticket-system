"""
routers/tickets.py — All Ticket-Related API Endpoints

This file handles everything about tickets:
  - Creating tickets
  - Listing tickets (with basic filtering for Phase 2; full server-side search in Phase 3)
  - Getting a single ticket
  - Updating ticket fields
  - Changing ticket status (with lifecycle validation)
  - Adding/getting replies
  - Getting the event timeline
  - Adding/removing collaborators

HOW ROUTERS WORK IN FASTAPI:
  Instead of putting ALL routes in main.py (which would become huge),
  we split them into "routers" — each router is a mini-app for one topic.
  This file handles /tickets/* endpoints.
  main.py will "include" this router with: app.include_router(tickets_router)

SLA LOGIC (important — understand this):
  When a ticket is created:
    response_due_at = created_at + SLA target (based on priority)

  When ticket → Pending:
    pending_since = now()   ← record when we entered pending

  When ticket leaves Pending → Open:
    total_paused_seconds += (now() - pending_since).total_seconds()
    pending_since = None    ← clear the pending marker

  Effective remaining = (response_due_at + timedelta(seconds=total_paused_seconds)) - now()
  Negative = already breached.

LEGAL STATUS TRANSITIONS:
  new      → open, pending
  open     → pending, resolved
  pending  → open, resolved
  resolved → closed, open (reopen — within 7 days only)
  closed   → open (reopen — within 7 days only, server checks)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional

from ..database import get_db
from ..models import (
    Ticket, TicketEvent, Reply, Collaborator, User,
    TicketStatus, TicketPriority, EventType, UserRole
)
from ..schemas import (
    TicketCreate, TicketUpdate, TicketResponse, TicketListResponse,
    StatusChangeRequest, ReplyCreate, ReplyResponse,
    TicketEventResponse, CollaboratorAdd, CollaboratorResponse,
    UserBriefResponse
)
from ..auth import get_current_user

router = APIRouter(prefix="/tickets", tags=["tickets"])


# ─────────────────────────────────────────────
# Helper: SLA target in hours based on priority
# ─────────────────────────────────────────────

SLA_HOURS = {
    TicketPriority.critical: 1,
    TicketPriority.high: 4,
    TicketPriority.medium: 8,
    TicketPriority.low: 24,
}


def compute_sla_remaining(ticket: Ticket) -> Optional[float]:
    """
    Calculate how many seconds are left before this ticket breaches SLA.
    
    Returns:
      Positive number → seconds remaining (SLA not yet breached)
      Negative number → seconds PAST the deadline (already breached)
      None → no deadline set (ticket has no response_due_at)
    
    Why do we add total_paused_seconds?
    Because the clock was paused while the ticket was in "Pending" status.
    Those paused seconds are "free time" — they don't count against the agent.
    So we extend the deadline by that amount.
    
    Example:
      response_due_at = 1:00 PM
      total_paused_seconds = 3600 (1 hour of pending time)
      effective_deadline = 2:00 PM
      now = 1:30 PM
      remaining = 30 minutes = 1800 seconds
    """
    if not ticket.response_due_at:
        return None

    # If currently pending, we need to account for the ongoing pause too
    current_pause = 0.0
    if ticket.status == TicketStatus.pending and ticket.pending_since:
        current_pause = (datetime.utcnow() - ticket.pending_since).total_seconds()

    total_paused = ticket.total_paused_seconds + current_pause
    effective_deadline = ticket.response_due_at + timedelta(seconds=total_paused)
    remaining = (effective_deadline - datetime.utcnow()).total_seconds()
    return remaining


def ticket_to_response(ticket: Ticket) -> TicketResponse:
    """
    Convert a SQLAlchemy Ticket object into a TicketResponse Pydantic object.
    
    We do this manually (instead of automatic conversion) because we need
    to add the computed 'sla_remaining_seconds' field which doesn't exist
    in the database — it's calculated on the fly.
    
    Think of this as: database object → API-safe JSON-ready object
    """
    return TicketResponse(
        id=ticket.id,
        subject=ticket.subject,
        description=ticket.description,
        requester_name=ticket.requester_name,
        priority=ticket.priority,
        category=ticket.category,
        status=ticket.status,
        assignee_id=ticket.assignee_id,
        assignee=UserBriefResponse(
            id=ticket.assignee.id,
            name=ticket.assignee.name,
            email=ticket.assignee.email,
            role=ticket.assignee.role
        ) if ticket.assignee else None,
        created_by=ticket.created_by,
        creator=UserBriefResponse(
            id=ticket.creator.id,
            name=ticket.creator.name,
            email=ticket.creator.email,
            role=ticket.creator.role
        ) if ticket.creator else None,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        closed_at=ticket.closed_at,
        response_due_at=ticket.response_due_at,
        total_paused_seconds=ticket.total_paused_seconds,
        archived=ticket.archived,
        sla_remaining_seconds=compute_sla_remaining(ticket),
    )


# ─────────────────────────────────────────────
# LEGAL STATUS TRANSITIONS MAP
# ─────────────────────────────────────────────

LEGAL_TRANSITIONS = {
    TicketStatus.new: [TicketStatus.open, TicketStatus.pending],
    TicketStatus.open: [TicketStatus.pending, TicketStatus.resolved],
    TicketStatus.pending: [TicketStatus.open, TicketStatus.resolved],
    TicketStatus.resolved: [TicketStatus.closed, TicketStatus.open],
    TicketStatus.closed: [TicketStatus.open],  # reopen, but 7-day check happens separately
}


# ─────────────────────────────────────────────
# Helper: Can this user act on this ticket?
# ─────────────────────────────────────────────

def can_user_act_on_ticket(ticket: Ticket, user: User, db: Session) -> bool:
    """
    Agents can only act on tickets where they are:
      a) the primary assignee, OR
      b) a collaborator
    
    Supervisors can act on ANY ticket.
    
    Returns True if allowed, False if not.
    """
    if user.role == UserRole.supervisor:
        return True

    # Check if agent is the assignee
    if ticket.assignee_id == user.id:
        return True

    # Check if agent is a collaborator
    collab = db.query(Collaborator).filter(
        Collaborator.ticket_id == ticket.id,
        Collaborator.agent_id == user.id
    ).first()
    return collab is not None


# ─────────────────────────────────────────────
# POST /tickets — Create a new ticket
# ─────────────────────────────────────────────

@router.post("/", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(
    data: TicketCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates a new ticket.
    
    What this endpoint does, step by step:
    1. Calculate response_due_at based on priority
    2. Create the Ticket row in the database
    3. Write a 'ticket_created' event to ticket_events (immutable log)
    4. Return the created ticket
    
    Who can call this: Any logged-in user (supervisor or agent).
    """
    # Step 1: Calculate the SLA deadline
    # timedelta(hours=X) creates a time duration object
    sla_hours = SLA_HOURS[data.priority]
    response_due_at = datetime.utcnow() + timedelta(hours=sla_hours)

    # Step 2: Create the ticket
    ticket = Ticket(
        subject=data.subject,
        description=data.description,
        requester_name=data.requester_name,
        priority=data.priority,
        category=data.category,
        assignee_id=data.assignee_id,
        created_by=current_user.id,
        status=TicketStatus.new,
        response_due_at=response_due_at,
        total_paused_seconds=0.0,
    )
    db.add(ticket)
    db.flush()  # flush writes to DB but doesn't commit yet — this gives us ticket.id

    # Step 3: Log the creation event (immutable — never deleted)
    event = TicketEvent(
        ticket_id=ticket.id,
        event_type=EventType.ticket_created,
        old_value=None,
        new_value=ticket.subject,
        actor_id=current_user.id,
    )
    db.add(event)

    # Step 4: Commit everything at once
    # If anything fails above, db.rollback() is called automatically
    db.commit()
    db.refresh(ticket)

    return ticket_to_response(ticket)


# ─────────────────────────────────────────────
# GET /tickets — List tickets
# ─────────────────────────────────────────────

@router.get("/", response_model=TicketListResponse)
def list_tickets(
    page: int = 1,
    page_size: int = 20,
    status: Optional[TicketStatus] = None,
    priority: Optional[TicketPriority] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns a paginated list of tickets.
    
    Phase 2: Basic filtering (status, priority) + pagination.
    Phase 3: Will add search, all filters, sorting — all in SQL.
    
    IMPORTANT: Pagination happens IN THE DATABASE (LIMIT/OFFSET),
    not in Python. We never load all tickets into memory.
    
    Role-based filtering:
      Supervisor: sees ALL tickets (except archived)
      Agent: only sees tickets where they are assignee OR collaborator
    
    Query params:
      page      → which page (starts at 1)
      page_size → how many per page (default 20)
      status    → filter by status (optional)
      priority  → filter by priority (optional)
    """
    # Start building the query — we'll add filters step by step
    query = db.query(Ticket).filter(Ticket.archived == False)

    # Role-based filtering
    if current_user.role == UserRole.agent:
        # Agent sees tickets where they are assignee OR collaborator
        # This is an OR condition across two tables
        collab_ticket_ids = db.query(Collaborator.ticket_id).filter(
            Collaborator.agent_id == current_user.id
        ).subquery()

        query = query.filter(
            (Ticket.assignee_id == current_user.id) |
            (Ticket.id.in_(collab_ticket_ids))
        )

    # Apply optional filters
    if status:
        query = query.filter(Ticket.status == status)
    if priority:
        query = query.filter(Ticket.priority == priority)

    # Count BEFORE applying pagination (needed for "X of Y" display)
    total_count = query.count()

    # Apply pagination: skip (page-1)*page_size rows, take page_size rows
    offset = (page - 1) * page_size
    tickets = (
        query
        .order_by(Ticket.updated_at.desc())  # newest activity first
        .offset(offset)
        .limit(page_size)
        .all()
    )

    return TicketListResponse(
        tickets=[ticket_to_response(t) for t in tickets],
        total_count=total_count,
        page=page,
        page_size=page_size,
    )


# ─────────────────────────────────────────────
# GET /tickets/{ticket_id} — Get a single ticket
# ─────────────────────────────────────────────

@router.get("/{ticket_id}", response_model=TicketResponse)
def get_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns full details for one ticket.
    
    Access control:
      Supervisor: can see any ticket
      Agent: can only see tickets they are assignee or collaborator on
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Check access for agents
    if not can_user_act_on_ticket(ticket, current_user, db):
        raise HTTPException(
            status_code=403,
            detail="You don't have access to this ticket"
        )

    return ticket_to_response(ticket)


# ─────────────────────────────────────────────
# PUT /tickets/{ticket_id} — Update ticket fields
# ─────────────────────────────────────────────

@router.put("/{ticket_id}", response_model=TicketResponse)
def update_ticket(
    ticket_id: int,
    data: TicketUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates editable fields of a ticket (subject, description, priority, etc.)
    Does NOT handle status changes — that's PUT /tickets/{id}/status.
    
    Access control:
      Supervisor: can edit any ticket, including reassigning to any agent
      Agent: can edit tickets they're on, but CANNOT reassign (change assignee_id)
    
    Only non-None fields in the request body get updated.
    This is a "partial update" — send only what you want to change.
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if not can_user_act_on_ticket(ticket, current_user, db):
        raise HTTPException(status_code=403, detail="You don't have access to this ticket")

    # Agents cannot reassign tickets
    if data.assignee_id is not None and current_user.role == UserRole.agent:
        raise HTTPException(
            status_code=403,
            detail="Agents cannot reassign tickets. Only supervisors can do this."
        )

    # Track if assignee changed (for event logging)
    old_assignee_id = ticket.assignee_id

    # Update only the fields that were actually sent (not None)
    if data.subject is not None:
        ticket.subject = data.subject
    if data.description is not None:
        ticket.description = data.description
    if data.requester_name is not None:
        ticket.requester_name = data.requester_name
    if data.priority is not None:
        old_priority = ticket.priority
        ticket.priority = data.priority
        # If priority changed, recalculate SLA deadline
        # (keep the original creation time, just change the duration)
        sla_hours = SLA_HOURS[data.priority]
        ticket.response_due_at = ticket.created_at + timedelta(hours=sla_hours)
    if data.assignee_id is not None:
        ticket.assignee_id = data.assignee_id

    ticket.updated_at = datetime.utcnow()

    # Log reassignment event if assignee changed
    if data.assignee_id is not None and data.assignee_id != old_assignee_id:
        old_agent = db.query(User).filter(User.id == old_assignee_id).first()
        new_agent = db.query(User).filter(User.id == data.assignee_id).first()
        event = TicketEvent(
            ticket_id=ticket.id,
            event_type=EventType.reassigned,
            old_value=old_agent.name if old_agent else "Unassigned",
            new_value=new_agent.name if new_agent else "Unassigned",
            actor_id=current_user.id,
        )
        db.add(event)

    db.commit()
    db.refresh(ticket)
    return ticket_to_response(ticket)


# ─────────────────────────────────────────────
# PUT /tickets/{ticket_id}/status — Change ticket status
# ─────────────────────────────────────────────

@router.put("/{ticket_id}/status", response_model=TicketResponse)
def change_ticket_status(
    ticket_id: int,
    data: StatusChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Changes the status of a ticket.
    
    This is the most complex endpoint — it:
    1. Validates the transition is legal (using LEGAL_TRANSITIONS map)
    2. Handles SLA clock pause/resume logic
    3. Handles the 7-day reopen window for closed tickets
    4. Blocks agents from directly closing tickets
    5. Logs the status change to ticket_events
    
    WHY IS THIS SEPARATE FROM PUT /tickets/{id}?
    Because status changes have complex side effects (SLA, events, validation).
    Mixing them into the generic update endpoint would be messy and error-prone.
    Separation of concerns — each endpoint has one clear responsibility.
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if not can_user_act_on_ticket(ticket, current_user, db):
        raise HTTPException(status_code=403, detail="You don't have access to this ticket")

    old_status = ticket.status
    new_status = data.new_status

    # If no change, nothing to do
    if old_status == new_status:
        return ticket_to_response(ticket)

    # ── Rule 1: Check the transition is legally allowed ──
    allowed_next = LEGAL_TRANSITIONS.get(old_status, [])
    if new_status not in allowed_next:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot transition from '{old_status.value}' to '{new_status.value}'. "
                f"Allowed transitions from '{old_status.value}': "
                f"{[s.value for s in allowed_next]}"
            )
        )

    # ── Rule 2: Agents cannot close tickets directly ──
    if new_status == TicketStatus.closed and current_user.role == UserRole.agent:
        raise HTTPException(
            status_code=403,
            detail="Agents cannot close tickets. Only supervisors can close tickets."
        )

    # ── Rule 3: 7-day reopen window ──
    if old_status == TicketStatus.closed:
        if not ticket.closed_at:
            raise HTTPException(status_code=400, detail="Ticket has no closed_at timestamp")
        days_since_closed = (datetime.utcnow() - ticket.closed_at).days
        if days_since_closed > 7:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"This ticket was closed {days_since_closed} days ago. "
                    "Tickets can only be reopened within 7 days of closing."
                )
            )

    # ── SLA Clock Logic ──
    # Entering Pending → record when we started waiting
    if new_status == TicketStatus.pending:
        ticket.pending_since = datetime.utcnow()

    # Leaving Pending → add the elapsed pause time to total
    if old_status == TicketStatus.pending and ticket.pending_since:
        paused_duration = (datetime.utcnow() - ticket.pending_since).total_seconds()
        ticket.total_paused_seconds += paused_duration
        ticket.pending_since = None  # clear the pause marker

    # ── Record closed_at when closing ──
    if new_status == TicketStatus.closed:
        ticket.closed_at = datetime.utcnow()

    # ── Apply the status change ──
    ticket.status = new_status
    ticket.updated_at = datetime.utcnow()

    # ── Log to the immutable timeline ──
    event = TicketEvent(
        ticket_id=ticket.id,
        event_type=EventType.status_changed,
        old_value=old_status.value,
        new_value=new_status.value,
        actor_id=current_user.id,
    )
    db.add(event)

    db.commit()
    db.refresh(ticket)
    return ticket_to_response(ticket)


# ─────────────────────────────────────────────
# GET /tickets/{ticket_id}/replies — Get all replies
# ─────────────────────────────────────────────

@router.get("/{ticket_id}/replies", response_model=List[ReplyResponse])
def get_replies(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns all replies for a ticket in chronological order.
    
    Access control: same as getting the ticket itself.
    Internal notes are included — the frontend decides styling.
    (In a real system, you'd filter internal notes for customer-facing views,
    but here all viewers are internal staff.)
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if not can_user_act_on_ticket(ticket, current_user, db):
        raise HTTPException(status_code=403, detail="You don't have access to this ticket")

    replies = (
        db.query(Reply)
        .filter(Reply.ticket_id == ticket_id)
        .order_by(Reply.created_at.asc())
        .all()
    )
    return replies


# ─────────────────────────────────────────────
# POST /tickets/{ticket_id}/replies — Add a reply
# ─────────────────────────────────────────────

@router.post("/{ticket_id}/replies", response_model=ReplyResponse, status_code=201)
def add_reply(
    ticket_id: int,
    data: ReplyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Adds a new reply to a ticket.
    
    Two types:
      is_internal=False → Customer-visible reply (white/normal background in UI)
      is_internal=True  → Internal note (amber background in UI, staff-only)
    
    Both are stored the same way — is_internal flag differentiates them.
    
    IMPORTANT: Replies are NEVER deleted or updated. Append-only.
    This is enforced at the application level (no update/delete endpoints exist).
    
    Also logs a 'reply_added' event to the immutable timeline.
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if not can_user_act_on_ticket(ticket, current_user, db):
        raise HTTPException(status_code=403, detail="You don't have access to this ticket")

    # Create the reply
    reply = Reply(
        ticket_id=ticket_id,
        author_id=current_user.id,
        body=data.body,
        is_internal=data.is_internal,
    )
    db.add(reply)
    db.flush()  # get reply.id before committing

    # Log the event
    reply_type = "internal note" if data.is_internal else "customer reply"
    event = TicketEvent(
        ticket_id=ticket_id,
        event_type=EventType.reply_added,
        old_value=None,
        new_value=reply_type,
        actor_id=current_user.id,
    )
    db.add(event)

    # Update ticket's updated_at
    ticket.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(reply)
    return reply


# ─────────────────────────────────────────────
# GET /tickets/{ticket_id}/events — Get the timeline
# ─────────────────────────────────────────────

@router.get("/{ticket_id}/events", response_model=List[TicketEventResponse])
def get_events(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns the immutable timeline for a ticket — every event ever.
    
    READ ONLY. There is no POST/PUT/DELETE for events.
    The only way events get created is as a side effect of other actions.
    
    Returned in chronological order (oldest first).
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if not can_user_act_on_ticket(ticket, current_user, db):
        raise HTTPException(status_code=403, detail="You don't have access to this ticket")

    events = (
        db.query(TicketEvent)
        .filter(TicketEvent.ticket_id == ticket_id)
        .order_by(TicketEvent.created_at.asc())
        .all()
    )
    return events


# ─────────────────────────────────────────────
# GET /tickets/{ticket_id}/collaborators
# ─────────────────────────────────────────────

@router.get("/{ticket_id}/collaborators", response_model=List[CollaboratorResponse])
def get_collaborators(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns all collaborators on a ticket."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if not can_user_act_on_ticket(ticket, current_user, db):
        raise HTTPException(status_code=403, detail="You don't have access to this ticket")

    return ticket.collaborators


# ─────────────────────────────────────────────
# POST /tickets/{ticket_id}/collaborators — Add collaborator
# ─────────────────────────────────────────────

@router.post("/{ticket_id}/collaborators", response_model=CollaboratorResponse, status_code=201)
def add_collaborator(
    ticket_id: int,
    data: CollaboratorAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Adds an agent as a collaborator on a ticket.
    
    Access control:
      Supervisor: can add anyone
      Agent: can add collaborators to tickets they're on (but usually supervisors do this)
    
    Prevents:
      - Adding someone who is already the primary assignee
      - Adding duplicate collaborators (DB composite PK would reject this anyway,
        but we give a better error message by checking first)
      - Adding non-agents (supervisors can't be collaborators)
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if not can_user_act_on_ticket(ticket, current_user, db):
        raise HTTPException(status_code=403, detail="You don't have access to this ticket")

    # The user being added must exist and be an agent
    agent = db.query(User).filter(User.id == data.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="User not found")
    if agent.role != UserRole.agent:
        raise HTTPException(status_code=400, detail="Only agents can be added as collaborators")

    # Can't add the primary assignee as a collaborator (redundant)
    if ticket.assignee_id == data.agent_id:
        raise HTTPException(
            status_code=400,
            detail="This agent is already the primary assignee of this ticket"
        )

    # Check if already a collaborator
    existing = db.query(Collaborator).filter(
        Collaborator.ticket_id == ticket_id,
        Collaborator.agent_id == data.agent_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="This agent is already a collaborator")

    # Add collaborator
    collab = Collaborator(ticket_id=ticket_id, agent_id=data.agent_id)
    db.add(collab)
    db.flush()

    # Log the event
    event = TicketEvent(
        ticket_id=ticket_id,
        event_type=EventType.collaborator_added,
        old_value=None,
        new_value=agent.name,
        actor_id=current_user.id,
    )
    db.add(event)

    ticket.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(collab)
    return collab


# ─────────────────────────────────────────────
# DELETE /tickets/{ticket_id}/collaborators/{agent_id}
# ─────────────────────────────────────────────

@router.delete("/{ticket_id}/collaborators/{agent_id}", status_code=204)
def remove_collaborator(
    ticket_id: int,
    agent_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Removes a collaborator from a ticket.
    Status 204 = success with no response body (standard for DELETE).
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if not can_user_act_on_ticket(ticket, current_user, db):
        raise HTTPException(status_code=403, detail="You don't have access to this ticket")

    collab = db.query(Collaborator).filter(
        Collaborator.ticket_id == ticket_id,
        Collaborator.agent_id == agent_id
    ).first()

    if not collab:
        raise HTTPException(status_code=404, detail="Collaborator not found")

    agent = db.query(User).filter(User.id == agent_id).first()

    db.delete(collab)

    # Log removal event
    event = TicketEvent(
        ticket_id=ticket_id,
        event_type=EventType.collaborator_removed,
        old_value=agent.name if agent else str(agent_id),
        new_value=None,
        actor_id=current_user.id,
    )
    db.add(event)

    ticket.updated_at = datetime.utcnow()
    db.commit()


# ─────────────────────────────────────────────
# GET /tickets/agents — Get list of agents (for dropdowns)
# ─────────────────────────────────────────────

@router.get("/meta/agents", response_model=List[UserBriefResponse])
def get_agents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns all active agents.
    
    Used by the frontend to populate:
      - The 'Assignee' dropdown when creating/editing a ticket
      - The 'Add collaborator' dropdown
    
    Why /meta/agents and not /users/agents?
    Because it's ticket-context data — who can be assigned to tickets.
    Keeping it in the tickets router avoids needing a separate users router for now.
    """
    agents = db.query(User).filter(
        User.role == UserRole.agent,
        User.is_active == True
    ).all()
    return agents