# Plan

---

## How did you break the work into sessions?

The project ran across five sessions. The first session had no code in it at all — it was entirely about understanding what needed to be built before touching a keyboard.

**Session 1 — Understanding and Planning (Aug 29)**
Read the README from start to finish, clarified every ambiguous requirement, evaluated whether a friend's existing ticket management codebase (TicketMind) could be reused, decided it couldn't, agreed on the tech stack, and produced a four-day build roadmap. No code written. Output: a shared mental model of the product and a clear build order.

**Session 2 — Foundation (Aug 31)-Phase 1**
Everything needed before any ticket code could be written: Supabase account setup, all six database tables created via manual SQL, JWT authentication endpoints, Argon2 password hashing, role-based routing, and placeholder frontend pages for both roles. The session ended with a working login: supervisor goes to `/dashboard`, agent goes to `/my-tickets`.

**Session 3 — Ticket Core (Sep 2, morning)-Phase 2**
All ticket-related functionality: CRUD endpoints, status lifecycle with server-side validation, replies with internal notes, collaborators, SLA clock with pause/resume logic, immutable event timeline, and the three frontend pages (supervisor list, agent worklist, shared ticket detail). Also added the live alert count bell badge to both navbars at the end of the session.

**Session 4 — Advanced Features (Sep 2, afternoon)-Phase 3**
Server-side search, filter, sort, and pagination. Bulk reassign and bulk close with per-ticket results. CSV export. Archive and restore. Complete SLA alerts page with acknowledge logic and refire on reopen.

**Session 5 — Fixes, Polish, and Deployment (Sep 3–4)-Phase 4**
Fixed bugs found during testing: priority edit feature added (discovered as a gap during QA), archive page not displaying archived tickets, and agent permission corrections. Deployed backend to Render, frontend to Vercel. Fixed Vercel SPA routing 404. Wrote all five documentation files and completed `SUBMISSION.md`.

---

## What order did I build in, and why that order?

**Database schema before any backend code.**
Every endpoint touches the database. Getting the table structure right first — including the SLA-specific fields `pending_since`, `total_paused_seconds`, and `response_due_at` directly on the tickets row — meant no schema changes mid-build. Changing a column after endpoints are written means rewriting both.

**Authentication before tickets.**
There was no point building ticket endpoints without a working `get_current_user` dependency to protect them. Every protected route needed auth to exist first. Building ticket endpoints without auth would have meant rewriting them all when it was added.

**Backend endpoints before frontend pages.**
The frontend is a consumer of the API. Building it against a working API meant no mocking, no guessing about response shapes, and no discovering mismatches after the UI was already built. Frontend pages built after their corresponding endpoints worked on the first connection instead of requiring a second rewrite.

**Core ticket workflow before advanced features.**
Server-side filtering, bulk actions, and CSV export are all built on top of a working ticket model. Phase 3 would have been significantly harder if basic CRUD, status transitions, and SLA logic hadn't been solid first.

**Functional correctness before UI polish.**
Feature logic was locked in before spending time on visual refinement. Getting the SLA pause logic and lifecycle validation right mattered more than badge colors during development. This prevented rebuilding polished UI on top of broken functionality.

**All features before documentation.**
The docs (especially `plan.md`, `decisions.md`, and `ai-prompts.md`) describe what was actually built. Writing them first would have been speculation. They were written against the real implementation.

---

## What did I estimate versus what it actually took?

The original plan was a clean four-day build covering all 10 features, documented in a four-session roadmap produced during Session 1. In practice it took five sessions, with two of them being longer than planned.

| Area | Original Estimate | What Actually Happened |
|------|------------------|----------------------|
| Project setup and repo | Low effort, quick | About right — manual Supabase table creation took slightly longer than expected |
| Authentication (Phase 1) | Straightforward | More than expected — port 5432 blocked, `#` in password needed percent-encoding, `create_all()` crashed on startup, bcrypt incompatible with Python 3.13. Each required diagnosis time |
| Ticket backend (Phase 2) | One session | About right for the logic itself |
| Phase 2 frontend integration | Medium | Significantly more than expected — four separate bugs hit simultaneously when frontend connected to backend for the first time: `useNavigate` outside Router context, `<Outlet />` vs `{children}` in `PrivateRoute`, double `/auth` prefix, stale closure in `useEffect`. None produced an obvious error message |
| Phase 3 advanced features | One session | About right — uploading live files before code generation (a lesson from Phase 2) reduced integration bugs significantly |
| Dashboard and alerts | Medium | Slightly less than expected — backend work carried naturally from Phase 3 |
| Deployment | Low–Medium | More than expected — Vercel returned 404 on all React Router routes (fixed with `vercel.json` rewrite rule), and `VITE_API_URL` wasn't picked up because it was added after the first build (fixed by manual redeploy) |
| Documentation | Medium | In line with expectations — took about half a session across all five files |

No exact hours were tracked during development. The estimates above are qualitative, not quantitative.

---

## What did you cut when you ran short?

Nothing from the 10 required features was cut. All 10 were implemented. The items below were considered at various points and deliberately left out because they weren't in scope or weren't worth the time relative to what they'd add:

**Email notifications.** When a ticket is assigned or replied to, there's no email sent. This would need an outbound mail provider (SendGrid, Mailgun) and would have consumed significant time with no assignment credit. The SLA alerts page serves as the in-app equivalent.

**WebSocket real-time updates.** The ticket list doesn't update automatically when another agent makes a change — it requires a manual refresh. Polling `GET /alerts/count` every 60 seconds was the chosen approach for the bell badge. WebSocket connection management was not worth the added complexity within the time available.

**Pagination on replies and event timeline.** Both `GET /tickets/{id}/replies` and `GET /tickets/{id}/events` return all rows without pagination. At current scale this is fine, but at 100x data volume both would become slow. Adding cursor-based pagination wasn't prioritised because the assignment's demo scale didn't require it.

**Password reset flow.** No email provider is configured, so no reset link could be delivered. Credentials are seeded directly into the database. This was acknowledged as a gap but left out because solving it correctly would have required setting up email infrastructure for one feature not in the assignment requirements.
