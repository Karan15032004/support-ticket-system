# Engineering Decisions — SupportHub

This file documents the significant decisions made during the project — what was chosen, what was rejected, why, and in a few cases, what got reversed.

---

## Decision 1 — Argon2 Instead of bcrypt

**What was considered:** `passlib` with `bcrypt` — the standard recommendation in most FastAPI tutorials.

**What was decided:** `argon2-cffi` using Argon2.

**Why:** bcrypt via passlib crashes on Python 3.13 with `AttributeError: module 'bcrypt' has no attribute '__about__'`. The machine runs Python 3.13, and there was no clean fix. Argon2 is actually the stronger algorithm — it won the Password Hashing Competition in 2015 and is what OWASP recommends. Switching wasn't a compromise; it was the better choice anyway.

**Impact:** Every password in the system is hashed with Argon2. The verify call has an important gotcha: the hash comes first, the plain password second — opposite of what bcrypt does. This caught a bug early in the auth endpoint.

---

## Decision 2 — Fixed Enum Categories Instead of Free-Text Tags

**What was considered:** Two alternatives:
- Free-text category field — agents type whatever they want ("billing issue", "payment problem", "charge dispute" — all meaning the same thing)
- Unlimited user-defined tags — agents create their own labels

**What was decided:** A fixed enum of 6 categories stored in the database as a PostgreSQL enum type:

| Category | What it covers |
|----------|---------------|
| `billing` | Payment issues, incorrect charges, subscription questions |
| `technical` | Broken features, bugs, inconsistencies in the product |
| `how_to` | Users who don't understand how a feature works |
| `account` | Login issues, account settings, access problems |
| `feature_request` | Users asking for new functionality |
| `other` | Anything that doesn't fit the above — catch-all |

**Why fixed enum over free text:**

Free-text categories produce garbage data fast. One agent writes "Billing", another writes "billing issue", another writes "payment". All the same problem — but now your dashboard can't group them, your filters don't work cleanly, and your CSV export is useless for analysis. A fixed enum means every ticket is categorized consistently from day one, filters work exactly, and the dashboard can aggregate by category without any data cleaning.

**Why these 6 specifically:**

These cover the realistic range of issues a software company's support team handles. `billing` and `technical` cover the most common ticket types. `how_to` is deliberately separate from `technical` — a user not knowing how to use a feature is a documentation problem, not a bug. `account` isolates access/login issues which often have different resolution paths. `feature_request` is important to track separately because it feeds product decisions, not support resolutions. `other` acts as a catch-all so agents are never blocked from creating a ticket just because the category doesn't fit.

**Why not more categories:**

More categories = more decisions for agents at ticket creation time = more inconsistency in how they're used. Six covers the realistic range without being overwhelming.

**Impact:** `TicketCategory` is defined as a Python `Enum` in `models.py` and maps to a PostgreSQL enum column. The frontend renders them as dropdown options with display-friendly labels (`how_to` → "How To", `feature_request` → "Feature Request"). Filtering by category in `GET /tickets/` is a direct SQL equality check — no fuzzy matching needed.


---


## Decision 3 — Supabase Session Pooler (Port 6543) Instead of Port 5432

**What was considered:** Direct PostgreSQL connection string on the default port 5432.

**What was decided:** Supabase's Session Pooler endpoint on port 6543.

**Why:** Port 5432 is blocked on the local network. There was no way around it — every connection attempt timed out silently. Supabase offers an alternative Session Pooler connection that routes through port 6543, which isn't blocked. It works identically from the application's perspective.

A related issue: the database password contained a `#` character, which URL parsers treat as a fragment separator (like in a web URL). This caused silent connection failures that took a while to diagnose. The fix was percent-encoding it as `%23` in the connection string.

**What was reversed later:** `Base.metadata.create_all()` was also commented out in `main.py` — it tries to connect on port 5432 at startup and crashed the server. All six database tables were instead created manually via raw SQL in the Supabase dashboard. This stays commented out for the lifetime of the project because the tables already exist.

**Impact:** Session Pooler is used in the `.env` file locally. The Render production deployment can use either endpoint since it's not behind the same firewall.

---

## Decision 4 — Single Login Page for All Roles

**What was considered:** Separate `/supervisor/login` and `/agent/login` pages — seemed intuitive since the two experiences are completely different.

**What was decided:** One `/login` page for everyone. The server figures out the role from the database and the frontend redirects accordingly.

**Why:** This was actually proposed as the initial design and then pushed back on. Separate login pages are an anti-pattern — they imply the role is a function of which URL you visit rather than who you are in the database. An agent could just navigate to `/supervisor/login` and try credentials there. Role belongs in the user record on the server, not in the URL. The assignment also says role enforcement must happen server-side, not just in the UI. The single login page makes this clearer architecturally.

**Impact:** `POST /auth/login` returns the role in the JWT payload. The frontend reads it and redirects: supervisors go to `/dashboard`, agents go to `/my-tickets`. `PrivateRoute` handles unauthorized access attempts after that.

---

## Decision 5 — `can_user_act_on_ticket()` as a Single Shared Authorization Function

**What was considered:** Checking permissions inline in each endpoint — copy-pasting the assignee/collaborator check wherever needed.

**What was decided:** One shared helper function called at the top of every ticket-specific endpoint.

```python
def can_user_act_on_ticket(ticket, user, db) -> bool:
    if user.role == UserRole.supervisor:
        return True
    if ticket.assignee_id == user.id:
        return True
    collab = db.query(Collaborator).filter(...).first()
    return collab is not None
```

**Why:** If the authorization logic was duplicated across endpoints, fixing a bug in one place wouldn't fix it elsewhere. A new endpoint added later might forget the check entirely. Centralizing it means there's one place to read and one place to update. It also makes the authorization logic testable in isolation.

**Impact:** Every endpoint that touches a specific ticket starts with `if not can_user_act_on_ticket(ticket, current_user, db): raise HTTPException(403)`. The logic is consistent everywhere by construction.

---

## Decision 6 — SLA Pause Logic Tracked on the Ticket Row, Not Computed at Query Time

**What was considered:** Computing the paused duration at query time by looking at event history — find when the ticket entered Pending, find when it left, subtract.

**What was decided:** Store `pending_since` and `total_paused_seconds` directly on the `tickets` table and update them as transitions happen.

**Why:** Computing it from event history requires scanning `ticket_events` for every SLA calculation, which happens on every ticket list load. With 50+ tickets per page, that's a lot of joins. More importantly, the event history approach is fragile — any gap or ordering issue in the events table would produce wrong SLA numbers. By tracking it directly on the ticket row, SLA remaining is a simple arithmetic calculation:

```
effective_deadline = response_due_at + total_paused_seconds
remaining = effective_deadline - now()
```

No joins needed. No event scanning. The fields update exactly when the status changes.

**Impact:** When a ticket enters Pending, `pending_since = now()`. When it leaves Pending, `total_paused_seconds += (now() - pending_since)` and `pending_since` is cleared. This is done in the same database transaction as the status update, so it's always consistent.

---

## Decision 7 — Priority Change Feature Added Mid-Project (After Testing)

**What was considered:** Priority set at ticket creation and never changed (original design).

**What was decided:** Add a priority change button on the ticket detail page, accessible to supervisors and primary assignees.

**Why:** During testing, a real workflow gap became obvious — a ticket created as "Medium" might turn out to be "Critical" once an agent investigates. Having no way to update priority would force creating a new ticket or leaving it miscategorized. The fix was relatively small (one modal + one backend call to the existing `PUT /tickets/{id}` endpoint which already supported priority updates), so it was worth adding before submission.

**Also extended later:** Collaborators were also given permission to change priority, since they're actively working on the ticket and would have the same need. Initially only supervisors and the primary assignee could change it.

**Impact:** Priority changes log to `ticket_events` ("Priority changed from Medium → Critical by [name]") and automatically recalculate `response_due_at` based on the new SLA target. The frontend priority badge immediately reflects the update.

---

## Decision 8 — Agents and Collaborators Can Archive Tickets (Reversed from Original)

**What was originally decided:** Only supervisors could archive and restore tickets.

**What was reversed to:** Any user who can act on a ticket (supervisor, primary assignee, or collaborator) can archive and restore it.

**Why it was reversed:** During testing, agents logged in and found they couldn't archive tickets they had resolved. An agent who resolves a ticket should be able to clean it from their worklist. Restricting archive to supervisors only created unnecessary friction and didn't align with how agents actually use the system. The backend already had `can_user_act_on_ticket()` as a shared authorization function — extending archive/restore to use it instead of a hard supervisor check was a two-line change.

**Impact:** `archive_ticket()` and `restore_ticket()` now call `can_user_act_on_ticket()` instead of checking `current_user.role == supervisor`. The `isSupervisor && !ticket.archived` condition in `TicketDetailPage.jsx` was also updated to just `!ticket.archived`.


