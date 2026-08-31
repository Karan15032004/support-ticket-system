# AI Prompts Used

This document records all AI assistance used in building this project,
as required by the assignment specification.

---

## Phase 1: Project Setup and Authentication

### Prompt Group 1: Initial Project Planning

**What I was trying to do:** Understand the full scope of the project and
plan the build order.

**Prompt used:**
"Act as a professional software developer assistant with 15+ years of industry
experience. I have given you 2 documents: first is the readme file for the ticket
management system we are about to build and second is the complete thinking which
we have been able to figure out about the project till now. Read both documents,
understand everything we are about to do and starting from phase 1 give me the
code and before that the understanding of what each code is meant to do."

**What it produced:** A complete Phase 1 breakdown with all backend and frontend
files, explained line by line.

**Was it correct?** Mostly yes. The structure and logic were correct.
Several issues were encountered during implementation (see below).

---

### Prompt Group 2: Database Connection Issues

**What I was trying to do:** Fix the Supabase connection error.

**Prompt used:**
"still getting this error: psycopg2.OperationalError: could not translate host
name 'db.gytwmvpvvckfdxiwtiwg.supabase.co' to address: Unknown server error"

**What it produced:** A series of diagnostic steps — ping test, socket
connection test, checking `.env` file format.

**What went wrong:** The first suggestion (fix the password encoding) was
correct but did not solve the issue. The underlying problem was that port 5432
is blocked on the local network, not a configuration error.

**What I did about it:** Ran `python test_connection.py` which confirmed
the host was unreachable. Eventually switched to Session Pooler (port 6543)
which resolved the issue.

---
## How AI Was Used Overall

- AI generated the initial code structure and explained each file
- AI was used as a debugging assistant when errors occurred
- All code was read and understood before being used
- Several AI suggestions were wrong on the first attempt (bcrypt fix,
  initial connection string advice) and required iteration
- Final decisions on architecture (Session Pooler vs SQLite, Argon2 vs bcrypt)
  were made after understanding the trade-offs, not blindly following suggestions