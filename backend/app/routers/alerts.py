"""
routers/alerts.py — SLA Alert Endpoints

For now, just one endpoint: GET /alerts/count
Returns how many tickets are currently breaching or about to breach SLA.

This powers the red badge on the bell icon in both navs.

WHY COMPUTE DYNAMICALLY (not from sla_alerts table)?
The sla_alerts table is for tracking acknowledgements — whether an agent
has dismissed a specific alert. For the badge COUNT, we compute live from
the tickets table because:
  1. sla_alerts might not have rows for every breaching ticket yet
  2. The count should always reflect the real current state
  3. It's one SQL query — not expensive

ALERT THRESHOLDS:
  Red   → already breached (sla_remaining_seconds < 0)
  Yellow → within 1 hour of breaching (sla_remaining_seconds < 3600)

Badge count = Red + Yellow (total tickets needing attention)

ROLE FILTERING:
  Supervisor → all tickets in the system
  Agent → only tickets where they are assignee OR collaborator
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List

from ..database import get_db
from ..models import Ticket, TicketStatus, Collaborator, User, UserRole
from ..auth import get_current_user

router = APIRouter(prefix="/alerts", tags=["alerts"])


def compute_sla_remaining(ticket: Ticket) -> float | None:
    """
    Same helper as in tickets.py — calculates seconds remaining before SLA breach.
    Positive = time left. Negative = already breached.
    Returns None if no deadline set.
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


@router.get("/count")
def get_alert_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns the count of tickets that are breaching or about to breach SLA.
    Used by both nav bars to show the red badge number on the bell icon.

    Only counts tickets that are:
      - Not archived
      - Not closed or resolved (SLA clock is stopped for those)
      - Currently breaching (< 0 seconds) OR within 1 hour (< 3600 seconds)

    Supervisor: sees count across ALL tickets
    Agent: sees count only for their own tickets (assignee or collaborator)
    """
    # Base query — active tickets only (SLA is irrelevant for closed/resolved)
    query = db.query(Ticket).filter(
        Ticket.archived == False,
        Ticket.status.notin_([TicketStatus.closed, TicketStatus.resolved]),
        Ticket.response_due_at.isnot(None),  # must have an SLA deadline
    )

    # Role-based filtering
    if current_user.role == UserRole.agent:
        collab_ticket_ids = db.query(Collaborator.ticket_id).filter(
            Collaborator.agent_id == current_user.id
        ).subquery()

        query = query.filter(
            (Ticket.assignee_id == current_user.id) |
            (Ticket.id.in_(collab_ticket_ids))
        )

    tickets = query.all()

    # Now compute SLA remaining for each and count those needing attention
    # Threshold: within 1 hour (3600 seconds) — covers both yellow and red
    alert_count = 0
    for ticket in tickets:
        remaining = compute_sla_remaining(ticket)
        if remaining is not None and remaining < 3600:
            alert_count += 1

    return {"count": alert_count}