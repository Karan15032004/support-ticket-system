"""
routers/auth.py — Authentication Endpoints

Endpoints defined here:
  POST /auth/login  → validate credentials, return JWT token
  GET  /auth/me     → return current user's profile (used by frontend
                      to restore session after page refresh)

Why split into routers?
  As the app grows, putting all routes in main.py becomes unmanageable.
  Each feature area gets its own router file. main.py just mounts them.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import LoginRequest, TokenResponse, UserResponse
from ..auth import verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    POST /auth/login
    
    Flow:
    1. Look up user by email
    2. Verify the password against the stored hash
    3. If valid, create a JWT token with their id and role
    4. Return the token + basic user info
    
    The frontend stores this token in localStorage and sends it
    as "Authorization: Bearer <token>" on every subsequent request.
    
    Security note: We return the same error for both "email not found"
    and "wrong password" — this prevents attackers from enumerating
    valid emails by observing different error messages.
    """
    # Find user by email
    user = db.query(User).filter(User.email == request.email).first()

    # Verify password — same error message for both failure modes (security)
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Contact your supervisor."
        )

    # Create JWT token
    token = create_access_token(user_id=user.id, role=user.role.value)

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        role=user.role,
        user_id=user.id,
        name=user.name
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    GET /auth/me
    
    Returns the current user's profile.
    
    Frontend uses this on page refresh to restore auth state.
    Flow:
    1. User refreshes browser
    2. Frontend reads token from localStorage
    3. Calls GET /auth/me with that token
    4. Gets back role + name → redirects to correct page
    
    If token is expired/invalid, get_current_user raises 401,
    and the frontend redirects to login.
    """
    return current_user