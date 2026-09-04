# SupportHub — Development Plan

This document explains how the project was actually planned and executed — what the original roadmap looked like, what each session produced, where things took longer than expected, and what got deferred. It's an honest account rather than a polished retrospective.

---

## 1. Planning Approach

The project started with a full read-through of the assignment brief before writing a single line of code. That produced two important early decisions: don't reuse a friend's existing codebase (it was an AI-automated system built on LangGraph and Streamlit — completely different product), and don't start with the UI. The dependency chain was clear:

**Database schema → Authentication → Ticket backend → Frontend → Advanced features → Polish → Documentation**

Each phase was blocked on the one before it. There was no point building the ticket list page before the ticket endpoints existed, and no point writing those endpoints before the schema was finalized. This order held throughout the project.

The original plan was structured as a four-day roadmap with four phases per day, each with a checkpoint. In practice, the phases blurred together — debugging in Phase 2 consumed time planned for Phase 3, and Phase 4 features (alerts, dashboard) were implemented earlier than planned because the backend work carried over naturally. The overall sequence was correct; the time estimates were optimistic.

---

## 2. Development Sessions

### Session 1 — Understanding the Brief + Planning

**Goal:** Understand what is actually required before writing anything.

| Planned | What Happened |
|---------|---------------|
| Read the README carefully | Done — went through every feature requirement and edge case |
| Clarify ambiguous requirements | Several clarifications made: customers never log in, one login page for all roles, ticket detail is a single-column layout not a dashboard |
| Evaluate reusing an existing codebase | Evaluated a friend's project (TicketMind). Concluded it was too different to reuse safely — different product, different stack, plagiarism risk |
| Decide tech stack | Finalized: React + Vite + TailwindCSS v4 + Axios + React Router + Recharts / FastAPI + SQLAlchemy + Argon2 + python-jose / Supabase + Render + Vercel |
| Produce full 4-day build roadmap | Done — 12 named phases across 4 days with checkpoints |

This session had no code. It was entirely planning and mental model work, which paid off in the sessions that followed.

---

### Session 2 — Phase 1: Foundation and Authentication

**Goal:** Working login for both roles with correct redirect before touching any ticket code.

| Planned | What Happened |
|---------|---------------|
| Create GitHub repo and local scaffolding | Done |
| Create all 6 database tables in Supabase | Done via manual SQL (not `create_all()` — see below) |
| Build `POST /auth/login` and `GET /auth/me` | Done — Argon2 hashing, JWT with role in payload |
| Build `AuthContext`, `PrivateRoute`, role-based routing | Done |
| Build `SupervisorNav`, `AgentNav`, placeholder pages | Done |
| Seed two test users | Done — `supervisor@test.com` and `agent@test.com` |

**Unexpected work:** Three infrastructure issues slowed this session significantly.

First, port 5432 was blocked on the local network. Supabase's Session Pooler on port 6543 had to be used everywhere. This took time to diagnose.

Second, the database password contained a `#` character which broke the connection string. The fix was percent-encoding it as `%23`, but this wasn't obvious until the connection refused to initialize.

Third, `Base.metadata.create_all()` crashed on startup because it tries to connect on port 5432 internally. It had to be commented out permanently, and all tables were created manually in the Supabase dashboard via raw SQL.

Also: bcrypt, the originally planned password hasher, turned out to be incompatible with Python 3.13. Switched to `argon2-cffi` (Argon2 — actually the stronger algorithm, so no loss there).

TailwindCSS v4 also has a different config syntax from v3. `@import "tailwindcss"` in `index.css` and `'@tailwindcss/postcss'` in `postcss.config.js` instead of the usual setup.

**Checkpoint:** Login as supervisor → `/dashboard`. Login as agent → `/my-tickets`. Wrong credentials → error. Token survives page refresh. ✅

---

### Session 3 — Phase 2: Ticket Core

**Goal:** Full ticket CRUD, ticket detail page, reply system, status lifecycle, collaborators.

| Planned | What Happened |
|---------|---------------|
| All ticket backend endpoints (create, list, get, update, status, replies, events, collaborators) | Done — including SLA calculation, pause/resume logic, `LEGAL_TRANSITIONS` dict, immutable event logging |
| `TicketListPage` (supervisor), `WorklistPage` (agent), `TicketDetailPage` (shared) | Done — all three pages functional |
| `CreateTicketModal` | Done |
| Live SLA alert badge in nav (bonus) | Added at end of session — `GET /alerts/count`, polling every 60s in both navbars |

**This was the hardest session.** The code largely worked but had several bugs that required significant debugging time:

- **Double Router error:** `AuthContext` was calling `useNavigate()` but was rendering inside `BrowserRouter` — React Router doesn't allow hooks outside its own context tree. Fixed by replacing `useNavigate` with `window.location.href` in `AuthContext`.
- **`PrivateRoute` using `<Outlet />`:** The original implementation used `<Outlet />` which only works in nested route setups. Changed to `{children}` prop pattern.
- **Double auth prefix:** `main.py` was passing `prefix="/auth"` to `include_router()` while `auth.py` already defined its own prefix — producing `/auth/auth/login`. Fixed by removing the duplicate.
- **Stale closure in `useEffect`:** Using `useCallback` to define the load function outside `useEffect` caused stale filter state. Fixed by defining `load()` inside `useEffect` directly and using separate primitive `useState` variables (not a single filter object).
- **SLA countdown:** The timer was incrementing state inside `setInterval` which caused re-render storms. Fixed with an offset counter pattern — store `offset` in state, derive display value as `initialSeconds - offset`.

Each of these bugs required diagnosing, explaining, and a clean rewrite of the affected file. The session ran well over the original estimate.

**Checkpoint:** Full ticket lifecycle end-to-end. Replies working with amber tint for internal notes. Status changes validated server-side. Collaborators functional. Timeline populating. ✅

---

### Session 4 — Phase 3: Advanced Features

**Goal:** Server-side search/filter/sort/pagination, bulk actions, CSV export, archive/restore.

| Planned | What Happened |
|---------|---------------|
| Upgrade `GET /tickets/` with full SQL filtering | Done — `build_filtered_query()` + `apply_sorting()` shared helpers |
| Search bar with 400ms debounce on frontend | Done |
| Bulk reassign and bulk close with per-ticket results | Done — `POST /tickets/bulk-assign`, `POST /tickets/bulk-close` |
| CSV export respecting active filters | Done — `GET /tickets/export` with `StreamingResponse` |
| Archive / restore (soft delete) | Done — `PUT /tickets/{id}/archive`, `PUT /tickets/{id}/restore` |
| Phase 4 dashboard and SLA alerts page | Done in this session too — work carried naturally from backend |
| Seed script for demo data | Done — 1 supervisor, 4 agents, 50 tickets |

**Unexpected work:**

The archive bug was a notable one — the `ArchivedPage` wasn't showing archived tickets despite the correct API calls. Root cause: `list_tickets()` was missing the `include_archived` parameter in its function signature, so the frontend's `include_archived=true` query param was silently ignored. Added the parameter, passed it through to `build_filtered_query()`, resolved immediately.

A `ModuleNotFoundError` appeared after pasting the Phase 3 code: `auth.py` had `from .models import ...` (looking in the routers folder) instead of `from ..models import ...` (going up to the app folder). One character fix.

**Checkpoint:** Filtering, pagination, bulk actions, and CSV all working. Archive/restore functional. Dashboard rendering with Recharts. SLA alerts page with acknowledge logic. ✅

---

### Session 5 — Fixes, Testing, and Deployment

**Goal:** Fix remaining UI bugs, run test cases, deploy to production.

| Planned | What Happened |
|---------|---------------|
| Final feature fixes | Agent archive/close permissions updated, SLA pause reflected on frontend, collaborator priority change fixed |
| Test all 10 features against README | Ran 30 critical test cases — all passed |
| Deploy backend to Render | Done — Singapore region, `uvicorn` start command, env vars set |
| Deploy frontend to Vercel | Done — root directory set to `frontend`, `VITE_API_URL` env var added |
| CORS configuration | Added Vercel production URL to `allow_origins` in `main.py` |
| Write documentation | In progress — `architecture.md` complete, `plan.md` in progress |

**Unexpected work:**

Vercel 404 on `/dashboard` after login — React Router routes aren't handled by Vercel's file server. Added `frontend/vercel.json` with a catch-all rewrite rule to `index.html`. Classic SPA deployment issue.

Frontend was hitting a 404 on all API calls even after redeployment — turned out the `VITE_API_URL` env var was added after the first Vercel build, so the old build didn't have it baked in. A manual redeploy picked it up.

---

## 3. Why the Work Was Ordered This Way

The order was dependency-driven throughout:

- **Schema before backend** — every endpoint touches the database. Getting the table structure right early (including the SLA fields `pending_since`, `total_paused_seconds`, `response_due_at` on the tickets table) avoided migrations later.
- **Authentication before everything else** — there was no point building ticket endpoints that couldn't be protected. `get_current_user` had to exist before any protected route could be tested.
- **Backend before frontend** — the frontend is a consumer of the API. Building it against a working API meant no mocking or guessing about response shapes.
- **Core ticket workflow before advanced features** — search, bulk actions, and CSV export are all built on top of a working ticket model. Phase 3 would have been harder to implement if the basic CRUD wasn't solid.
- **Functional correctness before UI polish** — the TailwindCSS work (badges, colors, layouts) came after the features were working. Getting the logic right first prevented rebuilding UI on top of broken functionality.
- **All features before documentation** — the docs (especially `plan.md` and `decisions.md`) describe what was actually built. Writing them first would have been speculation.

---

## 4. Estimated vs Actual

No precise hour estimates were recorded during development. This table reflects qualitative comparisons against the original 4-day roadmap.

| Area | Original Expectation | Actual Outcome |
|------|---------------------|----------------|
| Project setup + repo | Low effort | About right |
| Database schema | Low effort | About right — manual SQL in Supabase took slightly longer than expected |
| Authentication | Medium — standard work | More effort than expected: port 6543 issue, Argon2 switch, `#` encoding bug |
| Phase 2 ticket backend | Medium | About right — clean implementation |
| Phase 2 frontend debugging | Medium | Significantly more than expected — 4–5 separate bugs required diagnosis and full file rewrites |
| Phase 3 server-side filtering | Medium | About right — `build_filtered_query()` design worked cleanly |
| Bulk actions | Medium | About right |
| Dashboard + SLA alerts | Medium | Slightly less than expected — carried naturally from Phase 3 backend work |
| Deployment | Low–Medium | More than expected — Vercel SPA routing fix, env var redeploy, CORS config |
| Documentation | Medium | In progress — more thorough than initially planned |

---

## 5. Unexpected Work and Debugging

**Phase 1 — Infrastructure issues**

Three separate environment problems appeared before a single line of application code ran: blocked port 5432, percent-encoding required for `#` in the database password, and `create_all()` crashing on startup. None of these were anticipated in the original plan. Each required diagnosis time and a decision (use Session Pooler, encode the password, create tables manually).

**Phase 2 — Frontend/backend integration bugs**

This was the most bug-dense part of the project. The double Router error (`useNavigate` inside `AuthContext`), the `<Outlet />` vs `{children}` mistake in `PrivateRoute`, the double auth prefix in `main.py`, and the stale closure in `useEffect` all appeared roughly at the same time when the Phase 2 frontend was first connected to the backend. Each had to be diagnosed from symptoms (blank screen, redirect loop, 404 on login) with no stack trace pointing directly at the cause.

The lesson from this: frontend/backend integration bugs are harder to diagnose than either side in isolation, and the fixes are often one-liners once you understand the root cause.

**Phase 3 — Archive bug**

The archived tickets not appearing on the Archived page was a silent failure — the backend was ignoring the `include_archived` query parameter because it wasn't declared in the function signature. The frontend was sending the correct request, the backend was returning the wrong data, and no error was thrown. This kind of bug (silent data filtering mismatch) is particularly hard to spot without inspecting the actual SQL being run.

**Deployment — Vercel SPA routing**

After deployment, navigating directly to `/dashboard` returned a Vercel 404. This is a known issue with React SPAs on static hosts — the host has no file at `/dashboard` and doesn't know to serve `index.html`. The fix (`vercel.json` rewrite rule) is well-documented but not obvious the first time.

---

## 6. Scope Changes and Deferred Work

These were deliberate decisions, not oversights.

| Item | Reason Deferred |
|------|----------------|
| **Customer portal / login** | Out of scope by design — the assignment defines customers as a name field only |
| **Email ingestion / notifications** | Requires a separate mail provider integration (SendGrid, Mailgun). Not in the assignment requirements. |
| **WebSocket real-time updates** | Polling every 60 seconds is sufficient for the use case. WebSocket connection management adds complexity without meaningful benefit at this scale. |
| **File attachments** | Requires object storage (S3 or similar). Not in the assignment requirements. |
| **Password reset** | No email provider configured, so no reset link can be delivered. Credentials are seeded directly. |
| **Database-level immutability triggers** | Application-level enforcement (no update/delete endpoints) is sufficient. PostgreSQL triggers would be defence-in-depth but were outside the time budget. |
| **Canned responses / knowledge base** | Listed as stretch features in the brief. All 10 core requirements were prioritised first. |

---

## 7. Final Execution Summary

The project followed its original dependency-driven order — schema, auth, backend, frontend, advanced features, deployment, documentation — but the actual execution was more iterative than the clean four-day plan implied. Phase 2 ran longer than expected due to integration bugs, which compressed the time available for Phase 3. Phase 3 and Phase 4 backend work ended up happening in the same session because the work carried naturally. Deployment introduced its own set of issues (Vercel SPA routing, env var build order) that weren't in the original plan at all.

The end result covers all 10 required features. The main lesson from the process: the planning session at the start (reading the brief carefully, rejecting the reuse approach, finalizing the tech stack before writing code) was time well spent. Most of the real friction came from environment issues and integration debugging rather than the features themselves.
