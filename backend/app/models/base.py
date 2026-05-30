"""
SQLAlchemy database models for Riam.
Defines all multi-tenant tables and includes pgvector support for RAG embeddings.
Provides transparent SQLite schema compatibility for automated local unit tests.
"""
import uuid
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    Uuid,
    JSON,
    TypeDecorator,
)
from sqlalchemy.types import TypeEngine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

# 1. Define dialect-safe JSON Type (JSONB on Postgres, standard JSON on SQLite/others)
JSON_TYPE = JSON().with_variant(JSONB, "postgresql")


# 2. Define dialect-safe Vector Type for automated local tests fallback
class SafeVector(TypeDecorator):
    """
    Transparent Vector TypeDecorator.
    Compiles to PostgreSQL's native Vector on postgres, and falls back to text storage on SQLite.
    Exposes pgvector operators (cosine_distance, l2_distance, etc.) on PostgreSQL by
    delegating comparisons to the underlying Vector type.
    """
    impl = Text
    cache_ok = True

    def __init__(self, dim: int):
        super().__init__()
        self.dim = dim
        self._vector_type = Vector(dim)

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(self._vector_type)
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value
        # SQLite fallback: serialize vector float list to json string
        return json.dumps(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value
        # SQLite fallback: deserialize json string to float list
        return json.loads(value)

    class VectorComparator(TypeEngine.Comparator):
        def cosine_distance(self, other):
            # Access the actual column element directly
            col = self.__clause_element__()
            from sqlalchemy import func
            if isinstance(other, (list, tuple)):
                other = "[" + ",".join(map(str, other)) + "]"
            return func.cosine_distance(col, other)

        def l2_distance(self, other):
            # Access the actual column element directly
            col = self.__clause_element__()
            from sqlalchemy import func
            if isinstance(other, (list, tuple)):
                other = "[" + ",".join(map(str, other)) + "]"
            return func.l2_distance(col, other)

        def max_inner_product(self, other):
            # Access the actual column element directly
            col = self.__clause_element__()
            from sqlalchemy import func
            if isinstance(other, (list, tuple)):
                other = "[" + ",".join(map(str, other)) + "]"
            return func.max_inner_product(col, other)

    comparator_factory = VectorComparator


class Business(Base):
    """
    Business (Tenant) model.
    Represents an organization that builds and hosts customer support agents.
    """
    __tablename__ = "businesses"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    clerk_org_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    users: Mapped[List["User"]] = relationship("User", back_populates="business", cascade="all, delete-orphan")
    agents: Mapped[List["Agent"]] = relationship("Agent", back_populates="business", cascade="all, delete-orphan")
    knowledge_bases: Mapped[List["KnowledgeBase"]] = relationship("KnowledgeBase", back_populates="business", cascade="all, delete-orphan")
    conversations: Mapped[List["Conversation"]] = relationship("Conversation", back_populates="business", cascade="all, delete-orphan")


class User(Base):
    """
    User model.
    Represents members/administrators belonging to a Business.
    """
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    clerk_user_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="member", nullable=False)  # admin, member
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    business: Mapped["Business"] = relationship("Business", back_populates="users")


class Agent(Base):
    """
    Agent model.
    Configures the system prompts, settings, and widget appearance for the AI chatbot.
    """
    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    temperature: Mapped[float] = mapped_column(Float, default=0.2, nullable=False)
    provider: Mapped[str] = mapped_column(String(50), default="gemini", nullable=False)
    
    # JSON config containing branding (e.g. primaryColor, logoUrl, welcomeMessage)
    config: Mapped[Dict[str, Any]] = mapped_column(JSON_TYPE, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    business: Mapped["Business"] = relationship("Business", back_populates="agents")
    conversations: Mapped[List["Conversation"]] = relationship("Conversation", back_populates="agent", cascade="all, delete-orphan")


class KnowledgeBase(Base):
    """
    KnowledgeBase model.
    Stores metadata about files or URLs ingested to feed the pgvector store for RAG.
    """
    __tablename__ = "knowledge_bases"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "file" or "url"
    source_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="indexing", nullable=False)  # indexing, ready, failed
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    business: Mapped["Business"] = relationship("Business", back_populates="knowledge_bases")
    chunks: Mapped[List["DocumentChunk"]] = relationship("DocumentChunk", back_populates="knowledge_base", cascade="all, delete-orphan")


class DocumentChunk(Base):
    """
    DocumentChunk model.
    Holds partitioned text data and high-dimensional vector embeddings for RAG retrieval.
    """
    __tablename__ = "document_chunks"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    knowledge_base_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Dialect-safe Vector: Vector(768) on Postgres, Text on SQLite (matches text-embedding-004)
    embedding: Mapped[Any] = mapped_column(SafeVector(768), nullable=False)
    
    meta_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON_TYPE, nullable=True)

    # Relationships
    knowledge_base: Mapped["KnowledgeBase"] = relationship("KnowledgeBase", back_populates="chunks")


class Conversation(Base):
    """
    Conversation model.
    Represents a multi-turn chat session between an external customer and the support system.
    """
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    customer_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)  # active, handoff, closed
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    business: Mapped["Business"] = relationship("Business", back_populates="conversations")
    agent: Mapped["Agent"] = relationship("Agent", back_populates="conversations")
    messages: Mapped[List["Message"]] = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", lazy="selectin")


class Message(Base):
    """
    Message model.
    A single bubble message sent within a conversation.
    """
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender: Mapped[str] = mapped_column(String(50), nullable=False)  # customer, agent, human
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")
