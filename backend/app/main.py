"""
main.py — FastAPI Application Entry Point

Routers registered:
  /auth/*    — login, get current user
  /tickets/* — all ticket CRUD, replies, events, collaborators
  /alerts/*  — SLA alert count (bell badge), alerts list
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import auth
from .routers import tickets
from .routers import alerts   # ← NEW: Phase 2 bell badge

app = FastAPI(
    title="Support Ticket System API",
    description="Backend for the Support Ticket Management System — Assignment 04",
    version="0.2.0",
)

# ── CORS ─────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

# Auth router defines its own /auth prefix internally — don't add it here
app.include_router(auth.router, tags=["auth"])

# Tickets router defines its own /tickets prefix internally
app.include_router(tickets.router)

# Alerts router defines its own /alerts prefix internally
app.include_router(alerts.router)


# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "Support Ticket System API is running", "version": "0.2.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}