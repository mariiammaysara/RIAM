"""
Database connection and session management module.
Uses asynchronous SQLAlchemy to handle database connections.
"""
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# Detect if we're connecting to a cloud provider (e.g. Neon) that requires SSL
_db_url = settings.DATABASE_URL
_connect_args = {"ssl": "require"} if "neon.tech" in _db_url else {}

# Create asynchronous engine for PostgreSQL
# We configure pool_pre_ping to check connection health before using it
engine = create_async_engine(
    _db_url,
    echo=False,  # Set to True for debugging SQL queries
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    connect_args=_connect_args,
)

# Async session factory
async_session_maker = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)


class Base(DeclarativeBase):
    """
    SQLAlchemy Declarative Base class.
    All models must inherit from this class.
    """
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency to get an asynchronous database session.
    Ensures the session is cleanly closed after the request lifecycle.
    """
    import logging
    logger = logging.getLogger(__name__)
    logger.info("[SESSION] Opening new async database session...")
    async with async_session_maker() as session:
        try:
            yield session
            logger.info("[SESSION] Database session yield completed successfully.")
        except Exception as e:
            logger.error(f"[SESSION] Exception encountered in request session: {str(e)}")
            raise
        finally:
            logger.info("[SESSION] Closing database session.")
            await session.close()

