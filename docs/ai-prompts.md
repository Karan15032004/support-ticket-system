# AI Prompts — SupportHub Development

This document records the AI interactions that materially shaped the project — what was asked, what it produced, and where it went wrong. The prompts are grouped by development goal in roughly chronological order.
---

## Summary Table

| Goal | Major AI Contribution | Outcome |
|------|-----------------------|---------|
| Understanding the brief | Plain-English walkthrough of all 10 requirements and assessment criteria | Clear mental model before any code was written |
| Phase 1 — Foundation | Database schema, auth endpoints, JWT, role-based routing, frontend scaffolding | Working login for both roles with correct redirect |
| Phase 2 — Ticket core | All ticket CRUD endpoints, lifecycle validation, SLA logic, 3 new frontend pages | Full ticket workflow end-to-end |
| Phase 2 debugging | Diagnosed and fixed 4–5 integration bugs in the same session | All Phase 2 features working after iterative fixes |
| Phase 3 — Advanced features | Server-side filtering, bulk actions, CSV export, archive/restore | All 10 core features complete |
| Testing | 30 critical test cases covering all requirements | Pre-deployment confidence |
| Deployment | Step-by-step Render + Vercel setup, CORS config, env vars | Live at production URLs |

---

## 1. Understanding the Brief

### Prompt 1 — Read and explain the entire README

**Prompt Used:**
> "This is the readme file for the project I have to build, before we start building it, I want to understand everything written in the readme file so as to gain a comprehensive understanding of what we have to build, so go through the readme file thoroughly, and explain to me everything written in it in easy terms and also what all is expected from me, explain the project — what is the problem it is meant to solve, what solution is expected from me and how I can ace this round, assume no prior knowledge"

**What it was trying to accomplish:** Get a complete, plain-English breakdown of all 10 requirements, the documentation requirements, the assessment criteria, and what separates good submissions from great ones — before writing a single line of code.

**Impact:** Produced a structured breakdown of every requirement with edge cases highlighted. Key things surfaced here that shaped the entire project: the SLA pause/resume rule (the clock pauses in Pending — not obvious from a quick read), the requirement that bulk actions must report per-ticket results (not a single pass/fail), and the explicit warning that "the AI wrote it" is a failing answer in the technical interview.

---
## 2. Phase 1 — Foundation and Authentication

### Prompt 2 — Build Phase 1: database schema, auth, role-based routing

**Prompt Used:**
> "We're done with phase 1. I want to understand everything written in the readme clearly. Now let's start building — I've uploaded the comprehensive summary of everything done so far. State what Phase 1 will achieve, then give me all the code while explaining it side by side,assume no prior knowledge."

**What it was trying to accomplish:** Complete the entire foundation — all 6 database tables, JWT authentication endpoints, `AuthContext`, `PrivateRoute`, role-based routing, and placeholder pages for both roles.

**Impact:** Produced all of: `models.py`, `auth.py` (router), `main.py`, `AuthContext.jsx`, `PrivateRoute.jsx`, `SupervisorNav.jsx`, `AgentNav.jsx`, `LoginPage.jsx`, and placeholder dashboard/worklist pages with thier explaination simultaneously. Also produced the two SQL scripts to create test users in Supabase.

Three infrastructure issues were discovered and resolved during this phase (documented under debugging below): port 5432 blocked, `#` in the database password requiring percent-encoding, and `create_all()` crashing on startup.

---

## 3. Phase 2 — Ticket Core

### Prompt 3 — Phase 2 objectives, then give all the code

**Prompt Used:**
> "This is the entire comprehensive summary of all we have done till now, we are done with phase 1, have to start phase 2, so first very clearly state what all we will achieve in phase 2, then let's start coding it."

**What it was trying to accomplish:** Understand Phase 2 scope first (so there were no surprises), then get all the code — ticket CRUD, status lifecycle, replies, collaborators, `TicketListPage`, `WorklistPage`, `TicketDetailPage`, `CreateTicketModal`.

**Impact:** The "explain first, then code" pattern was deliberate — it meant reviewing and agreeing on the scope before any implementation was produced. Phase 2 delivered all ticket backend endpoints including the `LEGAL_TRANSITIONS` dict, SLA pause/resume logic, immutable event logging, the amber-tinted internal note display, and the live SLA badge in both navbars. The badge was added at the end of the session as a bonus feature once the core was confirmed working.

---

## 4. Debugging — Phase 2 Integration

### Prompt 4 — Fix login failing after connecting frontend to backend

**Prompt Used:**
> "I got these errors after uploading the Phase 2 code — [errors pasted]. Why is this happening and help me fix it and understand them."

**What it was trying to accomplish:** Diagnose and fix multiple errors that appeared simultaneously when the Phase 2 frontend first connected to the backend.

**Impact:** This single debugging session covered three separate bugs:

1. `useNavigate` inside `AuthContext` caused a nested Router conflict — fixed by replacing with `window.location.href`
2. `main.py` added `/auth` as a prefix in `include_router()` while `auth.py` already defined it — producing `/auth/auth/login`. Fixed by removing the duplicate prefix.
3. `useCallback` used to define the load function outside `useEffect` caused stale filter state — fixed by defining `load()` directly inside `useEffect` with separate primitive `useState` variables

Each fix required sharing the specific error, the relevant file, and the expected vs actual behavior. The final working state was confirmed before moving on.

---

## 5. Phase 3 — Advanced Features

### Prompt 5 — Explain Phase 3 scope before coding

**Prompt Used:**
> "This is the in-depth summary of everything we have achieved at the end of phase 2, now I want to proceed to phase 3, before getting into the code, I want you to explain to me the objective of phase 3, what all features we will add in this phase, what files are going to change and/or added while explaining the code changes and what all we would be able to do after phase 3."

**What it was trying to accomplish:** Same pattern as Phase 2 — understand scope and file changes before requesting code. Established that Phase 3 would deliver server-side filtering, bulk actions, CSV export, and archive/restore.

**Impact:** Produced a clear before/after comparison table and a breakdown of exactly which files would change and why. This made it easier to verify the Phase 3 output against clear expectations.

---

## 6. Testing and QA

### Prompt 6 — Generate 30 critical test cases

**Prompt Used:**
> "[Uploaded the original Readme.md] Act as a master tester and go through the entire readme file thoroughly and give me test cases which I should test on my project before deploying. Give me: a list of test cases to test all the features mentioned in the readme file, which will at minimum contain: 1) test case definition (what action I should perform) and 2) expected output. Give me the 30 most crucial test cases which are most likely to break our system."

**What it was trying to accomplish:** Generate a structured set of test cases from the README's actual requirements, prioritized by which checks were most likely to surface real bugs.

**Impact:** Produced 30 test cases across 10 sections covering auth enforcement, lifecycle validation, SLA pause/resume, server-side filtering (with the specific instruction to check the Network tab to confirm requests went to the backend), pagination correctness, bulk action per-ticket results, and SLA alert refire logic. Used as a checklist before deployment.

---

## 7. Deployment

### Prompt 7 — Walk me through Render and Vercel deployment

**Prompt Used:**
> "Done everything verified, now let's move towards deployment."

**What it was trying to accomplish:** Get step-by-step deployment configuration for both Render (backend) and Vercel (frontend), including the correct commands, environment variables, and region choices.

**Impact:** Covered the complete deployment sequence: Render web service setup (Singapore region, `backend` as root directory, `uvicorn app.main:app --host 0.0.0.0 --port 8000` as start command, `DATABASE_URL`/`JWT_SECRET`/`PYTHON_VERSION` env vars), then Vercel frontend setup (`frontend` as root directory, `VITE_API_URL` env var). CORS configuration in `main.py` was updated to include the live Vercel URL before the final commit.

Two deployment issues required additional prompts: the Vercel 404 on `/dashboard` (React Router routes not handled by Vercel's file server — fixed with `vercel.json` rewrite rule), and the env var not being picked up (because it was added after the initial Vercel build — fixed by triggering a manual redeploy).

---

## 8. Documentation

### Prompt 8 — Generate architecture.md

**Prompt Used:**
> "I want you to help me create the docs/architecture.md for my SupportHub system. Use the existing project knowledge as the primary source of truth. Do not invent technologies, components, or endpoints that have not been implemented. Follow this exact progressive structure: Level 1 — System, Level 2 — Components, Level 3 — Communication, Level 4 — Deployment, Level 5 — Request Flow, Level 6 — Feature Flows, Level 7 — Boundaries."

**What it was trying to accomplish:** Professional architecture documentation with Mermaid diagrams answering the five core questions: what are the moving pieces, how do they communicate, where do they run, what is the end-to-end request path, and what was deliberately not built.

**Impact:** Produced the complete `architecture.md` with 10 Mermaid diagrams including a sequence diagram tracing "agent changes status to Pending" through all layers — authentication, authorization, lifecycle validation, SLA pause logic, event logging, and frontend state update.

---

---

## AI Output That Went Wrong

### Original prompt

> "Give me all the code for Phase 2 — ticket CRUD, TicketDetailPage, reply system, status lifecycle, SLA countdown."

### What the AI produced

A complete Phase 2 implementation across 8+ files. The code was largely correct in logic, but contained multiple integration bugs that only surfaced when the frontend was connected to the backend together for the first time.
That's why this approach of getting all the files at once was discarded.
### What was wrong

Four bugs appeared simultaneously:

1. **`useNavigate` in `AuthContext`** — `AuthContext` called `useNavigate()` at the top level, but `AuthContext` is rendered as a parent of `BrowserRouter` in some configurations, causing React Router to throw because hooks must be called within the Router context.

2. **`<Outlet />` in `PrivateRoute`** — `PrivateRoute` was written to render `<Outlet />` (the pattern for `<Route>` nesting), but `App.jsx` used it as a wrapper component expecting `{children}`. The two patterns are incompatible.

3. **Double auth prefix** — `auth.py` defined `prefix="/auth"` on the router, and `main.py` also passed `prefix="/auth"` to `include_router()`. Every login request went to `/auth/auth/login` instead of `/auth/login`.

4. **Stale closure in `useEffect`** — The load function was defined with `useCallback` outside the `useEffect`, which captured a stale version of the filter state. This caused filter changes to have no effect on the next fetch.

None of these caused an obvious error message pointing at the root cause. The symptoms were: blank page after login, redirect loop, 404 on login, and filter state not updating.

### What was done afterwards

Each bug was debugged one at a time by sharing the specific error message, the relevant file, and what the expected vs actual behavior was. The fixes:

- `useNavigate` removed from `AuthContext`; replaced with `window.location.href` which works outside Router context
- `PrivateRoute` changed from `<Outlet />` to `{children}` prop pattern
- Prefix removed from `main.py`'s `include_router()` call
- `useCallback` removed; `load()` defined directly inside `useEffect` with primitive `useState` variables

### Change in approach afterwards

After Phase 2, every new phase started with: "Share the existing files first, then I'll write the code against what's actually there." This consistently prevented mismatch between the AI's assumption of what the existing code looked like and what was actually in the file. Phase 3 code was written against 7 uploaded files rather than against an assumed state. This reduced the number of post-delivery fixes significantly.

---

## Evolution of AI Usage

The way AI was used changed noticeably across the project:

**Early (planning):** Broad, conceptual prompts — "explain the README", "should I reuse this codebase", "what's the right tech stack". At this stage the goal was understanding and decision-making, not code generation.

**Middle (implementation):** Phase-level prompts with uploaded code files for context — "here are my current files, give me Phase 3". The pattern of "explain scope first, then code" became consistent after Phase 2, because it made it easier to verify that the output matched what was agreed.

**Later (debugging):** Targeted, symptom-based prompts — "I got this error, here is the file, here is what I expected". Screenshots and error messages were included. The AI role shifted from code generation to diagnosis.

**Final (refinement and docs):** Specific, constrained prompts — "fix only this one thing, don't change anything else", "generate architecture.md following this exact structure, using only what is actually implemented". Prompts explicitly called out what should not be invented.

---

## Overall Role of AI

AI was used throughout the project for implementation assistance, architecture discussion, debugging, and documentation. It produced the majority of the code across all phases, accelerated the debugging process by providing targeted explanations of root causes, and generated structured documentation from the actual implementation.

All AI outputs required verification. The Phase 2 integration bugs are the clearest example of where code that looked correct in isolation failed in combination. The debugging prompts that followed were the most valuable interactions in the project — not because AI wrote the fix immediately, but because having a clear explanation of each bug's root cause made it possible to verify that each fix was correct rather than just trying things until something worked.

The most important constraint throughout: understanding what was produced well enough to explain it in a technical interview. Any part of the codebase that was accepted without understanding was reviewed until the logic was clear.
