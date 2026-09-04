# Submission — Support Ticket Management System

---

## Live URLs

| Service | URL |
|---|---|
| Frontend | https://support-ticket-system-lime.vercel.app|
| Backend API docs | https://support-ticket-system-mt90.onrender.com/docs |
|GitHub Repository URL |https://github.com/Karan15032004/support-ticket-system |
---

## Test Credentials

| Email | Password | Role | What you'll see |
|---|---|---|---|
| supervisor@test.com | SupervisorPass123 | Supervisor | Full dashboard, all tickets, SLA alerts, bulk actions, CSV export |
| agent1@test.com | password123 | Agent | Only assigned tickets, own SLA alerts with Acknowledge button |
| agent2@test.com | password123 | Agent | Different set of assigned tickets |
| agent3@test.com | password123 | Agent | Different set of assigned tickets |
| agent4@test.com | password123 | Agent | Different set of assigned tickets |

---

## What to Test (Reviewer Walkthrough)

### As Supervisor
1. Log in → redirected to **Dashboard** automatically
2. See 4 stat cards (open, pending, resolved this week, breaching SLA)
3. See the **8-week bar chart** (resolved tickets per week)
4. See the **Agent Workload table** (open + pending per agent, sorted by busiest)
5. Click **Tickets** in the nav → full ticket queue
6. Use **search bar** (type anything — results update after 400ms debounce)
7. Use **filter dropdowns** (status, priority, category) — all filtering happens in SQL
8. Use **sort buttons** (last updated, created date, priority) with asc/desc toggle
9. Select multiple tickets with **checkboxes → bulk reassign** → see per-ticket result modal
10. Select multiple tickets → **bulk close** (only resolved tickets succeed — others show reason)
11. Click **Export CSV** → download file with current filters applied
12. Open any ticket → see **header, metadata, description, conversation**
13. Add a **Customer reply** and an **Internal note** (amber background)
14. **Change status** using the buttons (only valid transitions shown)
15. Try an illegal status jump directly via API → server rejects with explanation
16. Add/remove **collaborators** (supervisor only)
17. Click **📦 Archive** → ticket disappears from main queue
18. Go to archived ticket URL directly → see restore banner → restore it
19. Click **Bell icon** → SLA alerts page (red cards = breached, yellow = within 1 hour)
20. See the **Ticket Timeline** at the bottom of any ticket (immutable, all events)

### As Agent (agent1@test.com)
1. Log in → redirected to **My Tickets** automatically
2. See only tickets where this agent is assignee or collaborator
3. Same search/filter/sort/pagination — but no bulk actions
4. Open a ticket → can reply, change status (not to Closed)
5. Cannot reassign tickets (no assignee dropdown)
6. Click Bell → **My SLA Alerts** (only their own tickets)
7. Click **✓ Acknowledge** on an alert → it disappears immediately

---

## Key Features Implemented

| Feature | Status |
|---|---|
| Role-based auth (Supervisor / Agent) | ✅ Complete |
| JWT authentication | ✅ Complete |
| Ticket CRUD | ✅ Complete |
| Status lifecycle (New→Open→Pending→Resolved→Closed) | ✅ Complete |
| Server-side lifecycle validation (illegal transitions rejected) | ✅ Complete |
| Replies (customer-visible + internal notes with amber styling) | ✅ Complete |
| Immutable ticket timeline | ✅ Complete |
| Collaborators (add/remove) | ✅ Complete |
| Server-side search + filter + sort + pagination | ✅ Complete |
| Bulk reassign (per-ticket result modal) | ✅ Complete |
| Bulk close (per-ticket result modal) | ✅ Complete |
| CSV export (matches current filters) | ✅ Complete |
| Archive / Restore (soft delete) | ✅ Complete |
| SLA clock with pause logic (pauses on Pending) | ✅ Complete |
| SLA alerts (red/yellow) with bell badge | ✅ Complete |
| Alert acknowledge + re-fire on reopen | ✅ Complete |
| Supervisor dashboard (stats + chart + agent workload) | ✅ Complete |
| 7-day reopen window for closed tickets | ✅ Complete |
| Demo data (50 tickets, 4 agents) | ✅ Complete |

---

## Important Notes for Reviewer

**Render cold start:** The backend is deployed on Render's free tier, which spins down the server after 15 minutes of inactivity. The **first request after idle may take 30–60 seconds** while the server wakes up. After that, all requests are fast. This is a free-tier limitation, not a bug.

**Demo data:** All 50 tickets and 5 users were created by `seed.py` plus 4 tickets created while testing. The data is in the shared Supabase database and is visible on the live URL.

**SLA alerts:** Some tickets intentionally breach SLA (especially Critical-priority ones) so the alerts page has red and yellow cards to demonstrate the feature.

**Archived tickets:** 5 tickets are archived by default. They won't appear in the main queue but can be accessed directly at `/tickets/:id`. Supervisors can restore them.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Styling | TailwindCSS v4 |
| HTTP Client | Axios |
| Frontend Routing | React Router v6 |
| Charts | Recharts |
| Backend | FastAPI (Python 3.13) |
| Auth | JWT via python-jose |
| Password Hashing | Argon2 (argon2-cffi) |
| ORM | SQLAlchemy |
| Database | PostgreSQL on Supabase |
| Backend Hosting | Render (free tier) |
| Frontend Hosting | Vercel |

---

## Documentation

| File | Contents |
|---|---|
| `docs/architecture.md` | System overview, tech stack, one full request path, what was not built |
| `docs/schema.md` | All 6 tables, relationships, constraints, scaling notes |
| `docs/plan.md` | 4-phase build timeline, estimated vs actual hours |
| `docs/decisions.md` | 8 engineering decisions with trade-offs |
| `docs/ai-prompts.md` | All AI prompts used, written by phase, including failed outputs |
