"""
routers/alerts.py — SLA Alert Endpoints

Three endpoints:
  GET  /alerts/count              — badge count for nav bell (both roles)
  GET  /alerts                    — full alerts list page (role-filtered)
  POST /alerts/{ticket_id}/acknowledge — agent dismisses an alert (own tickets only)

ALERT THRESHOLDS:
  Red    → already breached (remaining < 0 seconds)
  Yellow → within 1 hour of breaching (remaining < 3600 seconds)

ROLE FILTERING:
  Supervisor → sees ALL breaching/about-to-breach tickets
  Agent      → sees ONLY their own tickets (assignee OR collaborator)

ACKNOWLEDGE LOGIC (assignment requirement):
  - Agent clicks Acknowledge on a card → alert is dismissed (acknowledged=True)
  - If the ticket is later reopened AND breaches SLA again → alert reappears
  - This is why we use a separate sla_alerts table instead of a flag on tickets:
    a ticket can be acknowledged, then re-opened, then breach again — we need
    a NEW alert row, not a stale boolean.

SUPERVISOR ALERTS:
  Supervisors see all alerts but do NOT have an acknowledge button.
  They use the full queue to manage tickets.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel

from ..database import get_db
from ..models import Ticket, TicketStatus, Collaborator, User, UserRole, SlaAlert
from ..auth import get_current_user

router = APIRouter(prefix="/alerts", tags=["alerts"])


# ─────────────────────────────────────────────
# Response schema (inline — no need to add to schemas.py)
# ─────────────────────────────────────────────

class AlertItem(BaseModel):
    """One alert card returned to the frontend."""
    ticket_id: int
    subject: str
    priority: str
    status: str
    assignee_name: Optional[str]
    sla_remaining_seconds: float
    severity: str           # "red" or "yellow"
    acknowledged: bool      # only relevant for agents


# ─────────────────────────────────────────────
# Shared helper: compute SLA remaining
# ─────────────────────────────────────────────

def compute_sla_remaining(ticket: Ticket) -> Optional[float]:
    """
    Calculates seconds remaining before SLA breach.
    Positive = time left. Negative = already breached.
    Returns None if no deadline set.

    We duplicate this from tickets.py intentionally rather than sharing —
    alerts.py needs to stay independently deployable/testable without
    importing from the tickets router.
    """
    if not ticket.response_due_at:
        return None

    # If currently pending, ongoing pause time hasn't been committed yet
    current_pause = 0.0
    if ticket.status == TicketStatus.pending and ticket.pending_since:
        current_pause = (datetime.utcnow() - ticket.pending_since).total_seconds()

    total_paused = ticket.total_paused_seconds + current_pause
    effective_deadline = ticket.response_due_at + timedelta(seconds=total_paused)
    return (effective_deadline - datetime.utcnow()).total_seconds()


def build_alert_query(db: Session, current_user: User):
    """
    Returns a query for active tickets that could have SLA alerts.
    Used by both /count and /alerts endpoints so filtering is consistent.

    Active = not archived, not closed, not resolved, has an SLA deadline.
    """
    query = db.query(Ticket).filter(
        Ticket.archived == False,
        Ticket.status.notin_([TicketStatus.closed, TicketStatus.resolved]),
        Ticket.response_due_at.isnot(None),
    )

    # Agents only see their own tickets
    if current_user.role == UserRole.agent:
        collab_ticket_ids = db.query(Collaborator.ticket_id).filter(
            Collaborator.agent_id == current_user.id
        ).subquery()

        query = query.filter(
            (Ticket.assignee_id == current_user.id) |
            (Ticket.id.in_(collab_ticket_ids))
        )

    return query


# ─────────────────────────────────────────────
# GET /alerts/count — badge count for nav bell
# ─────────────────────────────────────────────

@router.get("/count")
def get_alert_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns count of tickets breaching or within 1 hour of breach.
    Used by both navs to show the red badge number on the bell icon.

    For AGENTS: only counts unacknowledged alerts on their own tickets.
    For SUPERVISORS: counts all breaching tickets (no acknowledgement concept).
    """
    tickets = build_alert_query(db, current_user).all()

    alert_count = 0

    for ticket in tickets:
        remaining = compute_sla_remaining(ticket)
        if remaining is None or remaining >= 3600:
            continue  # not an alert yet

        # For agents: check if this alert has been acknowledged
        if current_user.role == UserRole.agent:
            existing_alert = db.query(SlaAlert).filter(
                SlaAlert.ticket_id == ticket.id,
                SlaAlert.acknowledged == True,
            ).first()
            if existing_alert:
                continue  # agent already acknowledged — don't count it

        alert_count += 1

    return {"count": alert_count}


# ─────────────────────────────────────────────
# GET /alerts — Full alerts list page
# ─────────────────────────────────────────────

@router.get("", response_model=List[AlertItem])
def get_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns all currently-breaching or about-to-breach alerts.

    SUPERVISOR: sees all, no acknowledge concept, sorted red first then yellow.
    AGENT: sees only their own tickets, acknowledged ones are hidden.

    Each item includes severity ("red" or "yellow") and acknowledged status
    so the frontend can render the correct card color and button.
    """
    tickets = build_alert_query(db, current_user).all()

    result = []

    for ticket in tickets:
        remaining = compute_sla_remaining(ticket)
        if remaining is None or remaining >= 3600:
            continue  # not an alert

        # Determine severity
        severity = "red" if remaining < 0 else "yellow"

        # Check acknowledgement state from sla_alerts table
        alert_row = db.query(SlaAlert).filter(
            SlaAlert.ticket_id == ticket.id
        ).first()

        acknowledged = alert_row.acknowledged if alert_row else False

        # For agents: skip acknowledged alerts (they're dismissed)
        if current_user.role == UserRole.agent and acknowledged:
            continue

        result.append(AlertItem(
            ticket_id=ticket.id,
            subject=ticket.subject,
            priority=ticket.priority.value if ticket.priority else "medium",
            status=ticket.status.value if ticket.status else "open",
            assignee_name=ticket.assignee.name if ticket.assignee else None,
            sla_remaining_seconds=remaining,
            severity=severity,
            acknowledged=acknowledged,
        ))

    # Sort: red (breached) first, then yellow, then by how far gone they are
    result.sort(key=lambda a: a.sla_remaining_seconds)

    return result


# ─────────────────────────────────────────────
# POST /alerts/{ticket_id}/acknowledge — Agent dismisses an alert
# ─────────────────────────────────────────────

@router.post("/{ticket_id}/acknowledge")
def acknowledge_alert(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Marks an SLA alert as acknowledged so it disappears from the agent's list.

    RULES:
    - Only agents can acknowledge (supervisors manage via ticket queue)
    - Agent can only acknowledge alerts on their own tickets
    - If acknowledged=True already, silently succeed (idempotent)

    RE-FIRE LOGIC (assignment requirement):
    When a ticket is reopened and breaches SLA again, the tickets.py
    status change code will reset acknowledged=False on the sla_alerts row.
    This endpoint only sets it to True — the reset happens in the status change.
    """
    if current_user.role != UserRole.agent:
        raise HTTPException(status_code=403, detail="Only agents can acknowledge alerts")

    # Check ticket exists
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Check this agent has access to this ticket
    is_assignee = ticket.assignee_id == current_user.id
    is_collab = db.query(Collaborator).filter(
        Collaborator.ticket_id == ticket_id,
        Collaborator.agent_id == current_user.id,
    ).first() is not None

    if not is_assignee and not is_collab:
        raise HTTPException(
            status_code=403,
            detail="You can only acknowledge alerts on your own tickets"
        )

    # Upsert into sla_alerts: create the row if it doesn't exist, then set acknowledged=True
    alert_row = db.query(SlaAlert).filter(SlaAlert.ticket_id == ticket_id).first()

    if alert_row:
        # Already exists — just set acknowledged
        alert_row.acknowledged = True
        alert_row.acknowledged_at = datetime.utcnow()
    else:
        # First time this ticket has been acknowledged — create the row
        alert_row = SlaAlert(
            ticket_id=ticket_id,
            acknowledged=True,
            acknowledged_at=datetime.utcnow(),
        )
        db.add(alert_row)

    db.commit()
    return {"success": True, "message": "Alert acknowledged"}