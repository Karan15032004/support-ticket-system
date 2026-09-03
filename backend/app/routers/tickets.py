"""
routers/tickets.py — All Ticket-Related API Endpoints

Phase 2 (unchanged):
  POST   /tickets/                     — Create ticket
  GET    /tickets/{id}                 — Get single ticket
  PUT    /tickets/{id}                 — Update fields
  PUT    /tickets/{id}/status          — Change status (lifecycle + SLA logic)
  GET    /tickets/{id}/replies         — Get replies
  POST   /tickets/{id}/replies         — Add reply
  GET    /tickets/{id}/events          — Immutable timeline
  GET    /tickets/{id}/collaborators   — Get collaborators
  POST   /tickets/{id}/collaborators   — Add collaborator
  DELETE /tickets/{id}/collaborators/{agent_id} — Remove collaborator
  GET    /tickets/meta/agents          — Agents list for dropdowns

Phase 3 additions:
  GET    /tickets/               — UPGRADED: ?search, ?category, ?assignee_id, ?sort, ?order
  GET    /tickets/export         — CSV download with same filters (supervisor only)
  POST   /tickets/bulk-assign    — Bulk reassign, per-ticket results (supervisor only)
  POST   /tickets/bulk-close     — Bulk close, per-ticket results (supervisor only)
  PUT    /tickets/{id}/archive   — Soft delete (supervisor only)
  PUT    /tickets/{id}/restore   — Un-archive (supervisor only)

CRITICAL ROUTE ORDERING:
  /export, /bulk-assign, /bulk-close, /meta/agents must be defined
  BEFORE /{ticket_id} — FastAPI matches top-to-bottom, so "export" would
  be treated as a ticket_id integer and fail with a 422 if defined after.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, case
from datetime import datetime, timedelta
from typing import List, Optional
import csv
import io

from ..database import get_db
from ..models import (
    Ticket, TicketEvent, Reply, Collaborator, User, SlaAlert,
    TicketStatus, TicketPriority, TicketCategory, EventType, UserRole
)
from ..schemas import (
    TicketCreate, TicketUpdate, TicketResponse, TicketListResponse,
    StatusChangeRequest, ReplyCreate, ReplyResponse,
    TicketEventResponse, CollaboratorAdd, CollaboratorResponse,
    UserBriefResponse,
    BulkAssignRequest, BulkCloseRequest, BulkResultResponse, BulkResultItem,
)
from ..auth import get_current_user

router = APIRouter(prefix="/tickets", tags=["tickets"])


# ─────────────────────────────────────────────
# SLA helpers
# ─────────────────────────────────────────────

SLA_HOURS = {
    TicketPriority.critical: 1,
    TicketPriority.high: 4,
    TicketPriority.medium: 8,
    TicketPriority.low: 24,
}


def compute_sla_remaining(ticket: Ticket) -> Optional[float]:
    """
    Seconds remaining before SLA breach.
    Positive = time left. Negative = already breached. None = no deadline.
    Accounts for time paused in Pending status (not the agent's fault).
    """
    if not ticket.response_due_at:
        return None

    current_pause = 0.0
    if ticket.status == TicketStatus.pending and ticket.pending_since:
        current_pause = (datetime.utcnow() - ticket.pending_since).total_seconds()

    total_paused = ticket.total_paused_seconds + current_pause
    effective_deadline = ticket.response_due_at + timedelta(seconds=total_paused)
    return (effective_deadline - datetime.utcnow()).total_seconds()


def ticket_to_response(ticket: Ticket) -> TicketResponse:
    """
    Converts SQLAlchemy Ticket → Pydantic TicketResponse.
    Done manually because we need to inject the computed sla_remaining_seconds
    field, which doesn't exist in the database.
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
            role=ticket.assignee.role,
        ) if ticket.assignee else None,
        created_by=ticket.created_by,
        creator=UserBriefResponse(
            id=ticket.creator.id,
            name=ticket.creator.name,
            email=ticket.creator.email,
            role=ticket.creator.role,
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
# Status transition rules
# ─────────────────────────────────────────────

LEGAL_TRANSITIONS = {
    TicketStatus.new:      [TicketStatus.open, TicketStatus.pending],
    TicketStatus.open:     [TicketStatus.pending, TicketStatus.resolved],
    TicketStatus.pending:  [TicketStatus.open, TicketStatus.resolved],
    TicketStatus.resolved: [TicketStatus.closed, TicketStatus.open],
    TicketStatus.closed:   [TicketStatus.open],
}


def can_user_act_on_ticket(ticket: Ticket, user: User, db: Session) -> bool:
    """Supervisors can act on any ticket. Agents only on their own or collaborated."""
    if user.role == UserRole.supervisor:
        return True
    if ticket.assignee_id == user.id:
        return True
    collab = db.query(Collaborator).filter(
        Collaborator.ticket_id == ticket.id,
        Collaborator.agent_id == user.id,
    ).first()
    return collab is not None


# ─────────────────────────────────────────────
# Phase 3 helpers — shared filtering + sorting
# ─────────────────────────────────────────────

def build_filtered_query(
    db: Session,
    current_user: User,
    search: Optional[str] = None,
    ticket_status: Optional[TicketStatus] = None,
    priority: Optional[TicketPriority] = None,
    category: Optional[TicketCategory] = None,
    assignee_id: Optional[int] = None,
    include_archived: bool = False,
):
    """
    Builds a SQLAlchemy query with all filters applied IN SQL.
    Shared by GET /tickets/ and GET /tickets/export so both always
    apply the exact same filters — export always matches the current view.

    WHY SHARED?
    If we duplicated the filter logic, a change in one place but not the
    other would cause the CSV to export different rows than the table shows.
    DRY (Don't Repeat Yourself) prevents that class of bug.
    """
    query = db.query(Ticket)

    if not include_archived:
        query = query.filter(Ticket.archived == False)

    # Agents only see their own tickets
    if current_user.role == UserRole.agent:
        collab_ticket_ids = db.query(Collaborator.ticket_id).filter(
            Collaborator.agent_id == current_user.id
        ).subquery()
        query = query.filter(
            (Ticket.assignee_id == current_user.id) |
            (Ticket.id.in_(collab_ticket_ids))
        )

    # SQL ILIKE = case-insensitive text search (never filter in Python)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                Ticket.subject.ilike(pattern),
                Ticket.description.ilike(pattern),
            )
        )

    if ticket_status:
        query = query.filter(Ticket.status == ticket_status)

    if priority:
        query = query.filter(Ticket.priority == priority)

    if category:
        query = query.filter(Ticket.category == category)

    if assignee_id:
        query = query.filter(Ticket.assignee_id == assignee_id)

    return query


def apply_sorting(query, sort: str = "updated_at", order: str = "desc"):
    """
    Applies ORDER BY to the query.

    Priority needs a SQL CASE expression because alphabetical order
    ('critical', 'high', 'low', 'medium') does not match severity order.
    We map: critical=1, high=2, medium=3, low=4 so sorting by this number
    gives the correct urgency ordering.
    """
    if sort == "priority":
        priority_order = case(
            (Ticket.priority == TicketPriority.critical, 1),
            (Ticket.priority == TicketPriority.high, 2),
            (Ticket.priority == TicketPriority.medium, 3),
            (Ticket.priority == TicketPriority.low, 4),
            else_=5,
        )
        query = query.order_by(
            priority_order.asc() if order == "asc" else priority_order.desc()
        )
    elif sort == "created_at":
        query = query.order_by(
            Ticket.created_at.asc() if order == "asc" else Ticket.created_at.desc()
        )
    else:
        # Default: updated_at
        query = query.order_by(
            Ticket.updated_at.asc() if order == "asc" else Ticket.updated_at.desc()
        )
    return query


# ═════════════════════════════════════════════
# IMPORTANT: Static routes BEFORE /{ticket_id}
# FastAPI matches routes top-to-bottom.
# /export, /bulk-assign, /bulk-close, /meta/agents must come first
# or FastAPI tries to parse them as integer ticket_ids and returns 422.
# ═════════════════════════════════════════════

# ─────────────────────────────────────────────
# POST /tickets/bulk-assign (Phase 3)
# ─────────────────────────────────────────────

@router.post("/bulk-assign", response_model=BulkResultResponse)
def bulk_assign_tickets(
    data: BulkAssignRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Reassigns multiple tickets to one agent in a single request.

    Does NOT fail the whole batch if one ticket can't be reassigned.
    Returns [{ticket_id, success, reason}] for every ticket so the
    frontend can show exactly what happened to each one.
    """
    if current_user.role != UserRole.supervisor:
        raise HTTPException(status_code=403, detail="Only supervisors can bulk-reassign tickets")

    new_agent = db.query(User).filter(User.id == data.assignee_id).first()
    if not new_agent:
        raise HTTPException(status_code=404, detail="Target agent not found")
    if new_agent.role != UserRole.agent:
        raise HTTPException(status_code=400, detail="Can only assign tickets to agents, not supervisors")

    results = []

    for ticket_id in data.ticket_ids:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()

        if not ticket:
            results.append(BulkResultItem(ticket_id=ticket_id, success=False,
                reason=f"Ticket #{ticket_id} not found"))
            continue

        if ticket.archived:
            results.append(BulkResultItem(ticket_id=ticket_id, success=False,
                reason=f"Ticket #{ticket_id} is archived — unarchive it first"))
            continue

        if ticket.status == TicketStatus.closed:
            results.append(BulkResultItem(ticket_id=ticket_id, success=False,
                reason=f"Ticket #{ticket_id} is closed — cannot reassign closed tickets"))
            continue

        if ticket.assignee_id == data.assignee_id:
            results.append(BulkResultItem(ticket_id=ticket_id, success=False,
                reason=f"Ticket #{ticket_id} is already assigned to {new_agent.name}"))
            continue

        old_agent = db.query(User).filter(User.id == ticket.assignee_id).first()
        old_name = old_agent.name if old_agent else "Unassigned"

        ticket.assignee_id = data.assignee_id
        ticket.updated_at = datetime.utcnow()

        db.add(TicketEvent(
            ticket_id=ticket.id,
            event_type=EventType.reassigned,
            old_value=old_name,
            new_value=new_agent.name,
            actor_id=current_user.id,
        ))

        results.append(BulkResultItem(ticket_id=ticket_id, success=True,
            reason=f"Reassigned from {old_name} to {new_agent.name}"))

    db.commit()
    return BulkResultResponse(results=results)


# ─────────────────────────────────────────────
# POST /tickets/bulk-close (Phase 3)
# ─────────────────────────────────────────────

@router.post("/bulk-close", response_model=BulkResultResponse)
def bulk_close_tickets(
    data: BulkCloseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Closes multiple tickets in one request.
    Same per-ticket result pattern as bulk-assign.
    A ticket must be in 'resolved' status to be closeable.
    """
    if current_user.role != UserRole.supervisor:
        raise HTTPException(status_code=403, detail="Only supervisors can bulk-close tickets")

    results = []

    for ticket_id in data.ticket_ids:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()

        if not ticket:
            results.append(BulkResultItem(ticket_id=ticket_id, success=False,
                reason=f"Ticket #{ticket_id} not found"))
            continue

        if ticket.archived:
            results.append(BulkResultItem(ticket_id=ticket_id, success=False,
                reason=f"Ticket #{ticket_id} is archived"))
            continue

        if ticket.status == TicketStatus.closed:
            results.append(BulkResultItem(ticket_id=ticket_id, success=False,
                reason=f"Ticket #{ticket_id} is already closed"))
            continue

        allowed_next = LEGAL_TRANSITIONS.get(ticket.status, [])
        if TicketStatus.closed not in allowed_next:
            results.append(BulkResultItem(ticket_id=ticket_id, success=False,
                reason=(f"Ticket #{ticket_id} is '{ticket.status.value}' — "
                        f"must be 'resolved' before closing")))
            continue

        ticket.status = TicketStatus.closed
        ticket.closed_at = datetime.utcnow()
        ticket.updated_at = datetime.utcnow()

        db.add(TicketEvent(
            ticket_id=ticket.id,
            event_type=EventType.status_changed,
            old_value=ticket.status.value if ticket.status else "resolved",
            new_value="closed",
            actor_id=current_user.id,
        ))

        results.append(BulkResultItem(ticket_id=ticket_id, success=True,
            reason="Closed successfully"))

    db.commit()
    return BulkResultResponse(results=results)


# ─────────────────────────────────────────────
# GET /tickets/export (Phase 3)
# ─────────────────────────────────────────────

@router.get("/export")
def export_tickets_csv(
    status: Optional[TicketStatus] = None,
    priority: Optional[TicketPriority] = None,
    category: Optional[TicketCategory] = None,
    assignee_id: Optional[int] = None,
    search: Optional[str] = None,
    sort: Optional[str] = "updated_at",
    order: Optional[str] = "desc",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Exports the currently-filtered ticket queue as a CSV file download.

    Uses the same build_filtered_query() helper as GET /tickets/ so the
    exported data always matches exactly what the supervisor sees on screen.
    No pagination — exports ALL matching tickets.

    WHY StreamingResponse?
    We write CSV row-by-row into a StringIO buffer and stream it back.
    This is the correct pattern for file downloads in FastAPI.
    The browser receives it as a file attachment (Content-Disposition header).
    """
    if current_user.role != UserRole.supervisor:
        raise HTTPException(status_code=403, detail="Only supervisors can export tickets")

    query = build_filtered_query(
        db, current_user,
        search=search, ticket_status=status, priority=priority,
        category=category, assignee_id=assignee_id,
    )
    query = apply_sorting(query, sort=sort or "updated_at", order=order or "desc")
    tickets = query.all()

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "ID", "Subject", "Requester", "Status", "Priority", "Category",
        "Assignee", "Created At", "Updated At", "SLA Remaining (seconds)",
    ])

    for t in tickets:
        writer.writerow([
            t.id,
            t.subject,
            t.requester_name,
            t.status.value if t.status else "",
            t.priority.value if t.priority else "",
            t.category.value if t.category else "",
            t.assignee.name if t.assignee else "Unassigned",
            t.created_at.isoformat() if t.created_at else "",
            t.updated_at.isoformat() if t.updated_at else "",
            round(compute_sla_remaining(t) or 0, 0),
        ])

    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tickets_export.csv"},
    )


# ─────────────────────────────────────────────
# GET /tickets/meta/agents
# ─────────────────────────────────────────────

@router.get("/meta/agents", response_model=List[UserBriefResponse])
def get_agents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns all active agents for dropdowns (assignee, collaborator, bulk assign)."""
    return db.query(User).filter(
        User.role == UserRole.agent,
        User.is_active == True,
    ).all()


# ─────────────────────────────────────────────
# POST /tickets/ — Create ticket
# ─────────────────────────────────────────────

@router.post("/", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(
    data: TicketCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Creates a new ticket and logs a ticket_created event."""
    sla_hours = SLA_HOURS[data.priority]
    response_due_at = datetime.utcnow() + timedelta(hours=sla_hours)

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
    db.flush()

    db.add(TicketEvent(
        ticket_id=ticket.id,
        event_type=EventType.ticket_created,
        old_value=None,
        new_value=ticket.subject,
        actor_id=current_user.id,
    ))

    db.commit()
    db.refresh(ticket)
    return ticket_to_response(ticket)


# ─────────────────────────────────────────────
# GET /tickets/ — List tickets (Phase 3 upgraded)
# ─────────────────────────────────────────────

@router.get("/", response_model=TicketListResponse)
def list_tickets(
    page: int = 1,
    page_size: int = 20,
    status: Optional[TicketStatus] = None,
    priority: Optional[TicketPriority] = None,
    category: Optional[TicketCategory] = None,
    assignee_id: Optional[int] = None,
    search: Optional[str] = None,
    sort: Optional[str] = "updated_at",
    order: Optional[str] = "desc",
    include_archived: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns paginated, filtered, sorted tickets.

    Phase 3 additions over Phase 2:
      ?search=      — SQL ILIKE across subject + description
      ?category=    — filter by category
      ?assignee_id= — filter by assignee
      ?sort=        — created_at | updated_at | priority
      ?order=       — asc | desc

    ALL filtering/sorting/pagination happens in SQL. Python never filters in memory.
    Response includes total_count for frontend pagination display.
    """
    query = build_filtered_query(
        db, current_user,
        search=search, ticket_status=status, priority=priority,
        category=category, assignee_id=assignee_id,
        include_archived=include_archived,
    )

    total_count = query.count()
    query = apply_sorting(query, sort=sort or "updated_at", order=order or "desc")

    offset = (page - 1) * page_size
    tickets = query.offset(offset).limit(page_size).all()

    return TicketListResponse(
        tickets=[ticket_to_response(t) for t in tickets],
        total_count=total_count,
        page=page,
        page_size=page_size,
    )


# ─────────────────────────────────────────────
# PUT /tickets/{ticket_id}/archive (Phase 3)
# ─────────────────────────────────────────────

@router.put("/{ticket_id}/archive", response_model=TicketResponse)
def archive_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Soft-deletes a ticket by setting archived=True.
    Archived tickets are hidden from all queues but data is preserved.
    Supervisors can archive any ticket. Agents can archive only their own tickets.
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Allow if supervisor OR if agent is assignee/collaborator
    if not can_user_act_on_ticket(ticket, current_user, db):
        raise HTTPException(status_code=403, detail="You don't have access to this ticket")
    
    if ticket.archived:
        raise HTTPException(status_code=400, detail="Ticket is already archived")

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.archived:
        raise HTTPException(status_code=400, detail="Ticket is already archived")

    ticket.archived = True
    ticket.updated_at = datetime.utcnow()

    db.add(TicketEvent(
        ticket_id=ticket.id,
        event_type=EventType.ticket_archived,
        old_value=None,
        new_value="archived",
        actor_id=current_user.id,
    ))

    db.commit()
    db.refresh(ticket)
    return ticket_to_response(ticket)


# ─────────────────────────────────────────────
# PUT /tickets/{ticket_id}/restore (Phase 3)
# ─────────────────────────────────────────────

@router.put("/{ticket_id}/restore", response_model=TicketResponse)
def restore_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Restores an archived ticket.
    Supervisors can restore any ticket. Agents can restore only their own tickets.
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Allow if supervisor OR if agent is assignee/collaborator
    if not can_user_act_on_ticket(ticket, current_user, db):
        raise HTTPException(status_code=403, detail="You don't have access to this ticket")
    
    if not ticket.archived:
        raise HTTPException(status_code=400, detail="Ticket is not archived")
    # ... rest of the function

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not ticket.archived:
        raise HTTPException(status_code=400, detail="Ticket is not archived")

    ticket.archived = False
    ticket.updated_at = datetime.utcnow()

    db.add(TicketEvent(
        ticket_id=ticket.id,
        event_type=EventType.ticket_restored,
        old_value="archived",
        new_value="active",
        actor_id=current_user.id,
    ))

    db.commit()
    db.refresh(ticket)
    return ticket_to_response(ticket)


# ─────────────────────────────────────────────
# GET /tickets/{ticket_id}
# ─────────────────────────────────────────────

@router.get("/{ticket_id}", response_model=TicketResponse)
def get_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not can_user_act_on_ticket(ticket, current_user, db):
        raise HTTPException(status_code=403, detail="You don't have access to this ticket")
    return ticket_to_response(ticket)


# ─────────────────────────────────────────────
# PUT /tickets/{ticket_id}
# ─────────────────────────────────────────────

@router.put("/{ticket_id}", response_model=TicketResponse)
def update_ticket(
    ticket_id: int,
    data: TicketUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not can_user_act_on_ticket(ticket, current_user, db):
        raise HTTPException(status_code=403, detail="You don't have access to this ticket")
    if data.assignee_id is not None and current_user.role == UserRole.agent:
        raise HTTPException(status_code=403, detail="Agents cannot reassign tickets")

    old_assignee_id = ticket.assignee_id

    if data.subject is not None:        ticket.subject = data.subject
    if data.description is not None:    ticket.description = data.description
    if data.requester_name is not None: ticket.requester_name = data.requester_name
    if data.priority is not None:
        ticket.priority = data.priority
        ticket.response_due_at = ticket.created_at + timedelta(hours=SLA_HOURS[data.priority])
    if data.category is not None:       ticket.category = data.category
    if data.assignee_id is not None:    ticket.assignee_id = data.assignee_id

    ticket.updated_at = datetime.utcnow()

    if data.assignee_id is not None and data.assignee_id != old_assignee_id:
        old_agent = db.query(User).filter(User.id == old_assignee_id).first()
        new_agent = db.query(User).filter(User.id == data.assignee_id).first()
        db.add(TicketEvent(
            ticket_id=ticket.id,
            event_type=EventType.reassigned,
            old_value=old_agent.name if old_agent else "Unassigned",
            new_value=new_agent.name if new_agent else "Unassigned",
            actor_id=current_user.id,
        ))

    db.commit()
    db.refresh(ticket)
    return ticket_to_response(ticket)


# ─────────────────────────────────────────────
# PUT /tickets/{ticket_id}/status
# ─────────────────────────────────────────────

@router.put("/{ticket_id}/status", response_model=TicketResponse)
def change_ticket_status(
    ticket_id: int,
    data: StatusChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Changes ticket status with full lifecycle validation:
    1. Legal transition check
    2. Agent-cannot-close rule
    3. 7-day reopen window
    4. SLA clock pause/resume
    5. Immutable event log
    6. SLA alert re-fire on reopen
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not can_user_act_on_ticket(ticket, current_user, db):
        raise HTTPException(status_code=403, detail="You don't have access to this ticket")

    old_status = ticket.status
    new_status = data.new_status

    if old_status == new_status:
        return ticket_to_response(ticket)

    allowed_next = LEGAL_TRANSITIONS.get(old_status, [])
    if new_status not in allowed_next:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot transition from '{old_status.value}' to '{new_status.value}'. "
                f"Allowed: {[s.value for s in allowed_next]}"
            ),
        )

    #if new_status == TicketStatus.closed and current_user.role == UserRole.agent:
        #raise HTTPException(status_code=403, detail="Agents cannot close tickets")

    if old_status == TicketStatus.closed:
        if not ticket.closed_at:
            raise HTTPException(status_code=400, detail="Ticket has no closed_at timestamp")
        if (datetime.utcnow() - ticket.closed_at).days > 7:
            raise HTTPException(status_code=400, detail="Cannot reopen — 7-day window has passed")

    # SLA clock: entering pending → record pause start
    if new_status == TicketStatus.pending:
        ticket.pending_since = datetime.utcnow()

    # SLA clock: leaving pending → add elapsed pause time
    if old_status == TicketStatus.pending and ticket.pending_since:
        ticket.total_paused_seconds += (datetime.utcnow() - ticket.pending_since).total_seconds()
        ticket.pending_since = None

    if new_status == TicketStatus.closed:
        ticket.closed_at = datetime.utcnow()

    ticket.status = new_status
    ticket.updated_at = datetime.utcnow()

    db.add(TicketEvent(
        ticket_id=ticket.id,
        event_type=EventType.status_changed,
        old_value=old_status.value,
        new_value=new_status.value,
        actor_id=current_user.id,
    ))

    # SLA alert re-fire: if ticket is reopened, reset any acknowledged alert
    # so it reappears if the ticket breaches SLA again
    if new_status == TicketStatus.open and old_status in [TicketStatus.closed, TicketStatus.resolved]:
        existing_alert = db.query(SlaAlert).filter(SlaAlert.ticket_id == ticket.id).first()
        if existing_alert and existing_alert.acknowledged:
            existing_alert.acknowledged = False
            existing_alert.acknowledged_at = None

    db.commit()
    db.refresh(ticket)
    return ticket_to_response(ticket)


# ─────────────────────────────────────────────
# GET /tickets/{ticket_id}/replies
# ─────────────────────────────────────────────

@router.get("/{ticket_id}/replies", response_model=List[ReplyResponse])
def get_replies(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not can_user_act_on_ticket(ticket, current_user, db):
        raise HTTPException(status_code=403, detail="You don't have access to this ticket")
    return db.query(Reply).filter(Reply.ticket_id == ticket_id).order_by(Reply.created_at.asc()).all()


# ─────────────────────────────────────────────
# POST /tickets/{ticket_id}/replies
# ─────────────────────────────────────────────

@router.post("/{ticket_id}/replies", response_model=ReplyResponse, status_code=201)
def add_reply(
    ticket_id: int,
    data: ReplyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not can_user_act_on_ticket(ticket, current_user, db):
        raise HTTPException(status_code=403, detail="You don't have access to this ticket")

    reply = Reply(ticket_id=ticket_id, author_id=current_user.id, body=data.body, is_internal=data.is_internal)
    db.add(reply)
    db.flush()

    db.add(TicketEvent(
        ticket_id=ticket_id,
        event_type=EventType.reply_added,
        old_value=None,
        new_value="internal note" if data.is_internal else "customer reply",
        actor_id=current_user.id,
    ))

    ticket.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(reply)
    return reply


# ─────────────────────────────────────────────
# GET /tickets/{ticket_id}/events
# ─────────────────────────────────────────────

@router.get("/{ticket_id}/events", response_model=List[TicketEventResponse])
def get_events(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not can_user_act_on_ticket(ticket, current_user, db):
        raise HTTPException(status_code=403, detail="You don't have access to this ticket")
    return db.query(TicketEvent).filter(TicketEvent.ticket_id == ticket_id).order_by(TicketEvent.created_at.asc()).all()


# ─────────────────────────────────────────────
# GET /tickets/{ticket_id}/collaborators
# ─────────────────────────────────────────────

@router.get("/{ticket_id}/collaborators", response_model=List[CollaboratorResponse])
def get_collaborators(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not can_user_act_on_ticket(ticket, current_user, db):
        raise HTTPException(status_code=403, detail="You don't have access to this ticket")
    return ticket.collaborators


# ─────────────────────────────────────────────
# POST /tickets/{ticket_id}/collaborators
# ─────────────────────────────────────────────

@router.post("/{ticket_id}/collaborators", response_model=CollaboratorResponse, status_code=201)
def add_collaborator(
    ticket_id: int,
    data: CollaboratorAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not can_user_act_on_ticket(ticket, current_user, db):
        raise HTTPException(status_code=403, detail="You don't have access to this ticket")

    agent = db.query(User).filter(User.id == data.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="User not found")
    if agent.role != UserRole.agent:
        raise HTTPException(status_code=400, detail="Only agents can be collaborators")
    if ticket.assignee_id == data.agent_id:
        raise HTTPException(status_code=400, detail="This agent is already the primary assignee")

    existing = db.query(Collaborator).filter(
        Collaborator.ticket_id == ticket_id,
        Collaborator.agent_id == data.agent_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="This agent is already a collaborator")

    collab = Collaborator(ticket_id=ticket_id, agent_id=data.agent_id)
    db.add(collab)
    db.flush()

    db.add(TicketEvent(
        ticket_id=ticket_id,
        event_type=EventType.collaborator_added,
        old_value=None,
        new_value=agent.name,
        actor_id=current_user.id,
    ))

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
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not can_user_act_on_ticket(ticket, current_user, db):
        raise HTTPException(status_code=403, detail="You don't have access to this ticket")

    collab = db.query(Collaborator).filter(
        Collaborator.ticket_id == ticket_id,
        Collaborator.agent_id == agent_id,
    ).first()
    if not collab:
        raise HTTPException(status_code=404, detail="Collaborator not found")

    agent = db.query(User).filter(User.id == agent_id).first()
    db.delete(collab)

    db.add(TicketEvent(
        ticket_id=ticket_id,
        event_type=EventType.collaborator_removed,
        old_value=agent.name if agent else str(agent_id),
        new_value=None,
        actor_id=current_user.id,
    ))

    ticket.updated_at = datetime.utcnow()
    db.commit()