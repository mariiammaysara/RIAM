"""
Application configurations module.
Loads environment variables from settings or a local .env file.
"""
import os
from dotenv import load_dotenv

# Ensure environment variables are loaded into the OS environment
# so that libraries like LangChain and LangSmith can access them directly.
load_dotenv()

from typing import List, Optional
from pydantic import ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Pydantic settings loader class.
    Defines all environment variables required for running Riam.
    """
    PROJECT_NAME: str = "Riam Support Builder API"
    API_V1_STR: str = "/api/v1"
    ENV: str = "development"
    
    # Database connection url
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/riam"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: Optional[str], info: ValidationInfo) -> str:
        """
        Ensures the database connection URL is formatted correctly using the asyncpg driver.
        """
        if not v:
            raise ValueError("DATABASE_URL is required")
        if v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+asyncpg://", 1)
        # Remove ssl/sslmode URL params — handled via connect_args in database.py
        if "?ssl=" in v:
            v = v.split("?ssl=")[0]
        elif "?sslmode=" in v:
            v = v.split("?sslmode=")[0]
        return v

    # Authentication & Secrets
    CLERK_SECRET_KEY: str = "dummy_clerk_secret_key"
    CLERK_PUBLISHABLE_KEY: str = "dummy_clerk_pub_key"
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: str = "dummy_clerk_pub_key"
    
    # Frontend Endpoint (For CORS)
    NEXT_PUBLIC_API_URL: str = "http://localhost:8000"
    # Comma-separated origins: "http://localhost:3000,https://yourdomain.com"
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v) -> List[str]:
        """Supports both a JSON list and a comma-separated string for CORS origins."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # AI & Embeddings
    LLM_PROVIDER: str = "gemini"
    EMBEDDING_PROVIDER: str = "huggingface"
    GEMINI_API_KEY: str = "dummy_gemini_key"
    OPENAI_API_KEY: str = "dummy_openai_key"
    OPENAI_MODEL: str = "gpt-4o"
    ANTHROPIC_API_KEY: Optional[str] = None
    GROQ_API_KEY: str = ""
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    
    # Observability (LangSmith)
    LANGSMITH_API_KEY: Optional[str] = None
    LANGSMITH_PROJECT: str = "riam-support-agent"
    LANGCHAIN_TRACING_V2: bool = False

    # Scraping (Firecrawl)
    FIRECRAWL_API_KEY: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
