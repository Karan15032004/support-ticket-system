# Technical Decisions

## Decision 1: Argon2 Instead of bcrypt for Password Hashing

**Chosen:** argon2-cffi
**Rejected:** passlib[bcrypt]

**Why:**
passlib's bcrypt integration is broken on Python 3.13. The error
`AttributeError: module 'bcrypt' has no attribute '__about__'` occurs
because bcrypt 4.x removed the `__about__` module that passlib expects.

Argon2 was chosen as the replacement because:
- It is the winner of the 2015 Password Hashing Competition
- It is more resistant to GPU cracking than bcrypt
- argon2-cffi works correctly on Python 3.13
- The API is simple: `ph.hash(password)` and `ph.verify(hash, password)`

**Impact:** All password hashes in the database use the Argon2id format.
Any user created via seed scripts must use argon2-cffi's PasswordHasher.

---

## Decision 2: Session Pooler (Port 6543) Instead of Direct Connection (Port 5432)

**Chosen:** Supabase Session Pooler on port 6543
**Rejected:** Direct PostgreSQL connection on port 5432

**Why:**
The home network's ISP blocks outbound connections on port 5432.
Supabase's Session Pooler operates on port 6543, which passes through
most firewalls and NAT configurations.

**Trade-offs:**
- Session Pooler adds a small latency overhead (~1-2ms) vs direct connection
- Some advanced PostgreSQL features (LISTEN/NOTIFY) don't work through pooler
- Neither limitation matters for this application's use case

**Reversal note:** This was initially attempted with the direct connection string.
After the connection failed, the Session Pooler string was tried and succeeded.
The direct connection will be used on Render (production), where port 5432
is not blocked.

---

## Decision 3: Single Login Page for All Roles

**Chosen:** One `/login` page that redirects based on role after authentication
**Rejected:** Separate `/supervisor/login` and `/agent/login` pages

**Why:**
The assignment specification explicitly states: "A single login page.
The server checks credentials, reads the role from the database, and
redirects the user automatically to the correct home screen."

This also makes more sense for users — they don't need to know or choose
their role when logging in. The system knows their role.

---
we added the categories to which our tickets could belong:
-Billing:If user experiences any issue with billing,like why were they charged twice?
-Technical:For users experiencing any technical issues,like some features not working or any inconsistencies.
-How to:If users dont understand the working of any feature,they might ask us and this way our agents can reply to them 
-Account:for account related issues
-Feature request:If user wants to request any features
-Other:These were all the general categories In Which I could think the issues could have come,if the user query was anything else,then that ticket will come under this category

---
Added numbers on top of the bell which shows the SLA alerts,these numbers signify how many alerts are pending to be resolved
---
