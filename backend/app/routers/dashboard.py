"""
routers/dashboard.py — Supervisor Dashboard Endpoints

Three read-only endpoints that aggregate data from the tickets table.
Supervisor-only — agents have no need for system-wide stats.

Endpoints:
  GET /dashboard/stats   → 4 headline numbers (open, pending, resolved this week, breaching)
  GET /dashboard/weekly  → 8 weeks of resolved-ticket counts for the bar chart
  GET /dashboard/agents  → per-agent open + pending breakdown for the workload table

WHY A SEPARATE ROUTER FILE?
Keeps tickets.py focused on ticket CRUD. Dashboard is read-only aggregation —
a fundamentally different concern. Separate file = easier to find, easier to test.

WHY NOT IN tickets.py?
tickets.py already has 900+ lines. Adding stat queries there would bloat it further.
A dedicated dashboard.py router registered at /dashboard is cleaner.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from typing import List

from ..database import get_db
from ..models import Ticket, User, TicketStatus, UserRole, SlaAlert
from ..auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# ─────────────────────────────────────────────
# Supervisor guard — reused by all 3 endpoints
# ─────────────────────────────────────────────

def require_supervisor(current_user: User):
    """
    Raises 403 if the caller is not a supervisor.
    Dashboard data is system-wide — agents should not see the full picture.
    Called at the top of every dashboard endpoint.
    """
    if current_user.role != UserRole.supervisor:
        raise HTTPException(
            status_code=403,
            detail="Only supervisors can access dashboard statistics"
        )


# ─────────────────────────────────────────────
# SLA breach helper — shared between stats + alerts count
# ─────────────────────────────────────────────

def count_breaching_now(db: Session) -> int:
    """
    Counts tickets that are currently breaching SLA.

    A ticket is breaching when:
      1. It has a response_due_at deadline (i.e., priority is set)
      2. Its status is NOT pending (clock is paused when pending)
      3. Its status is NOT resolved or closed (those are done)
      4. The current time has passed the deadline
         adjusted for total_paused_seconds

    WHY COMPUTE IN PYTHON NOT SQL?
    The SLA pause logic (adding total_paused_seconds to the deadline) is
    business logic that would be complex raw SQL. Since dashboard is not
    called per-row but once per page load, loading open tickets and
    checking in Python is acceptable here. We only load non-resolved,
    non-closed, non-archived tickets — typically a small set.
    """
    # Only active tickets with SLA deadlines can be breaching
    active_statuses = [TicketStatus.new, TicketStatus.open, TicketStatus.pending]

    tickets = db.query(Ticket).filter(
        Ticket.archived == False,
        Ticket.response_due_at.isnot(None),
        Ticket.status.in_(active_statuses),
    ).all()

    now = datetime.utcnow()
    count = 0

    for ticket in tickets:
        # Don't count pending tickets — SLA clock is paused for them
        if ticket.status == TicketStatus.pending:
            continue

        # Effective deadline = original deadline + all paused time
        effective_deadline = ticket.response_due_at + timedelta(
            seconds=ticket.total_paused_seconds
        )

        # Negative remaining = breached
        if effective_deadline < now:
            count += 1

    return count


# ─────────────────────────────────────────────
# GET /dashboard/stats
# ─────────────────────────────────────────────

@router.get("/stats")
def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns 4 headline numbers for the supervisor dashboard stat cards:
      - open_count         : tickets currently in 'open' status
      - pending_count      : tickets currently in 'pending' status
      - resolved_this_week : tickets moved to 'resolved' in the last 7 days
      - breaching_now      : tickets that have exceeded their SLA deadline right now

    WHY THESE 4?
    They answer the supervisor's most urgent questions at a glance:
      "How much work is in flight?" → open + pending
      "Are we making progress?"    → resolved this week
      "Is anything on fire?"       → breaching now

    All queries exclude archived tickets — archived = effectively deleted.
    """
    require_supervisor(current_user)

    # Count open tickets (non-archived)
    open_count = db.query(func.count(Ticket.id)).filter(
        Ticket.archived == False,
        Ticket.status == TicketStatus.open,
    ).scalar() or 0

    # Count pending tickets (non-archived)
    pending_count = db.query(func.count(Ticket.id)).filter(
        Ticket.archived == False,
        Ticket.status == TicketStatus.pending,
    ).scalar() or 0

    # Count tickets resolved in the last 7 days
    # We look at updated_at because that's when the status change happened.
    # A ticket is "resolved this week" if it's currently resolved AND
    # its updated_at falls within the last 7 days.
    one_week_ago = datetime.utcnow() - timedelta(days=7)
    resolved_this_week = db.query(func.count(Ticket.id)).filter(
        Ticket.archived == False,
        Ticket.status == TicketStatus.resolved,
        Ticket.updated_at >= one_week_ago,
    ).scalar() or 0

    # Count SLA breaches using our shared helper
    breaching_now = count_breaching_now(db)

    return {
        "open_count": open_count,
        "pending_count": pending_count,
        "resolved_this_week": resolved_this_week,
        "breaching_now": breaching_now,
    }


# ─────────────────────────────────────────────
# GET /dashboard/weekly
# ─────────────────────────────────────────────

@router.get("/weekly")
def get_weekly_resolved(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns 8 data points for the Recharts bar chart — one per week.
    Each point = how many tickets were resolved in that calendar week.

    WHY 8 WEEKS?
    8 weeks = 2 months — enough to show a trend without overwhelming the chart.
    The assignment spec says "8-week bar chart of resolved tickets."

    HOW IT WORKS:
    We build 8 weekly buckets going backward from today.
    For each bucket, we count tickets whose updated_at falls in that range
    AND whose status is currently 'resolved' or 'closed'.

    Note: We count 'resolved' AND 'closed' because a ticket resolved in
    week 3 may have been closed by week 5 — we still want to credit week 3.
    We use updated_at as the proxy for "when it was resolved."

    LIMITATION: updated_at changes every time the ticket is touched, so if
    a resolved ticket is edited, it would shift weeks. A production system
    would add a resolved_at timestamp. For this assignment, updated_at is
    sufficient and matches the schema we already have.

    Response format: [{week: "Week 1", label: "28 Jul", resolved: 4}, ...]
    Week 1 = oldest, Week 8 = most recent (right side of chart = now).
    """
    require_supervisor(current_user)

    now = datetime.utcnow()
    weeks = []

    # Build 8 buckets, oldest first so the chart reads left→right = past→present
    for i in range(7, -1, -1):
        # Each bucket is a Mon–Sun week ending i weeks ago
        week_end   = now - timedelta(weeks=i)
        week_start = week_end - timedelta(weeks=1)

        # Count tickets resolved or closed in this window
        count = db.query(func.count(Ticket.id)).filter(
            Ticket.archived == False,
            Ticket.status.in_([TicketStatus.resolved, TicketStatus.closed]),
            Ticket.updated_at >= week_start,
            Ticket.updated_at < week_end,
        ).scalar() or 0

        # Label: "28 Jul" style — the start date of the week
        label = week_start.strftime("%d %b").lstrip("0") or week_start.strftime("%d %b")

        weeks.append({
            "week": f"Wk {8 - i}",   # "Wk 1" … "Wk 8"
            "label": label,           # e.g. "28 Jul" — shown as X-axis tick
            "resolved": count,
        })

    return weeks


# ─────────────────────────────────────────────
# GET /dashboard/agents
# ─────────────────────────────────────────────

@router.get("/agents")
def get_agent_workload(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns a breakdown of each agent's current workload:
      - how many open tickets they have
      - how many pending tickets they have

    Used for the agent workload table at the bottom of the dashboard.
    Supervisors use this to spot overloaded agents and rebalance.

    HOW IT WORKS:
    We fetch all agents first, then for each agent run two COUNT queries.
    The total number of agents is small (typically <20) so N+2 queries
    is acceptable — this is not a hot path called per-row.

    A production system would do this in a single GROUP BY query, but
    that's harder to read and the performance difference is irrelevant here.

    Response format:
      [{agent_id, agent_name, open_count, pending_count}, ...]
    Sorted by (open + pending) descending so the busiest agents appear first.
    """
    require_supervisor(current_user)

    # Get all active agents
    agents = db.query(User).filter(
        User.role == UserRole.agent,
        User.is_active == True,
    ).order_by(User.name).all()

    result = []

    for agent in agents:
        # Count open tickets assigned to this agent
        open_count = db.query(func.count(Ticket.id)).filter(
            Ticket.archived == False,
            Ticket.assignee_id == agent.id,
            Ticket.status == TicketStatus.open,
        ).scalar() or 0

        # Count pending tickets assigned to this agent
        pending_count = db.query(func.count(Ticket.id)).filter(
            Ticket.archived == False,
            Ticket.assignee_id == agent.id,
            Ticket.status == TicketStatus.pending,
        ).scalar() or 0

        result.append({
            "agent_id":     agent.id,
            "agent_name":   agent.name,
            "open_count":   open_count,
            "pending_count": pending_count,
            "total":        open_count + pending_count,  # used for sorting
        })

    # Sort busiest agents first — supervisor needs to see who's overloaded
    result.sort(key=lambda x: x["total"], reverse=True)

    # Remove the 'total' helper field — frontend doesn't need it
    for item in result:
        del item["total"]

    return result