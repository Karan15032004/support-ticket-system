# Build Plan

## Overall Approach

The project was built in 4 phases across 4 days, following the assignment's
recommended structure. Each phase ends with a working checkpoint before
moving to the next.

---

## Session 1 — Phase 1: Foundation

**Date:** 30 August 2026
**Goal:** Working authentication with role-based routing

### Order Built and Why

1. **Supabase setup** — database first, because everything else depends on it
2. **SQLAlchemy models (all 6 tables)** — defined all tables at once since the
   schema was fully known. No reason to defer.
3. **FastAPI + database connection** — basic server, CORS, health check
4. **JWT auth system** — hash_password, verify_password, create_access_token
5. **POST /auth/login + GET /auth/me** — the two auth endpoints
6. **React + Vite setup** — frontend scaffolding
7. **Axios instance** — configured with token interceptor
8. **AuthContext** — global auth state with localStorage persistence
9. **PrivateRoute** — route protection component
10. **LoginPage** — the login form UI
11. **DashboardPage + WorklistPage** — placeholder pages for both roles

### Estimated vs Actual Time
- Estimated: 3 hours
- Actual: ~4 hours
- Reason for overrun: Multiple unexpected issues (see below)

### Problems Encountered

**Problem 1: bcrypt incompatible with Python 3.13**
passlib's bcrypt integration crashes on Python 3.13 with
`AttributeError: module 'bcrypt' has no attribute '__about__'`
Solution: Switched to argon2-cffi. This was the right call — Argon2 is
more modern and secure than bcrypt anyway.

**Problem 2: Port 5432 blocked on local network**
The home network/ISP blocks outbound connections on port 5432 (PostgreSQL).
This caused `could not translate host name` errors.
Solution: Switched to Supabase's Session Pooler on port 6543, which
works through most firewalls.

**Problem 3: Tailwind v4 breaking changes**
Tailwind v4 moved the PostCSS plugin to a separate package.
The old `@tailwind base/components/utilities` directives no longer work.
Solution: Installed `@tailwindcss/postcss`, updated postcss.config.js,
changed index.css to use `@import "tailwindcss"`.

**Problem 4: Tables couldn't be created via SQLAlchemy**
`Base.metadata.create_all()` on startup connects to the database immediately.
Since port 5432 is blocked, this crashed the server before any routes loaded.
Solution: Commented out `create_all()`, created tables manually via
Supabase SQL Editor.

### What Was Cut
Nothing was cut from Phase 1. All planned deliverables were completed.

---

## Session 2 — Phase 2: Ticket Core (Upcoming)

**Goal:** Full ticket CRUD, list page, detail page, reply system

Planned:
- POST /tickets, GET /tickets, GET /tickets/{id}, PUT /tickets/{id}
- Status lifecycle validation (New→Open→Pending→Resolved→Closed)
- Reply system (customer-visible + internal notes)
- Collaborator add/remove
- Frontend: ticket list, ticket detail, create modal

---

## Session 3 — Phase 3: Advanced Features (Upcoming)

**Goal:** Search/filter/sort/pagination, SLA clock, bulk actions, CSV export

---

## Session 4 — Phase 4: Dashboard, Alerts, Deploy (Upcoming)

**Goal:** Dashboard stats, SLA alerts, seed data, Render + Vercel deployment