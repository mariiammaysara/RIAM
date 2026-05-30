"""
Pytest configuration and shared fixtures.
Creates async db connection fixtures, supporting automated fallback to in-memory SQLite.
"""
import os
import pytest
import sqlalchemy as sa
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.config import settings
from app.core.database import Base

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

TEST_DB_URL = os.getenv(
    "TEST_DATABASE_URL",
    "sqlite+aiosqlite:///:memory:"  # safe fallback
)

# Safe guard: Never use production database for tests
def is_prod_db(url: str) -> bool:
    def clean(u: str) -> str:
        u = u.replace("postgresql+asyncpg://", "postgresql://")
        u = u.replace("postgres://", "postgresql://")
        if "?" in u:
            u = u.split("?")[0]
        return u.strip("/")
    return clean(url) == clean(settings.DATABASE_URL)

if is_prod_db(TEST_DB_URL):
    TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

# Detect Neon (cloud) vs local — Neon requires ssl
_connect_args = {"ssl": "require"} if "neon.tech" in TEST_DB_URL else {}


@pytest.fixture
async def test_engine():
    """
    Creates a database engine for each individual test.
    Attempts connection to the separate test database URL first.
    Falls back to a memory-based SQLite (aiosqlite) if the connection is refused or not configured.

    Function-scoped to avoid asyncpg event loop mismatch with pytest-asyncio.
    """
    try:
        engine = create_async_engine(
            TEST_DB_URL,
            echo=False,
            connect_args=_connect_args,
        )
        # Verify the database is online and reachable
        async with engine.begin() as conn:
            await conn.execute(sa.text("SELECT 1"))
            await conn.run_sync(Base.metadata.create_all)
        print(f"Connected to separate test database: {TEST_DB_URL}")
    except Exception as e:
        print(f"Test database connection failed: {e}. Falling back to SQLite memory database for test runs.")
        # SQLite async engine fallback
        engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Tear down: drop tables on test/sqlite database, but NEVER on production database
    try:
        if not is_prod_db(TEST_DB_URL):
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.drop_all)
        else:
            print("Teardown skipped: Never drop tables on production database!")
    except Exception as e:
        print(f"Error dropping test tables: {e}")

    await engine.dispose()


@pytest.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """
    Yields an active database session for a single test.
    Rolls back any modifications after completion to keep tests isolated.
    """
    session_maker = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False
    )

    async with session_maker() as session:
        yield session
        # Transaction is rolled back to keep the database state clean
        await session.rollback()
        await session.close()


@pytest.fixture(scope="session", autouse=True)
def mock_hf_embeddings_globally():
    """
    Session-wide fixture that automatically mocks langchain_huggingface.HuggingFaceEmbeddings
    to prevent downloading model weights during test execution.
    """
    from unittest.mock import patch, MagicMock
    mock_instance = MagicMock()
    with patch("langchain_huggingface.HuggingFaceEmbeddings", return_value=mock_instance) as mock_class:
        yield mock_class
