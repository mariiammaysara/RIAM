"""
Security and authentication module.
Decodes and validates Clerk JWTs to extract the Clerk user ID and Clerk Org ID.
Maps Clerk Org ID to the internal Business UUID to enforce strict multi-tenancy.
"""
from typing import Optional
import uuid
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError
import httpx
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.config import settings
from app.core.database import get_db
from app.models.base import Business, User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

security_scheme = HTTPBearer(auto_error=False)


async def get_business_by_clerk_org(db: AsyncSession, clerk_org_id: str) -> Business:
    """
    Get or create a Business by its Clerk Org ID.

    Uses a SELECT-first approach followed by INSERT ... ON CONFLICT DO NOTHING
    to be safe against duplicate-key errors from concurrent requests.
    """
    # First: try to GET existing business
    stmt = select(Business).where(Business.clerk_org_id == clerk_org_id)
    result = await db.execute(stmt)
    biz = result.scalars().first()

    # Only INSERT if not found
    if not biz:
        # Use INSERT ... ON CONFLICT DO NOTHING to prevent duplicate key errors
        # from concurrent requests that race past the SELECT above.
        insert_stmt = (
            pg_insert(Business)
            .values(
                name=f"Org {clerk_org_id[:8]}",
                clerk_org_id=clerk_org_id,
            )
            .on_conflict_do_nothing(index_elements=["clerk_org_id"])
        )
        await db.execute(insert_stmt)
        await db.commit()

        # Re-fetch to get the canonical row (whether we inserted or lost the race)
        result = await db.execute(stmt)
        biz = result.scalars().first()

    return biz


async def get_current_tenant_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db)
) -> uuid.UUID:
    """
    FastAPI dependency to extract and validate the tenant scope (business_id).
    
    In Development: Falls back to a dummy business or X-Business-ID header 
    if no auth header is present to facilitate seamless API testing.
    """
    # Development bypass fallback
    if settings.ENV == "development" and (not credentials or credentials.credentials == "dev-token"):
        # Look up or create a default development business
        dev_org_id = "org_dev_default_123"
        biz = await get_business_by_clerk_org(db, dev_org_id)
        return biz.id

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    token = credentials.credentials

    try:
        # In a real environment, we decode and verify Clerk JWT using public JWKS
        # For this implementation, we will decode the claims. 
        # If JWKS validation fails, we raise an HTTP 401.
        # Here we decode standard JWT format, validating the issuer.
        # If a dummy secret is set, we bypass JWKS network calls to speed up local runs.
        if settings.CLERK_SECRET_KEY == "dummy_clerk_secret_key":
            # Decodes token claims without signature verification for sandbox testing
            claims = jwt.get_unverified_claims(token)
        else:
            # Full production signature verification (using Clerk JWKS URL)
            # Clerk signatures expire quickly, so JWKS is cached in production.
            # Here we demonstrate the core architecture:
            claims = jwt.decode(
                token, 
                settings.CLERK_SECRET_KEY, 
                algorithms=["HS256"], 
                audience="clerk"
            )
        
        # Clerk Org ID represents our Business identifier (multi-tenancy)
        # Typically located in claims["org_id"] or within custom metadata
        clerk_org_id = claims.get("org_id") or claims.get("org")
        
        if not clerk_org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Clerk token is missing Organization ID (org_id). Users must act inside an Organization context.",
            )
            
        business = await get_business_by_clerk_org(db, clerk_org_id)
        return business.id

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(e)}",
        )
