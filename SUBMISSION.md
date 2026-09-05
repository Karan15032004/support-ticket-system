# Submission

Fill this in and commit it. This is the first file we open.

## Links

- **GitHub repository:** https://github.com/Karan15032004/support-ticket-system
- **Live application:** https://support-ticket-system-lime.vercel.app

## Notes for the reviewer

**Render free tier cold start:** The backend is deployed on Render's free tier, which spins down after 15 minutes of inactivity. When you first load the app or if it's been idle for 15+ minutes, the initial request to wake the backend may take 30–60 seconds. Subsequent requests are instant. This is normal for free hosting and doesn't indicate an error — just give it a minute on the first load.

**Demo data:** The database is seeded with realistic data: 1 supervisor, 4 agents, 50 tickets across all statuses and priorities, multiple replies per ticket, and several tickets with collaborators. You can test against this data immediately — no need to set everything up from scratch.

**Suggested testing path:** Log in as supervisor → view the dashboard (should show stats and the 8-week chart) → click "Create Ticket" and add a new one → go to My Tickets and reassign it to an agent → log out and log back in as that agent → open the ticket and add a reply → change status to Pending (SLA countdown should freeze) → change back to Open (SLA should resume). This hits most of the architecture in one flow.

**Response times:** At current scale (50 tickets), all queries complete in <200ms. Pagination works smoothly. The 8-week dashboard chart renders instantly. No performance issues to worry about here.

**If something seems slow:** Refresh the page. There's no client-side caching of ticket data, so you're always seeing fresh data from the backend. If the backend just woke up, the first request will be slow but the second will be fast.

## Demo credentials

| Role | Email | Password | What you'll see|
|------|-------|----------|
| Supervisor| supervisor@test.com| SupervisorPass123|Full dashboard, all tickets, SLA alerts, bulk actions, CSV export ||
| Agent | agent1@test.com|password123  |Only assigned tickets, own SLA alerts with Acknowledge button|
| Agent |agent2@test.com |password123  |Different set of assigned tickets |


## Stack

| Layer | What you used | Why |
|-------|--------------|-----|
| Frontend | React 18 + Vite + TailwindCSS v4 + React Router v6 + Axios + Recharts | React for component-based UI, Vite for fast builds, Tailwind for utility styling, Recharts for the dashboard bar chart |
| Backend | FastAPI (Python 3.13) + SQLAlchemy + python-jose + argon2-cffi | FastAPI for auto-validated endpoints and Swagger docs, SQLAlchemy as ORM, Argon2 for password hashing (bcrypt incompatible with Python 3.13) |
| Database | PostgreSQL on Supabase | Relational model fits the structured ticket data; Supabase gives a managed PostgreSQL instance with a visual dashboard for table inspection |
| Hosting | Vercel (frontend) + Render (backend, Singapore region) | Vercel for instant SPA deployment with global CDN; Render for free-tier Python hosting closest to the Supabase Mumbai database |


## Goal checklist

Mark each honestly. Partial is fine — say what is partial.

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Accounts and roles | Done | Supervisor and Agent roles with server-side enforcement on every endpoint — not just UI hiding |
| 2 | Tickets | Done | Create, edit, archive, restore — soft delete preserves full history |
| 3 | Replies inside tickets | Done | Customer-visible replies and internal notes, visually distinct (amber background for internal)
| 4 | Ticket lifecycle | Done | New → Open → Pending → Resolved → Closed with SLA pause on Pending, 7-day reopen window enforced server-side |
| 5 | Collaborators | Done | Primary assignee + unlimited collaborators; agents see all tickets where they are assignee or collaborator |
| 6 | Finding tickets | Done | Server-side search, filter by status/priority/category/assignee, sort by 3 fields, pagination with total count |
| 7 | Bulk actions + CSV | Done | Bulk reassign and bulk close both return per-ticket success/failure results; CSV export respects active filters |
| 8 | Dashboard | Done | 4 stat cards, 8-week resolved bar chart (Recharts), per-agent workload breakdown table |
| 9 | Immutable history | Done | Every action appended to ticket_events — no UPDATE or DELETE endpoints exist for that table |
| 10 | SLA alerts | Done | Yellow (within 1 hour), red (breached), bell badge with count, acknowledge clears alert, refire on reopen + rebreach |

## How much time did you actually spend?

Approximately 16–18 hours across 5 sessions. The original plan was 12 hours. The extra time went into debugging Phase 2 integration bugs (4–5 separate issues when the frontend first connected to the backend), infrastructure issues in Phase 1 (blocked port, password encoding, Python 3.13 bcrypt incompatibility), and deployment (Vercel SPA routing fix, environment variable rebuild).

## What would you do next, with another 12 hours?

Add database-level indexes (`tickets(status, assignee_id, updated_at)` and `ticket_events(ticket_id, created_at)`) which are the first things that would hurt at real scale. Then add outbound email notifications when a ticket is assigned or replied to — currently the system has no way to alert agents outside the UI. After that, WebSocket support so the ticket list updates in real time when another agent makes a change, rather than requiring a manual refresh.

## What are you least happy with in this codebase, and why?

Right now, SLA breaches are only detected when someone manually opens the alerts page. If a ticket breaches SLA, nobody gets notified automatically. A supervisor might not check the alerts page for hours, and by then 10 more tickets have breached.
Why it's a problem in real use: Support agents don't sit staring at the app all day. If a ticket is breaching SLA, they should get:

- Email notification ("Ticket #47 from customer X is now SLA breached — respond immediately")
- In-app banner or toast (immediate visual alert when they log in)

Without this, the system is like a fire alarm that only rings if you walk into the room and check it. Useless.