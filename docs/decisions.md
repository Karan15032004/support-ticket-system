# Engineering Decisions — SupportHub

This file documents the significant technical and logical decisions made during the project — what was chosen, what was rejected, why, and in a few cases, what got reversed. Decisions are documented in roughly the order they were made across the build.

---

## Decision 1 — Don't Reuse a Friend's Existing Codebase

**When:** Before any code was written,in the planning and problem understanding phase.

**What was considered:** A friend had built a ticket management system (TicketMind) using FastAPI and Supabase. The initial idea was to use it as a starting point since the domain sounded similar.

**What was decided:** Build from scratch. The only things worth carrying over were the idea of using Supabase for the database and FastAPI for the backend.

**Why:** After going through TicketMind's README properly, it turned out to be a fundamentally different product — an AI-automated resolution system built on LangGraph, ChromaDB, RAG, and Streamlit. It had maybe 2 of 10 required features.Streamlit is also a Python data science dashboard tool — not a role-based web application framework. Adapting it for this assignment would have taken longer than starting fresh.

**Impact:** The full stack was decided independently: React + Vite + TailwindCSS + FastAPI + SQLAlchemy + PostgreSQL. This decision saved significant time that would have been spent forcing the wrong codebase into shape.

---

## Decision 2 — Argon2 Instead of bcrypt

**When:** Phase 1 — setting up authentication.

**What was considered:** `passlib` with `bcrypt` — the standard recommendation in most FastAPI tutorials.

**What was decided:** `argon2-cffi` using Argon2.

**Why:** bcrypt via passlib crashes on Python 3.13 with `AttributeError: module 'bcrypt' has no attribute '__about__'`. The machine runs Python 3.13, and there was no clean workaround. Argon2 is actually the stronger algorithm — it won the Password Hashing Competition in 2015 and is what OWASP recommends. Switching wasn't a compromise; it was the better choice anyway.

**Impact:** Every password in the system is hashed with Argon2. The verify call has an important gotcha: the hash comes first, the plain password second — opposite of what bcrypt does. This caught a bug early in the auth endpoint that would have been confusing with bcrypt too.

---

## Decision 3 — Supabase Session Pooler (Port 6543) Instead of Direct Port 5432

**When:** Phase 1 — connecting the backend to the database.

**What was considered:** Direct PostgreSQL connection string on the default port 5432.

**What was decided:** Supabase's Session Pooler endpoint on port 6543.

**Why:** Port 5432 is blocked on the local network. Every direct connection attempt timed out silently — there was no error message, just a hang. Supabase's Session Pooler on port 6543 routes through a different path that isn't blocked and works identically from the application's perspective.

A related issue: the database password contained a `#` character, which URL parsers treat as a fragment separator. This caused silent connection failures that took time to diagnose. The fix was percent-encoding `#` as `%23` in the connection string.

**What was also changed:** `Base.metadata.create_all()` was commented out in `main.py` — it tries to connect on port 5432 at startup and crashed the server before any request was processed. All six database tables were instead created manually via raw SQL in the Supabase dashboard. This stays commented out permanently because the tables already exist in production.

**Impact:** Session Pooler on port 6543 is used in both the local `.env` and on Render. This is documented in the README so anyone setting up locally doesn't hit the same issue.

---

## Decision 4 — Single Login Page for All Roles

**When:** Phase 1 planning — before building any auth UI.

**What was considered:** Separate `/supervisor/login` and `/agent/login` pages, which seemed intuitive since the two experiences are completely different.

**What was decided:** One `/login` page for everyone. The server reads the role from the database and the frontend redirects accordingly.

**Why:** Separate login pages are an anti-pattern — they imply that role is determined by which URL you visit, not by who you actually are. An agent could simply navigate to `/supervisor/login` and try credentials there. Role belongs in the user record on the server. The assignment also explicitly requires role enforcement on the server side, not just in the UI. A single login page makes this clearer architecturally and is the correct design.

**Impact:** `POST /auth/login` returns the role in the JWT payload. The frontend reads it and redirects: supervisors go to `/dashboard`, agents go to `/my-tickets`. `PrivateRoute` handles any unauthorized direct URL access after that.

---

## Decision 5 — Fixed Enum Categories Instead of Free-Text Tags

**When:** Phase 1 — designing the database schema for the tickets table.

**What was considered:** Two alternatives:
- Free-text category field — agents type whatever they want
- Unlimited user-defined tags — agents create their own labels

**What was decided:** A fixed enum of 6 categories stored as a PostgreSQL enum type:

| Category | What it covers |
|----------|---------------|
| `billing` | Payment issues, incorrect charges, subscription questions |
| `technical` | Broken features, bugs, inconsistencies in the product |
| `how_to` | Users who don't understand how a feature works |
| `account` | Login issues, account settings, access problems |
| `feature_request` | Users asking for new functionality |
| `other` | Anything that doesn't fit the above — catch-all |

**Why fixed enum over free text:** Free-text categories produce inconsistent data fast. One agent writes "Billing", another writes "billing issue", another writes "payment". All the same problem — but the dashboard can't group them, filters don't work cleanly, and the CSV export is useless for analysis. A fixed enum means every ticket is categorized consistently from day one.

**Why these 6 specifically:** `how_to` is deliberately separate from `technical` — a user not knowing how to use a feature is a documentation problem, not a bug. Different resolution path. `feature_request` is tracked separately because it feeds product decisions, not support resolutions. `other` ensures agents are never blocked from creating a ticket just because no category fits.

**Impact:** `TicketCategory` is a Python `Enum` in `models.py` mapping to a PostgreSQL enum column. Frontend renders them as dropdowns with display-friendly labels. Filtering by category in `GET /tickets/` is a direct SQL equality check — no fuzzy matching needed.

---

## Decision 6 — `can_user_act_on_ticket()` as a Single Shared Authorization Function

**When:** Phase 2 — building ticket endpoints.

**What was considered:** Checking permissions inline in each endpoint — copy-pasting the assignee/collaborator check wherever it was needed.

**What was decided:** One shared helper function called at the top of every ticket-specific endpoint:

```python
def can_user_act_on_ticket(ticket, user, db) -> bool:
    if user.role == UserRole.supervisor:
        return True
    if ticket.assignee_id == user.id:
        return True
    collab = db.query(Collaborator).filter(
        Collaborator.ticket_id == ticket.id,
        Collaborator.agent_id == user.id
    ).first()
    return collab is not None
```

**Why:** If the authorization logic was duplicated across endpoints, fixing a bug in one place wouldn't fix it elsewhere. A new endpoint added later might forget the check entirely. One function means one place to read, one place to update, and consistent behavior everywhere by construction.

**Impact:** Every endpoint that touches a specific ticket starts with `if not can_user_act_on_ticket(ticket, current_user, db): raise HTTPException(403)`. This also made it easy to later extend archive/restore permissions to agents — the check was already there, just needed to be used instead of a hardcoded supervisor-only check.

---

## Decision 7 — SLA Pause Logic Tracked Directly on the Ticket Row

**When:** Phase 2 — implementing SLA clock behavior.

**What was considered:** Computing the paused duration at query time by scanning event history — find when the ticket entered Pending, find when it left, subtract the difference.

**What was decided:** Store `pending_since` and `total_paused_seconds` directly on the `tickets` table and update them as status transitions happen.

**Why:** Computing from event history requires scanning `ticket_events` for every SLA calculation — and SLA remaining is computed on every ticket in every list response (20 per page). That's 20 event table scans per page load. More importantly, the event-history approach is fragile: any gap or ordering issue in the events table silently corrupts SLA numbers. Storing the fields directly on the row keeps SLA computation as a single arithmetic expression:

```
effective_deadline = response_due_at + total_paused_seconds
remaining = effective_deadline - now()
```

No joins. No scanning. The fields update atomically in the same transaction as the status change.

**Impact:** When a ticket enters Pending, `pending_since = now()`. When it leaves Pending, `total_paused_seconds += (now() - pending_since)` and `pending_since` is cleared. This is committed in the same database transaction as the status update, so the data is always consistent.

---

## Decision 8 — Priority Change Feature Added Mid-Project

**When:** After Phase 4 was functionally complete, during pre-deployment testing.

**What was considered:** Priority set at ticket creation and fixed for the rest of the ticket's life (original design).

**What was decided:** Add a priority change button on the ticket detail page, accessible to supervisors, primary assignees, and collaborators.

**Why:** During testing, a real workflow gap became obvious — a ticket created as "Medium" might turn out to be "Critical" once an agent investigates the problem. No way to update priority means either creating a new ticket (losing the history) or leaving it miscategorized (which breaks SLA tracking). The fix was small — one modal + one call to the existing `PUT /tickets/{id}` endpoint which already supported priority updates in its body — so it was worth adding before submission.

**Extended during the same session:** Collaborators were also given permission to change priority. The initial version only allowed supervisors and the primary assignee, but collaborators are actively working on the ticket and have the same legitimate need to escalate it.

**Impact:** Priority changes log to `ticket_events` ("Priority changed from Medium → Critical by [name]") and automatically recalculate `response_due_at` based on the new SLA target. The frontend priority badge updates immediately.

---
## Decision 9 — Agents Can Archive Tickets (Reversed from Original)

**When:** Pre-deployment testing, after all features were confirmed working.

**What was originally decided:** Only supervisors could archive and restore tickets.

**What was reversed to:** Any user who can act on a ticket — supervisor,
primary assignee, or collaborator — can archive and restore it.

**Why it was reversed:** During testing, agents found they couldn't archive
tickets they had just resolved and closed. An agent who resolves a ticket
should be able to remove it from their active worklist without needing to ask
a supervisor. The backend already had `can_user_act_on_ticket()` as a shared
authorization function — extending archive/restore to use it instead of a
hardcoded supervisor check was a two-line backend change.

**Impact:** `archive_ticket()` and `restore_ticket()` now call
`can_user_act_on_ticket()` instead of checking
`current_user.role == supervisor`. The frontend condition
`isSupervisor && !ticket.archived` was updated to just `!ticket.archived`.
