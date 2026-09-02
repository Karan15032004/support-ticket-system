"""
seed.py — Demo Data Script

Creates realistic demo data so reviewers can assess all features
without manually creating tickets. Run this ONCE before submission.

What it creates:
  - 1 supervisor (supervisor@test.com / SupervisorPass123)
  - 4 agents (agent1@test.com through agent4@test.com / password123)
  - 50 tickets spread across all statuses, priorities, categories
  - Multiple replies per ticket (customer-visible + internal notes)
  - Collaborators on some tickets
  - Some tickets breaching SLA (for the alert page to show red cards)
  - Some tickets near SLA breach (yellow cards)
  - Some archived tickets

HOW TO RUN:
  cd backend
  python seed.py

The script is safe to re-run — it checks for existing users first
and skips creation if they already exist. Tickets are always added fresh.

IMPORTANT: Run this on your local machine against Supabase.
The same data will be visible when you deploy because it's stored
in the shared PostgreSQL database on Supabase.
"""

import sys
import os
from datetime import datetime, timedelta
import random

# ── Path setup ────────────────────────────────────────────────────────────────
# We're running this from the /backend directory as "python seed.py"
# so we need to add the parent directory to sys.path so "from app.xxx" works.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models import (
    User, Ticket, Reply, TicketEvent, Collaborator, SlaAlert,
    UserRole, TicketStatus, TicketPriority, TicketCategory, EventType
)
from argon2 import PasswordHasher

ph = PasswordHasher()

# ─────────────────────────────────────────────
# User definitions
# ─────────────────────────────────────────────

USERS = [
    {
        "email": "supervisor@test.com",
        "password": "SupervisorPass123",
        "name": "Rahul Sharma",
        "role": UserRole.supervisor,
    },
    {
        "email": "agent1@test.com",
        "password": "password123",
        "name": "Priya Patel",
        "role": UserRole.agent,
    },
    {
        "email": "agent2@test.com",
        "password": "password123",
        "name": "Arjun Singh",
        "role": UserRole.agent,
    },
    {
        "email": "agent3@test.com",
        "password": "password123",
        "name": "Divya Nair",
        "role": UserRole.agent,
    },
    {
        "email": "agent4@test.com",
        "password": "password123",
        "name": "Vikram Mehta",
        "role": UserRole.agent,
    },
]

# ─────────────────────────────────────────────
# Ticket templates
# ─────────────────────────────────────────────

# 50 realistic support ticket subjects + descriptions
TICKET_TEMPLATES = [
    {
        "subject": "Cannot login to my account",
        "description": "I have been trying to login since yesterday but keep getting 'Invalid credentials' error. I have reset my password twice but the problem persists. Please help urgently.",
        "requester_name": "Amit Khanna",
        "category": TicketCategory.account,
    },
    {
        "subject": "Incorrect charge on my invoice",
        "description": "My invoice for March 2025 shows a charge of ₹4,999 but my plan is only ₹2,499 per month. Please check and issue a refund for the difference.",
        "requester_name": "Sunita Verma",
        "category": TicketCategory.billing,
    },
    {
        "subject": "Dashboard not loading after update",
        "description": "After the update deployed on 15th March, the main dashboard shows a blank white screen. I cleared cache, tried different browsers, same issue. My team of 12 people is affected.",
        "requester_name": "Rajesh Kumar",
        "category": TicketCategory.technical,
    },
    {
        "subject": "How do I export data to Excel?",
        "description": "I need to export the last 6 months of transaction data to Excel for an audit. I can see the data on screen but cannot find the export button. Is this a feature that exists?",
        "requester_name": "Meena Iyer",
        "category": TicketCategory.how_to,
    },
    {
        "subject": "Request to add bulk user import",
        "description": "We are onboarding 200 new employees next month. Manually adding each user one by one will take forever. Can you please add a bulk CSV import feature? This would be very helpful.",
        "requester_name": "Harsh Gupta",
        "category": TicketCategory.feature_request,
    },
    {
        "subject": "Two-factor authentication not working",
        "description": "The 6-digit OTP sent to my phone is always expired by the time I enter it — it says 'Code expired, please try again'. I have a slow phone. The timeout is too short.",
        "requester_name": "Pooja Desai",
        "category": TicketCategory.account,
    },
    {
        "subject": "Subscription renewal failed",
        "description": "My subscription was due for renewal on 10th March. My card was charged but the system still shows my account as expired. I have the bank statement as proof.",
        "requester_name": "Sanjay Bhat",
        "category": TicketCategory.billing,
    },
    {
        "subject": "API returning 500 errors",
        "description": "Our integration with your API has been failing since 2 AM IST today. The endpoint POST /api/v2/orders is returning 500 Internal Server Error. This is blocking all our orders.",
        "requester_name": "Tech Team - Flipkart",
        "category": TicketCategory.technical,
    },
    {
        "subject": "How to set up team permissions?",
        "description": "We want some users to have read-only access and others to have edit access. How do we configure this? We couldn't find it in the settings panel.",
        "requester_name": "Kavitha Rao",
        "category": TicketCategory.how_to,
    },
    {
        "subject": "Request: Dark mode",
        "description": "Please add a dark mode option. Our team works late nights and the white background strains the eyes. Even a basic dark mode would help a lot.",
        "requester_name": "Nikhil Sharma",
        "category": TicketCategory.feature_request,
    },
    {
        "subject": "File upload limit too low",
        "description": "The current 5MB file upload limit is too restrictive for our engineering drawings which are 15-25MB. Can this be increased for our enterprise account?",
        "requester_name": "Ananya Krishnan",
        "category": TicketCategory.technical,
    },
    {
        "subject": "Wrong GST number on invoice",
        "description": "The GST number on all our invoices is wrong. We updated it in account settings 3 months ago but invoices are still showing the old number. This is causing audit issues.",
        "requester_name": "CFO Office - Tata Consultancy",
        "category": TicketCategory.billing,
    },
    {
        "subject": "Password reset email not received",
        "description": "I requested a password reset 4 times today but never received the email. Checked spam folder, not there. My colleague at the same company received theirs immediately.",
        "requester_name": "Rahul Agarwal",
        "category": TicketCategory.account,
    },
    {
        "subject": "How to generate monthly reports?",
        "description": "We need to generate a monthly usage report for our management. I see the Reports section but all options are greyed out. Do we need to upgrade our plan?",
        "requester_name": "Pradeep Nambiar",
        "category": TicketCategory.how_to,
    },
    {
        "subject": "App crashes on Android 13",
        "description": "The mobile app crashes immediately on launch on Android 13. It was working fine before the latest app update (v3.2.1). iPhone version works fine. Affects 40+ of our users.",
        "requester_name": "Shreya Banerjee",
        "category": TicketCategory.technical,
    },
    {
        "subject": "Duplicate charges in February",
        "description": "I was charged twice on Feb 28th — once at 11:55 PM and once at 12:01 AM. I think it's a timezone issue in your billing cycle. Please refund one charge.",
        "requester_name": "Kiran Malhotra",
        "category": TicketCategory.billing,
    },
    {
        "subject": "Integration with Slack not working",
        "description": "We set up the Slack integration last week using the official guide but notifications are not being sent to our channel. The connection status shows 'Active' but nothing comes through.",
        "requester_name": "Dev Team - Swiggy",
        "category": TicketCategory.technical,
    },
    {
        "subject": "Request: Mobile app for iOS",
        "description": "Is there a native iOS app available or planned? The mobile website is slow and we really need push notifications which only work in native apps. Our sales team is mobile-first.",
        "requester_name": "Sales Head - Zepto",
        "category": TicketCategory.feature_request,
    },
    {
        "subject": "Account locked after travel",
        "description": "I was traveling to the US and my account got locked because of logins from a new IP. Now I cannot unlock it because the verification goes to an Indian number I had left behind.",
        "requester_name": "Vikash Singh",
        "category": TicketCategory.account,
    },
    {
        "subject": "How to add team members?",
        "description": "I am the admin of our organisation account but I cannot figure out how to add new team members. There is no 'Invite' button that I can find on the Team page.",
        "requester_name": "Deepa Pillai",
        "category": TicketCategory.how_to,
    },
    {
        "subject": "Data sync delay of 3+ hours",
        "description": "Our data from the connected CRM is showing a 3 hour delay in your system. The real-time sync that we were promised during sales is not working. This affects our reporting.",
        "requester_name": "Operations Lead - Meesho",
        "category": TicketCategory.technical,
    },
    {
        "subject": "Proforma invoice not matching final invoice",
        "description": "The proforma invoice we received before purchase showed ₹8,999 but the final tax invoice shows ₹10,799. The extra amount is not explained anywhere on the invoice.",
        "requester_name": "Accounts Team - Nykaa",
        "category": TicketCategory.billing,
    },
    {
        "subject": "Forgot username — cannot recover",
        "description": "I forgot which email I used to register my account. The 'Forgot Username' link on the login page does not work — it says 'Feature coming soon'. Please help.",
        "requester_name": "Aarti Chawla",
        "category": TicketCategory.account,
    },
    {
        "subject": "How to set up email notifications?",
        "description": "I want to receive an email every time a ticket is assigned to me but I cannot find the notification settings. My colleague says there is a bell icon somewhere but I cannot see it.",
        "requester_name": "Manish Tiwari",
        "category": TicketCategory.how_to,
    },
    {
        "subject": "Request: Audit log for admin actions",
        "description": "We need to see a log of which admin performed which action and when, for compliance purposes. This is a hard requirement from our internal security team. GDPR audit.",
        "requester_name": "CISO Office - HDFC Life",
        "category": TicketCategory.feature_request,
    },
    {
        "subject": "Search function returning wrong results",
        "description": "When I search for 'invoice January', the results show tickets from March and April but not January. The search seems to be broken or searching the wrong field.",
        "requester_name": "Rekha Joshi",
        "category": TicketCategory.technical,
    },
    {
        "subject": "Charged after cancellation",
        "description": "I cancelled my subscription on March 1st. I received a cancellation confirmation email. But I was still charged on March 15th. Please refund and confirm cancellation.",
        "requester_name": "Rohit Dubey",
        "category": TicketCategory.billing,
    },
    {
        "subject": "Cannot change email address",
        "description": "I tried to update my email address in account settings. It sends a verification to the new email, I click the link, but the change never saves. Still shows the old email.",
        "requester_name": "Geeta Krishnamurthy",
        "category": TicketCategory.account,
    },
    {
        "subject": "How to run custom SQL queries?",
        "description": "Our data analyst wants to run custom SQL against our data in your system. The documentation mentions a 'Query Builder' but we cannot find it in our Business plan.",
        "requester_name": "Analytics Team - Dream11",
        "category": TicketCategory.how_to,
    },
    {
        "subject": "Critical: Production database unreachable",
        "description": "URGENT: Our production environment cannot connect to the database since 8:30 AM IST. Error: Connection timeout. All our customers are affected. Revenue impact is ₹50,000/min.",
        "requester_name": "CTO - Razorpay",
        "category": TicketCategory.technical,
    },
    {
        "subject": "Refund not credited after 15 days",
        "description": "I raised a refund request on March 2nd and was told it would be credited in 5-7 business days. It has been 15 days and I still have not received the refund. Order #RZP-2025-4421.",
        "requester_name": "Suresh Yadav",
        "category": TicketCategory.billing,
    },
    {
        "subject": "Request: Webhook support",
        "description": "We need webhooks to trigger when certain events happen (ticket created, status changed, etc.) so we can automate our internal workflows. Currently we are polling the API every minute.",
        "requester_name": "Backend Team - Urban Company",
        "category": TicketCategory.feature_request,
    },
    {
        "subject": "Profile picture not uploading",
        "description": "I click 'Upload photo', select a JPG file, it shows a preview, but when I click Save nothing happens. No error message. The profile picture stays the old one.",
        "requester_name": "Namita Kapoor",
        "category": TicketCategory.account,
    },
    {
        "subject": "How to transfer ownership of account?",
        "description": "Our previous CTO who created the account has left the company. How do we transfer account ownership to the new CTO? The original email is inaccessible.",
        "requester_name": "HR Director - Byju's",
        "category": TicketCategory.how_to,
    },
    {
        "subject": "Notification emails going to spam",
        "description": "All emails from your system — including ticket updates, invoices, and alerts — are landing in our spam folder. Our IT team whitelisted your domain but it is still happening.",
        "requester_name": "IT Team - Infosys",
        "category": TicketCategory.technical,
    },
    {
        "subject": "Upgrade to annual plan — billing confusion",
        "description": "I upgraded from monthly to annual billing mid-cycle. The prorated charge was confusing and I was charged more than expected. Please send a detailed breakdown.",
        "requester_name": "Lalit Mishra",
        "category": TicketCategory.billing,
    },
    {
        "subject": "Request: Custom branding on emails",
        "description": "Our white-label clients receive emails with your company logo. We need to replace this with our own branding. Is custom email branding available on the Enterprise plan?",
        "requester_name": "Product Manager - Paytm",
        "category": TicketCategory.feature_request,
    },
    {
        "subject": "Session expires too quickly",
        "description": "My session expires after just 15 minutes of inactivity. For a complex task that involves reading documents and entering data, this forces me to log in multiple times. Very frustrating.",
        "requester_name": "Preethi Subramanian",
        "category": TicketCategory.account,
    },
    {
        "subject": "How to create custom fields?",
        "description": "We need custom fields on our support tickets — specifically a 'Customer Tier' field with values Gold/Silver/Bronze. The FAQ mentions this but I cannot find it in settings.",
        "requester_name": "Support Lead - Udaan",
        "category": TicketCategory.how_to,
    },
    {
        "subject": "Charts not rendering in Firefox",
        "description": "All the analytics charts on the Reports page show a blank box in Firefox 121. They work in Chrome and Edge. Our team primarily uses Firefox. Please fix.",
        "requester_name": "Quality Team - PhonePe",
        "category": TicketCategory.technical,
    },
    {
        "subject": "Unexpected tax applied to invoice",
        "description": "We are a registered non-profit (80G registered). We previously were charged without GST. This month's invoice includes 18% GST. Please correct this and reissue the invoice.",
        "requester_name": "Finance - GiveIndia",
        "category": TicketCategory.billing,
    },
    {
        "subject": "Request: Offline mode for mobile",
        "description": "Our field agents often work in areas with poor connectivity. They need to fill forms and log data offline which then syncs when connectivity is restored. Is this planned?",
        "requester_name": "Field Ops - BigBasket",
        "category": TicketCategory.feature_request,
    },
    {
        "subject": "Shared inbox not showing all messages",
        "description": "Our shared support inbox is missing emails from two specific domains. We receive the emails in Gmail but they do not appear in your platform. Others work fine.",
        "requester_name": "Support Manager - Naukri",
        "category": TicketCategory.technical,
    },
    {
        "subject": "How to configure SLA policies?",
        "description": "We want different SLA targets for different customer tiers — VIP customers should get 1-hour response time, standard customers 4 hours. How do we configure this in settings?",
        "requester_name": "Success Team - Freshworks",
        "category": TicketCategory.how_to,
    },
    {
        "subject": "Data export taking too long",
        "description": "When I try to export 3 years of data, the export button just shows a spinner and nothing downloads. I waited 30 minutes. The progress bar never moves past 0%.",
        "requester_name": "Data Team - PolicyBazaar",
        "category": TicketCategory.technical,
    },
    {
        "subject": "Annual plan pricing discrepancy",
        "description": "Your website shows ₹29,999/year for the Business plan but I was charged ₹35,999. I have a screenshot of the pricing page. Please honour the advertised price.",
        "requester_name": "Himanshu Chauhan",
        "category": TicketCategory.billing,
    },
    {
        "subject": "Multi-factor authentication reset request",
        "description": "I lost my phone which had the authenticator app. I cannot log in to my account. I need MFA reset urgently. I can provide my PAN card and company email for verification.",
        "requester_name": "Shweta Chandra",
        "category": TicketCategory.account,
    },
    {
        "subject": "How to archive old projects?",
        "description": "We have 200+ completed projects cluttering our workspace. How do we archive them so they don't appear in search results but we can still access them if needed?",
        "requester_name": "Project Lead - L&T Infotech",
        "category": TicketCategory.how_to,
    },
    {
        "subject": "Request: Calendar view for tasks",
        "description": "A calendar view showing tasks and deadlines would greatly improve our planning. Currently everything is in list view. Even a simple month/week view would be very useful.",
        "requester_name": "Product Team - Myntra",
        "category": TicketCategory.feature_request,
    },
    {
        "subject": "Critical: All data disappeared after migration",
        "description": "CRITICAL: We migrated our account from the old platform yesterday. The migration completed successfully according to your team, but ALL our data — 3 years of records — is missing. Please escalate immediately.",
        "requester_name": "VP Engineering - Ola",
        "category": TicketCategory.technical,
    },
]


# ─────────────────────────────────────────────
# Status and priority distributions
# ─────────────────────────────────────────────

# Weighted distribution — more open/pending than resolved/closed
# so the dashboard looks like an active support system
STATUS_WEIGHTS = [
    (TicketStatus.new,      10),  # 10 new tickets
    (TicketStatus.open,     18),  # 18 open (most of queue)
    (TicketStatus.pending,  10),  # 10 pending (waiting on customer)
    (TicketStatus.resolved, 8),   # 8 resolved
    (TicketStatus.closed,   4),   # 4 closed
]

PRIORITY_WEIGHTS = [
    (TicketPriority.critical, 6),   # 6 critical — these should breach SLA
    (TicketPriority.high,     14),  # 14 high
    (TicketPriority.medium,   20),  # 20 medium
    (TicketPriority.low,      10),  # 10 low
]

SLA_HOURS_MAP = {
    TicketPriority.critical: 1,
    TicketPriority.high:     4,
    TicketPriority.medium:   8,
    TicketPriority.low:      24,
}

# Reply bodies — customer-visible replies
CUSTOMER_REPLIES = [
    "Thank you for getting back to me. Yes, the issue is still happening.",
    "I tried what you suggested but it did not work. Still getting the same error.",
    "The problem resolved itself after a restart, but it came back again the next day.",
    "Can you escalate this? I've been waiting for 3 days now.",
    "I have attached a screenshot to this message as requested.",
    "Actually I think I might have found the issue on my end. Let me check and confirm.",
    "Please update me on the status of this ticket. It's been a week.",
    "This is really urgent for us — we have a client presentation tomorrow.",
]

# Internal note bodies — agents only
INTERNAL_NOTES = [
    "Checked backend logs. Error is intermittent, might be a race condition.",
    "Escalating to Tier 2. This looks like a database configuration issue.",
    "Customer is on Enterprise plan — priority response required per SLA agreement.",
    "Similar issue reported by 3 other customers this week. Possible systemic bug.",
    "Waiting for customer to provide more details. Will follow up in 24 hours if no response.",
    "Billing team has been notified. Refund processing has started.",
    "Issue confirmed on staging environment. Dev team is working on a fix.",
    "Closing this as the customer confirmed the issue is resolved.",
]


# ─────────────────────────────────────────────
# Main seed function
# ─────────────────────────────────────────────

def seed_all():
    db = SessionLocal()

    try:
        print("🌱 Starting seed...")

        # ── Step 1: Create users (skip if already exist) ───────────────────

        user_objects = {}

        for u in USERS:
            existing = db.query(User).filter(User.email == u["email"]).first()
            if existing:
                print(f"   ↩ User {u['email']} already exists — skipping")
                user_objects[u["email"]] = existing
            else:
                new_user = User(
                    email=u["email"],
                    password_hash=ph.hash(u["password"]),
                    name=u["name"],
                    role=u["role"],
                    is_active=True,
                )
                db.add(new_user)
                db.flush()  # flush so we get the .id before committing
                user_objects[u["email"]] = new_user
                print(f"   ✅ Created user: {u['name']} ({u['role'].value})")

        db.commit()

        supervisor = user_objects["supervisor@test.com"]
        agents = [
            user_objects["agent1@test.com"],
            user_objects["agent2@test.com"],
            user_objects["agent3@test.com"],
            user_objects["agent4@test.com"],
        ]

        # ── Step 2: Build weighted status + priority lists ─────────────────

        statuses   = []
        for status, count in STATUS_WEIGHTS:
            statuses.extend([status] * count)

        priorities = []
        for priority, count in PRIORITY_WEIGHTS:
            priorities.extend([priority] * count)

        random.shuffle(statuses)
        random.shuffle(priorities)

        # ── Step 3: Create 50 tickets ──────────────────────────────────────

        print("\n📋 Creating 50 tickets...")

        for i, template in enumerate(TICKET_TEMPLATES):
            status   = statuses[i]
            priority = priorities[i]

            # Assignee: distribute across agents, some unassigned (10%)
            assignee = random.choice(agents) if random.random() > 0.1 else None

            # SLA timing — vary by when the ticket was "created"
            sla_hours = SLA_HOURS_MAP[priority]

            # Spread tickets over the last 30 days for realistic chart data
            days_ago = random.randint(0, 30)
            hours_ago = random.randint(0, 23)
            created_at = datetime.utcnow() - timedelta(days=days_ago, hours=hours_ago)

            # SLA deadline = created_at + SLA hours
            response_due_at = created_at + timedelta(hours=sla_hours)

            # For resolved/closed tickets, set updated_at in the past too
            if status in [TicketStatus.resolved, TicketStatus.closed]:
                # Resolved between creation and now
                resolved_offset = random.uniform(0.1, 0.9)
                elapsed = (datetime.utcnow() - created_at).total_seconds()
                updated_at = created_at + timedelta(seconds=elapsed * resolved_offset)
                closed_at = updated_at if status == TicketStatus.closed else None
            else:
                updated_at = created_at + timedelta(hours=random.randint(0, 5))
                closed_at = None

            # Pending tickets: pause the SLA clock
            pending_since = None
            total_paused_seconds = 0.0
            if status == TicketStatus.pending:
                # Ticket went pending some hours ago
                pending_hours = random.randint(1, 12)
                pending_since = datetime.utcnow() - timedelta(hours=pending_hours)

            # Some archived tickets (~10%)
            archived = (i < 5)

            ticket = Ticket(
                subject=template["subject"],
                description=template["description"],
                requester_name=template["requester_name"],
                priority=priority,
                category=template["category"],
                status=status,
                assignee_id=assignee.id if assignee else None,
                created_by=supervisor.id,  # supervisor created all tickets for simplicity
                created_at=created_at,
                updated_at=updated_at,
                closed_at=closed_at,
                response_due_at=response_due_at,
                pending_since=pending_since,
                total_paused_seconds=total_paused_seconds,
                archived=archived,
            )
            db.add(ticket)
            db.flush()

            # ── ticket_created event (immutable timeline) ──────────────────
            db.add(TicketEvent(
                ticket_id=ticket.id,
                event_type=EventType.ticket_created,
                old_value=None,
                new_value=ticket.subject[:100],  # first 100 chars of subject
                actor_id=supervisor.id,
                created_at=created_at,
            ))

            # ── Status change event (if not 'new') ─────────────────────────
            if status != TicketStatus.new:
                db.add(TicketEvent(
                    ticket_id=ticket.id,
                    event_type=EventType.status_changed,
                    old_value="new",
                    new_value=status.value,
                    actor_id=supervisor.id if random.random() > 0.5 else (assignee.id if assignee else supervisor.id),
                    created_at=created_at + timedelta(minutes=random.randint(5, 120)),
                ))

            # ── Replies: 1-4 per ticket ────────────────────────────────────
            num_replies = random.randint(1, 4)
            for r in range(num_replies):
                is_internal = (r % 3 == 2)  # every 3rd reply is an internal note
                author = assignee if (assignee and (is_internal or random.random() > 0.4)) else supervisor
                reply_time = created_at + timedelta(minutes=random.randint(10, 200) * (r + 1))

                # Don't create future replies
                if reply_time > datetime.utcnow():
                    break

                body = random.choice(INTERNAL_NOTES if is_internal else CUSTOMER_REPLIES)

                db.add(Reply(
                    ticket_id=ticket.id,
                    author_id=author.id,
                    body=body,
                    is_internal=is_internal,
                    created_at=reply_time,
                ))

                db.add(TicketEvent(
                    ticket_id=ticket.id,
                    event_type=EventType.reply_added,
                    old_value=None,
                    new_value="Internal note" if is_internal else "Customer reply",
                    actor_id=author.id,
                    created_at=reply_time,
                ))

            # ── Collaborator: add a second agent to ~30% of tickets ────────
            if assignee and random.random() < 0.3:
                # Pick a different agent than the assignee
                other_agents = [a for a in agents if a.id != assignee.id]
                if other_agents:
                    collab_agent = random.choice(other_agents)
                    db.add(Collaborator(
                        ticket_id=ticket.id,
                        agent_id=collab_agent.id,
                        added_at=created_at + timedelta(minutes=random.randint(10, 60)),
                    ))
                    db.add(TicketEvent(
                        ticket_id=ticket.id,
                        event_type=EventType.collaborator_added,
                        old_value=None,
                        new_value=collab_agent.name,
                        actor_id=supervisor.id,
                        created_at=created_at + timedelta(minutes=random.randint(10, 60)),
                    ))

            status_symbol = "📦" if archived else {
                TicketStatus.new: "🆕",
                TicketStatus.open: "📂",
                TicketStatus.pending: "⏳",
                TicketStatus.resolved: "✅",
                TicketStatus.closed: "🔒",
            }[status]

            print(f"   {status_symbol} Ticket #{ticket.id}: {ticket.subject[:50]}... [{priority.value}]")

        db.commit()

        # ── Step 4: SLA alerts for breaching/near-breach open tickets ─────

        print("\n🔴 Creating SLA alerts for breaching tickets...")

        # Find open non-pending tickets that are breaching
        open_tickets = db.query(Ticket).filter(
            Ticket.archived == False,
            Ticket.status == TicketStatus.open,
            Ticket.response_due_at.isnot(None),
        ).all()

        alert_count = 0
        for ticket in open_tickets:
            effective_deadline = ticket.response_due_at + timedelta(
                seconds=ticket.total_paused_seconds
            )
            remaining = (effective_deadline - datetime.utcnow()).total_seconds()

            # Create alert for breached AND near-breach (within 2 hours for demo variety)
            if remaining < 7200:  # 2 hours — gives us both red and yellow cards
                existing = db.query(SlaAlert).filter(
                    SlaAlert.ticket_id == ticket.id
                ).first()
                if not existing:
                    db.add(SlaAlert(
                        ticket_id=ticket.id,
                        acknowledged=False,
                        created_at=datetime.utcnow(),
                    ))
                    alert_count += 1

        db.commit()
        print(f"   ✅ Created {alert_count} SLA alerts")

        # ── Done ──────────────────────────────────────────────────────────

        # Final count
        ticket_count = db.query(Ticket).count()
        user_count   = db.query(User).count()
        reply_count  = db.query(Reply).count()

        print(f"""
╔══════════════════════════════════════════╗
║           SEED COMPLETE ✅               ║
╠══════════════════════════════════════════╣
║  Users:    {user_count:<31} ║
║  Tickets:  {ticket_count:<31} ║
║  Replies:  {reply_count:<31} ║
║  Alerts:   {alert_count:<31} ║
╠══════════════════════════════════════════╣
║  Test credentials:                       ║
║  supervisor@test.com / SupervisorPass123 ║
║  agent1@test.com    / password123        ║
║  agent2@test.com    / password123        ║
║  agent3@test.com    / password123        ║
║  agent4@test.com    / password123        ║
╚══════════════════════════════════════════╝
        """)

    except Exception as e:
        db.rollback()
        print(f"\n❌ Seed failed: {e}")
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed_all()