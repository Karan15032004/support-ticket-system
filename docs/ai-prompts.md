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
| Documentation | architecture.md, plan.md, decisions.md, ai-prompts.md | All 5 docs written |

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
> "You already have full context of my SupportHub / Support Ticket Management System project and its implementation so far. Use that existing project knowledge as the primary source of truth. Do NOT ask me to re-explain the architecture, technology stack, implemented features, or project execution unless you genuinely encounter a missing detail that cannot be determined from the existing context.

I now want you to create:

docs/architecture.md

This document will be submitted as part of the project documentation, so write it as polished, professional engineering documentation that demonstrates that I understand how the system is structured and how it works.

============================================================
PRIMARY OBJECTIVE
============================================================

The architecture document should answer ONLY these five core questions:

1. What are the moving pieces of the system?
2. How do those pieces communicate with each other?
3. Where does each piece run, both locally and in production?
4. What is the request path for ONE representative user action from beginning to end?
5. What did we deliberately decide NOT to build / what is outside the current scope?

These five questions are the priority.

Do NOT turn this into a general project README, feature list, tutorial, or implementation diary.

============================================================
DOCUMENTATION PHILOSOPHY
============================================================

The document should follow this progression:

BIG PICTURE
    ↓
MOVING PIECES
    ↓
HOW THEY COMMUNICATE
    ↓
WHERE THEY RUN
    ↓
ONE REAL END-TO-END REQUEST
    ↓
IMPORTANT ARCHITECTURAL EXAMPLES
    ↓
WHAT WE DELIBERATELY DID NOT BUILD

The reader should be able to progressively zoom into the system.

Start with the architecture at a high level, then explain the components, then demonstrate how the architecture behaves through real examples from THIS project.

Do not merely say things like:

"React communicates with FastAPI."

Instead, whenever useful, connect the explanation to an actual implementation from the project.

For example:

"An Agent resolving a ticket triggers a PATCH request from the React frontend to the FastAPI ticket router, where authentication, authorization, lifecycle validation, SLA handling, persistence, and event creation occur before the response is returned to the frontend."

Use real project concepts, routes, components, services, database entities, and architectural decisions that actually exist in the project.

Do NOT invent functionality that has not been implemented.

============================================================
CONCISENESS IS IMPORTANT
============================================================

This is a documentation file, NOT a 10-page report.

Priority:

1. Clarity
2. Accuracy
3. Visual communication
4. Conciseness

Avoid unnecessary explanations, repetition, generic definitions, and obvious statements.

Prefer:

- short paragraphs
- concise bullet points
- compact tables where useful
- diagrams
- flow descriptions
- architecture-specific terminology

Every section should justify its existence.

If something can be explained more clearly with a diagram than with 3 paragraphs of text, use a diagram.

Aim for a concise document that someone can realistically read in approximately 5–8 minutes.

============================================================
DIAGRAMS — VERY IMPORTANT
============================================================

Use diagrams wherever they materially improve understanding AND make the architecture document visually appealing.

Prefer Mermaid diagrams because the final document is Markdown.

Potential diagrams include:

- High-level system architecture
- Deployment architecture
- Component communication / request flow
- One representative end-to-end request sequence
- Database relationship overview, if useful
- Authentication/request authorization flow, if useful

Do NOT create diagrams merely for decoration.

Each diagram should communicate something that would otherwise require significant text.

Use appropriate Mermaid diagram types:

- flowchart for architecture/component relationships
- sequenceDiagram for request/response flows
- ER diagram for database relationships when useful

IMPORTANT:

If you are able to directly include Mermaid diagrams in the generated architecture.md, do so.

If a diagram IS NOT possible to be made directly in the final architecture.md, then separately provide me with the Mermaid code for that diagram.

For every separately provided Mermaid diagram, clearly tell me:

1. The Mermaid code
2. What the diagram represents
3. EXACTLY where I should paste it in docs/architecture.md

For example:

"Paste this immediately after the `## Deployment Architecture` heading."

Do NOT simply give me Mermaid code without telling me where it belongs.

I want diagrams to be usable directly with mermaid.ai if necessary.

============================================================
SECTION STRUCTURE
============================================================

Use a clean structure along these lines, but adapt it if the actual project context suggests a better organization:

# SupportHub Architecture

A very short introduction explaining what this document covers.

## 1. System Overview

Explain the architecture at a high level.

Show the major pieces and their relationships.

Include a high-level Mermaid architecture diagram.

The reader should understand the complete system after this section without needing implementation details.

------------------------------------------------------------

## 2. Moving Pieces

Explain the major architectural components.

Cover only the pieces that matter to understanding the system, such as:

- Frontend
- Backend/API
- Authentication/authorization
- Database
- Important supporting components/services
- Major frontend/backend boundaries

For each piece briefly explain:

- What it does
- Its responsibility
- How it fits into the overall system

Where useful, map architectural components to actual project structure/files.

Do not dump the entire folder tree.

Only mention files/folders that help explain architecture.

------------------------------------------------------------

## 3. How the Pieces Communicate

Explain the communication model.

Clearly describe:

Frontend
    ↓
HTTP/JSON
    ↓
FastAPI
    ↓
business logic / authorization
    ↓
SQLAlchemy
    ↓
PostgreSQL / Supabase

Explain authentication at the appropriate level, including how the JWT participates in requests.

Explain where authorization happens.

Explain what the frontend is responsible for versus what the backend is responsible for.

Include a compact diagram if useful.

------------------------------------------------------------

## 4. Where Each Piece Runs

Explain both development and production environments.

Show the deployment architecture visually.

Clearly distinguish:

LOCAL DEVELOPMENT

and

PRODUCTION

Use the actual project setup/context already known to you.

For production, show the relationship between:

- Frontend hosting
- Backend hosting
- Supabase/PostgreSQL

Do not over-explain deployment commands.

The purpose of this section is simply to make it obvious WHERE each architectural piece runs and HOW they connect.

------------------------------------------------------------

## 5. Representative End-to-End Request

This is one of the MOST IMPORTANT sections.

Choose ONE representative user action from the actual implemented system that demonstrates the architecture particularly well.

Prefer an action that crosses the most architectural boundaries.

A strong candidate is:

"Agent resolves a ticket"

if the current implementation supports it as understood from the project context.

Trace the action from:

User interaction
    ↓
React UI
    ↓
API client
    ↓
HTTP request
    ↓
FastAPI route
    ↓
Authentication
    ↓
Authorization
    ↓
Business logic
    ↓
Database interaction
    ↓
Event/audit handling where applicable
    ↓
Response
    ↓
Frontend state/UI update

Use a Mermaid sequence diagram for this if possible.

The explanation should make it clear WHAT happens at each step and WHY that layer is responsible for it.

Do not make this generic.

Use actual project concepts such as actual route patterns, frontend components, authentication mechanisms, database entities, and business rules.

------------------------------------------------------------

## 6. Architectural Examples from the Project

Keep this section SHORT.

The goal is NOT to document every feature.

Instead, use 2–4 important implemented features as compact examples showing how the architecture handles real requirements.

Choose the examples that best demonstrate architectural decisions.

Possible examples include:

- Authentication
- Ticket creation
- Ticket lifecycle + SLA
- Assignment/collaboration
- Immutable event timeline
- SLA alerts

For each example:

- briefly state the feature
- identify the important architectural pieces involved
- explain how they interact
- include a diagram only if it genuinely improves understanding

Do not repeat the full end-to-end request flow for every feature.

The representative request section should be the detailed flow.

These examples should instead reinforce the architecture.

------------------------------------------------------------

## 7. What We Deliberately Did Not Build

This section is important.

Do not present these as random missing features.

Frame them as explicit scope boundaries and architectural decisions.

Use the actual project context to identify functionality that was intentionally left outside the current implementation.

For each important boundary, briefly explain:

WHAT is not implemented
+
WHY it is outside the current scope / why the current architecture does not require it

Examples may include things such as:

- customer authentication
- direct email ingestion
- WebSockets / real-time communication
- attachment/file storage
- password recovery
- external notification delivery

BUT:

Only include items that are actually consistent with the project context.

Do NOT invent exclusions.

------------------------------------------------------------

## 8. Architecture Summary

End with a very short summary.

In approximately one compact paragraph, explain the architectural idea of SupportHub:

- frontend
- backend
- database
- server-side business rules
- authentication/authorization
- deployment separation

The reader should leave with a clear mental model of the system.

============================================================
STYLE REQUIREMENTS
============================================================

Write like a senior software engineer documenting a production-oriented system.

Tone:

- professional
- technical
- clear
- confident
- concise

Avoid:

- marketing language
- excessive adjectives
- unnecessary emojis
- generic textbook explanations
- repeating the same concept
- explaining basic programming concepts
- giant paragraphs
- giant tables
- excessive headings

Use Markdown effectively:

- headings
- bullets
- compact tables
- bold for important architectural concepts
- inline code for routes/files/components
- Mermaid diagrams

Make the document visually balanced.

Do NOT make every section a wall of text.

============================================================
ACCURACY RULE
============================================================

The existing project context is the source of truth.

Do not invent:

- endpoints
- components
- database tables
- services
- deployment infrastructure
- business rules
- architectural patterns

If something is unclear from the existing project context, explicitly flag it rather than silently making up an implementation.

Also distinguish between:

IMPLEMENTED
and
PLANNED / FUTURE

Do not describe planned functionality as if it already exists.

============================================================
FINAL QUALITY CHECK
============================================================

Before presenting the final architecture.md, internally verify:

[ ] Does it clearly explain the moving pieces?
[ ] Does it explain how the pieces communicate?
[ ] Does it explain where each piece runs?
[ ] Does it contain ONE detailed end-to-end request path?
[ ] Does that request path use a real implemented project action?
[ ] Does it use diagrams where they improve understanding?
[ ] Are Mermaid diagrams valid and usable?
[ ] If a diagram cannot be embedded, did you separately provide Mermaid code AND exact placement instructions?
[ ] Does it explain important architectural examples without becoming repetitive?
[ ] Does it clearly explain what was deliberately not built?
[ ] Is it concise enough that someone would actually read it?
[ ] Does it accurately reflect the current implementation?
[ ] Does it avoid inventing functionality?
[ ] Does the document look polished and visually appealing?

The final result should feel like a concise architecture document for a real software system — not an assignment answer.

Most importantly:

DO NOT optimize for maximum length.

Optimize for:

CLARITY + VISUAL EXPLANATION + TECHNICAL ACCURACY + CONCISENESS."

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
