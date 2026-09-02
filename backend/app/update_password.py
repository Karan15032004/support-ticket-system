#!/usr/bin/env python3
"""
update_password.py — Standalone script to update a user's password hash in Supabase.

Run from project root:
  python backend/app/update_password.py

Or from backend folder:
  cd backend && python app/update_password.py
"""

import os
import sys
from pathlib import Path

# Add project root to path so we can import from backend
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Now load env and imports
from dotenv import load_dotenv
from argon2 import PasswordHasher
from sqlalchemy import create_engine, text

load_dotenv()

# ── CONFIG ────────────────────────────────────────────────────────────────────

EMAIL    = "supervisor@test.com"   # ← CHANGE THIS if updating agent
PASSWORD = "SupervisorPass123"    # ← CHANGE THIS to your password

# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    # Generate hash
    ph = PasswordHasher()
    hashed = ph.hash(PASSWORD)
    print(f"✓ Generated Argon2 hash: {hashed[:40]}...")

    # Get database URL from env
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("✗ DATABASE_URL not found in .env file")
        return False

    # Connect and update
    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            result = conn.execute(
                text("UPDATE users SET password_hash = :hash WHERE email = :email"),
                {"hash": hashed, "email": EMAIL}
            )
            conn.commit()
            
        print(f"✓ Updated {result.rowcount} row for {EMAIL}")

        # Verify it works
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT password_hash FROM users WHERE email = :email"),
                {"email": EMAIL}
            ).fetchone()

        if not row:
            print(f"✗ User {EMAIL} not found in database")
            return False

        try:
            ph.verify(row[0], PASSWORD)
            print(f"✓ Verification passed — {EMAIL} can now login with new password")
            return True
        except Exception as e:
            print(f"✗ Verification failed: {e}")
            print(f"  Stored hash may be corrupted")
            return False

    except Exception as e:
        print(f"✗ Database error: {e}")
        print(f"  Make sure DATABASE_URL is correct in .env")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)