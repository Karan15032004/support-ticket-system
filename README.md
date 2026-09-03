# 🎫 SupportHub — Support Ticket Management System

<div align="center">

![SupportHub Banner](https://img.shields.io/badge/SupportHub-Ticket%20Management-2878ff?style=for-the-badge&logo=headset&logoColor=white)

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://support-ticket-system-lime.vercel.app)
[![Backend API](https://img.shields.io/badge/Backend%20API-Render-46E3B7?style=for-the-badge&logo=render)](https://support-ticket-system-mt90.onrender.com/docs)
[![GitHub](https://img.shields.io/badge/GitHub-Karan15032004-181717?style=for-the-badge&logo=github)](https://github.com/Karan15032004/support-ticket-system)

**A full-stack support ticket management system built for Thapar University Placement Assignment 04.**

[Live Demo](https://support-ticket-system-lime.vercel.app) • [API Docs](https://support-ticket-system-mt90.onrender.com/docs) • [Report Bug](https://github.com/Karan15032004/support-ticket-system/issues)

</div>

---

## 📋 Table of Contents

- [About The Project](#-about-the-project)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Live Demo](#-live-demo)
- [Demo Credentials](#-demo-credentials)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [Database Schema](#-database-schema)
- [Architecture](#-architecture)
- [Key Design Decisions](#-key-design-decisions)
- [Assignment Context](#-assignment-context)

---

## 🚀 About The Project

SupportHub replaces the classic "reply-all to a shared inbox" chaos with a structured, role-based ticket management system. Agents pick up tickets, reply, and move them through a defined lifecycle. Supervisors see the whole queue, reassign work, and track SLA compliance — all from one URL.

### The Problem It Solves

| Problem | Solution |
|---------|----------|
| Multiple agents reply to the same ticket | One assignee per ticket, clearly visible |
| Tickets get missed or forgotten | Full queue visible to supervisors at all times |
| No visibility into urgency | Priority-based SLA countdowns on every ticket |
| Handover chaos when agents go on leave | Collaborator system + immutable history |
| No way to see SLA breaches at a glance | Real-time SLA alerts with bell badge in nav |

---

## ✨ Features

### 🔐 Authentication & Roles
- JWT-based authentication with role-encoded tokens
- Two roles: **Supervisor** and **Agent**
- Server-side enforcement — not just UI hiding
- Role-based routing: Supervisors → `/dashboard`, Agents → `/my-tickets`

### 🎫 Ticket Management
- Create tickets with subject, description, requester, priority, and category
- Full lifecycle: **New → Open → Pending → Resolved → Closed**
- Archive and restore tickets (soft delete — history preserved)
- Edit ticket priority with auto-recalculated SLA deadline
- Illegal transitions rejected by server with clear error messages

### 💬 Replies & Internal Notes
- Customer-visible replies and internal staff notes on the same ticket
- Internal notes shown with amber background — visually distinct
- Replies are immutable — cannot be edited or deleted after posting

### ⏱️ SLA Clock with Pause Logic
- Priority-based response targets: Critical (1h) · High (4h) · Medium (8h) · Low (24h)
- Clock **pauses** when ticket enters Pending (waiting on customer)
- Clock **resumes** when customer replies → ticket returns to Open
- Live countdown timer: 🟢 Green → 🟠 Yellow (< 1 hour) → 🔴 Red (breached)

### 👥 Collaborators
- One primary assignee + unlimited collaborators per ticket
- Collaborators can reply, change status, and update priority
- Agents see all tickets where they are assignee OR collaborator

### 🔍 Server-Side Search & Filter
- Full-text search across subject and description (SQL ILIKE)
- Filters: status, priority, category, assignee
- Sort: created date, last updated, priority (correct severity order)
- Pagination with total count displayed
- **All filtering happens in SQL — never in the browser**

### ⚡ Bulk Actions
- Select multiple tickets → bulk reassign or bulk close
- Per-ticket success/failure results (not a single pass/fail)
- CSV export of current filtered view

### 📊 Supervisor Dashboard
- 4 headline stat cards: Open · Pending · Resolved This Week · Breaching SLA
- 8-week resolved tickets bar chart (Recharts)
- Per-agent workload breakdown table

### 🔔 SLA Alerts
- Yellow alerts: within 1 hour of breach
- Red alerts: already breached
- Bell badge in nav with unread count
- Agents acknowledge their own alerts
- Alert re-fires if ticket is reopened and breaches again

### 📜 Immutable Timeline
- Every action logged: status changes, reassignments, replies, collaborator changes
- **Nothing in the timeline can ever be edited or deleted** — not even by supervisors
- Full audit trail with actor name and timestamp

---

## 🛠 Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18 | Component-based UI |
| Vite | 5 | Build tool and dev server |
| TailwindCSS | v4 | Utility-first styling |
| React Router | v6 | Client-side routing |
| Axios | latest | HTTP client |
| Recharts | latest | Dashboard bar chart |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| FastAPI | latest | Python web framework |
| Python | 3.13 | Runtime |
| SQLAlchemy | latest | ORM |
| python-jose | latest | JWT authentication |
| argon2-cffi | latest | Password hashing (bcrypt incompatible with Python 3.13) |
| uvicorn | latest | ASGI server |

### Database & Infrastructure
| Technology | Purpose |
|------------|---------|
| PostgreSQL | Relational database |
| Supabase | Managed PostgreSQL hosting |
| Render | Backend deployment (free tier) |
| Vercel | Frontend deployment (free tier) |

---

## 🌐 Live Demo

| Service | URL |
|---------|-----|
| **Frontend** | https://support-ticket-system-lime.vercel.app |
| **Backend API** | https://support-ticket-system-mt90.onrender.com |
| **Swagger Docs** | https://support-ticket-system-mt90.onrender.com/docs |

> ⚠️ **Note:** Render's free tier spins down after 15 minutes of inactivity. The **first request may take 30–60 seconds** to wake up. Subsequent requests are instant.

---

## 🔑 Demo Credentials

| Role | Email | Password | Access |
|------|-------|----------|--------|
| **Supervisor** | supervisor@test.com | SupervisorPass123 | Full access: dashboard, all tickets, bulk actions, analytics |
| **Agent 1** | agent1@test.com | password123 | Own + collaborated tickets only |
| **Agent 2** | agent2@test.com | password123 | Own + collaborated tickets only |
| **Agent 3** | agent3@test.com | password123 | Own + collaborated tickets only |
| **Agent 4** | agent4@test.com | password123 | Own + collaborated tickets only |

---

## 🏁 Getting Started

### Prerequisites

- Node.js 18+
- Python 3.13+
- PostgreSQL (or Supabase account)
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/Karan15032004/support-ticket-system.git
cd support-ticket-system
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### Create `.env` file in `/backend`:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD%23@db.YOUR_PROJECT.supabase.co:6543/postgres
JWT_SECRET=your-super-secret-key-at-least-32-characters
```

> ⚠️ **Critical:** Use Supabase **Session Pooler on port 6543** (not 5432 — that port is blocked locally).
> If your password contains `#`, replace it with `%23` in the URL.

#### Start Backend:

```bash
uvicorn app.main:app --reload
```

API available at: `http://localhost:8000`
Swagger docs at: `http://localhost:8000/docs`

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

#### Create `.env.local` file in `/frontend`:

```env
VITE_API_URL=http://localhost:8000
```

#### Start Frontend:

```bash
npm run dev
```

Frontend available at: `http://localhost:5173`

### 4. Seed Demo Data

```bash
cd backend
python seed.py
```

This creates:
- 1 supervisor + 4 agents
- 50 realistic tickets across all statuses and priorities
- Replies, collaborations, and SLA scenarios

---

## 📁 Project Structure

```
support-ticket-system/
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── auth.py          # Login, JWT, current user
│   │   │   ├── tickets.py       # All ticket endpoints (CRUD, replies, events)
│   │   │   ├── alerts.py        # SLA alert endpoints
│   │   │   └── dashboard.py     # Supervisor dashboard stats
│   │   ├── main.py              # FastAPI app entry point, CORS config
│   │   ├── models.py            # SQLAlchemy ORM models
│   │   ├── schemas.py           # Pydantic request/response schemas
│   │   ├── database.py          # DB connection and session management
│   │   └── auth.py              # JWT utils and get_current_user dependency
│   ├── seed.py                  # Demo data seeder
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── tickets.js       # All HTTP calls (Axios)
│   │   ├── components/
│   │   │   ├── SupervisorNav.jsx
│   │   │   ├── AgentNav.jsx
│   │   │   ├── CreateTicketModal.jsx
│   │   │   ├── BulkActionBar.jsx
│   │   │   └── BulkResultModal.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx  # Global auth state
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   └── LoginPage.jsx
│   │   │   ├── supervisor/
│   │   │   │   ├── DashboardPage.jsx
│   │   │   │   ├── TicketListPage.jsx
│   │   │   │   └── ArchivedPage.jsx
│   │   │   ├── agent/
│   │   │   │   └── WorklistPage.jsx
│   │   │   └── shared/
│   │   │       ├── TicketDetailPage.jsx
│   │   │       └── AlertsPage.jsx
│   │   ├── App.jsx              # Routes + PrivateRoute setup
│   │   └── main.jsx             # Entry point
│   ├── vercel.json              # Vercel SPA routing fix
│   └── package.json
└── docs/
    ├── architecture.md
    ├── schema.md
    ├── plan.md
    ├── decisions.md
    └── ai-prompts.md
```

---

## 📡 API Documentation

Full interactive docs at: **https://support-ticket-system-mt90.onrender.com/docs**

### Key Endpoints

#### Auth
```
POST   /auth/login              — Login, returns JWT token
GET    /auth/me                 — Get current user info
```

#### Tickets
```
GET    /tickets/                — List tickets (paginated, filtered, sorted)
POST   /tickets/                — Create ticket
GET    /tickets/{id}            — Get single ticket
PUT    /tickets/{id}            — Update ticket fields
PUT    /tickets/{id}/status     — Change status (lifecycle enforced)
GET    /tickets/{id}/replies    — Get all replies
POST   /tickets/{id}/replies    — Add reply or internal note
GET    /tickets/{id}/events     — Immutable timeline (read-only)
GET    /tickets/{id}/collaborators   — List collaborators
POST   /tickets/{id}/collaborators   — Add collaborator
DELETE /tickets/{id}/collaborators/{agent_id} — Remove collaborator
PUT    /tickets/{id}/archive    — Archive ticket
PUT    /tickets/{id}/restore    — Restore archived ticket
GET    /tickets/export          — CSV export (supervisor only)
POST   /tickets/bulk-assign     — Bulk reassign (supervisor only)
POST   /tickets/bulk-close      — Bulk close (supervisor only)
GET    /tickets/meta/agents     — List all agents (for dropdowns)
```

#### Dashboard (Supervisor Only)
```
GET    /dashboard/stats         — Open, pending, resolved, breaching counts
GET    /dashboard/weekly        — 8-week resolved ticket trend
GET    /dashboard/agents        — Per-agent workload breakdown
```

#### SLA Alerts
```
GET    /alerts/count            — Unacknowledged alert count (for bell badge)
GET    /alerts                  — Full alerts list
POST   /alerts/{ticket_id}/acknowledge — Acknowledge alert (agents only)
```

---

## 🗄 Database Schema

```
users
  id, email, password_hash, name, role (supervisor|agent), is_active, created_at

tickets
  id, subject, description, requester_name
  priority (critical|high|medium|low)
  category (billing|technical|how_to|account|feature_request|other)
  status (new|open|pending|resolved|closed)
  assignee_id → users.id
  created_by  → users.id
  created_at, updated_at, closed_at
  response_due_at, pending_since, total_paused_seconds
  archived (bool)

replies                         ← NEVER updated or deleted
  id, ticket_id, author_id, body, is_internal, created_at

ticket_events                   ← NEVER updated or deleted (immutable audit log)
  id, ticket_id, event_type, old_value, new_value, actor_id, created_at

collaborators                   ← Composite PK (ticket_id, agent_id)
  ticket_id, agent_id, added_at

sla_alerts
  id, ticket_id (UNIQUE), acknowledged, created_at, acknowledged_at
```

### Relationships
- `tickets` → `users` (many-to-one: assignee, creator)
- `replies` → `tickets` (many-to-one)
- `ticket_events` → `tickets` (many-to-one, append-only)
- `collaborators` → `tickets` + `users` (many-to-many join table)
- `sla_alerts` → `tickets` (one-to-one)

---

## 🏛 Architecture

```
Browser (React + Vite)
        │  HTTPS requests (Axios)
        ▼
  Vercel CDN
  (Static files served globally)
        │
        ▼
  FastAPI (Render)
  ├── JWT middleware (every request)
  ├── Role-based permission checks
  ├── Business logic (SLA, lifecycle)
  └── SQLAlchemy ORM
        │
        ▼
  PostgreSQL (Supabase)
  ├── Session Pooler (port 6543)
  └── Mumbai region
```

### One Full Request: Creating a Ticket

1. Agent fills form on frontend → Axios sends `POST /tickets/` with JWT header
2. FastAPI extracts user from JWT via `get_current_user` dependency
3. `create_ticket()` validates the request via Pydantic schema
4. SLA deadline calculated: `now() + SLA_HOURS[priority]`
5. Ticket row inserted → `ticket_created` event appended to `ticket_events`
6. Response returns `TicketResponse` with computed `sla_remaining_seconds`
7. Frontend updates the ticket list via React state

---

## 🧠 Key Design Decisions

### 1. Argon2 over bcrypt
bcrypt is incompatible with Python 3.13. Argon2 (via `argon2-cffi`) is actually the stronger algorithm — winner of the Password Hashing Competition.

### 2. Session Pooler (port 6543) over Direct Connection (5432)
Port 5432 is blocked on local networks. Supabase's Session Pooler on 6543 works everywhere and handles connection pooling efficiently.

### 3. Server-Side Filtering (Non-Negotiable)
All search, filter, sort, and pagination happens in SQL with `WHERE`, `ORDER BY`, `LIMIT/OFFSET`. Python never loads all tickets into memory. The `total_count` is computed with `query.count()` before pagination.

### 4. SLA Pause Logic
```
effective_deadline = response_due_at + total_paused_seconds
remaining = effective_deadline - now()
```
When entering Pending: `pending_since = now()`
When leaving Pending: `total_paused_seconds += (now() - pending_since)`
This ensures agents aren't penalized for time the ticket spent waiting on the customer.

### 5. Immutable Timeline
`ticket_events` has no UPDATE or DELETE endpoints. Every state-changing action appends a row. This is enforced at the application layer — the backend simply never calls these operations on that table.

### 6. `build_filtered_query()` Shared Helper
The CSV export and the ticket list use the exact same filtering function. If we duplicated the logic, a bug fix in one place wouldn't apply to the other. DRY prevents that class of bug entirely.

---

### All 10 Required Features: Status

| # | Feature | Status |
|---|---------|--------|
| 1 | Accounts & Roles (server-enforced) | ✅ Complete |
| 2 | Tickets (CRUD, archive, restore) | ✅ Complete |
| 3 | Replies (customer + internal notes) | ✅ Complete |
| 4 | Ticket Lifecycle (with validation) | ✅ Complete |
| 5 | Collaborators | ✅ Complete |
| 6 | Server-Side Search, Filter, Sort, Pagination | ✅ Complete |
| 7 | Bulk Actions + CSV Export | ✅ Complete |
| 8 | Supervisor Dashboard | ✅ Complete |
| 9 | Immutable History | ✅ Complete |
| 10 | SLA Alerts (yellow/red, acknowledge, refire) | ✅ Complete |

---

## 🔧 Local Development Tips

### Check if backend is running
```bash
curl http://localhost:8000/health
# Expected: {"status": "healthy"}
```

### View API docs locally
```
http://localhost:8000/docs
```

### Common Issues

| Issue | Fix |
|-------|-----|
| `Connection refused` on port 5432 | Use port 6543 (Session Pooler) in DATABASE_URL |
| `password authentication failed` | Check `#` is encoded as `%23` in DATABASE_URL |
| Frontend shows blank page | Check `VITE_API_URL` is set in `.env.local` |
| `create_all()` crashes on startup | Keep `Base.metadata.create_all()` commented out — tables already exist in Supabase |
| TailwindCSS not working | Ensure `@import "tailwindcss"` is in `index.css` (v4 syntax) |

---

## 📄 Documentation

All documentation is in the `docs/` folder:

| File | Contents |
|------|----------|
| `docs/architecture.md` | System design, request flow, what was not built |
| `docs/schema.md` | Full database schema with relationships and constraints |
| `docs/plan.md` | Build plan, time estimates vs actuals, what was cut |
| `docs/decisions.md` | 5+ real decisions with alternatives considered |
| `docs/ai-prompts.md` | All AI prompts used, including bad outputs and fixes |

---

<div align="center">

**Built with ❤️ by Karan Nigam — Thapar University, Patiala**

[![Live Demo](https://img.shields.io/badge/Try%20the%20Live%20Demo-2878ff?style=for-the-badge)](https://support-ticket-system-lime.vercel.app)

</div>
