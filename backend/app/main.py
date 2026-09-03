"""
main.py — FastAPI Application Entry Point

Routers registered:
  /auth/*      — login, get current user
  /tickets/*   — all ticket CRUD, replies, events, collaborators
  /alerts/*    — SLA alert count (bell badge), alerts list
  /dashboard/* — supervisor dashboard stats (Phase 4)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import auth
from .routers import tickets
from .routers import alerts
from .routers import dashboard   # ← NEW: Phase 4 dashboard endpoints

app = FastAPI(
    title="Support Ticket System API",
    description="Backend for the Support Ticket Management System — Assignment 04",
    version="0.3.0",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
# allow_origins lists every URL that is allowed to call this API.
# localhost:5173 = local Vite dev server
# localhost:3000 = fallback (some setups use port 3000)
# The Vercel URL is added after deployment — update it here before deploying.

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://support-ticket-system-lime.vercel.app",
        # Add your Vercel frontend URL here before deploying, e.g.:
        # "https://support-ticket-system.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
# Each router defines its own URL prefix internally.
# We do NOT add the prefix again here — that was the double-prefix bug from Phase 2.

# Auth router uses /auth prefix internally
app.include_router(auth.router, tags=["auth"])

# Tickets router uses /tickets prefix internally
app.include_router(tickets.router)

# Alerts router uses /alerts prefix internally
app.include_router(alerts.router)

# Dashboard router uses /dashboard prefix internally — supervisor only
app.include_router(dashboard.router)


# ── Health check ─────────────────────────────────────────────────────────────
# Render.com calls this endpoint to confirm the app is alive.
# Keep it fast — no DB calls.

@app.get("/")
def root():
    return {"message": "Support Ticket System API is running", "version": "0.3.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}