"""
Pydantic v2 Schemas for Riam.
Defines input validation and output serialization schemas for all models.
"""
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
import uuid
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# --- Agent Schemas ---

class AgentBase(BaseModel):
    name: str = Field(..., max_length=255, description="Name of the customer support agent")
    system_prompt: str = Field(..., description="System prompt explaining instructions and personality")
    temperature: float = Field(0.2, ge=0.0, le=1.0, description="Creativity setting of the agent")
    provider: str = Field("gemini", description="LLM provider (gemini, openai, anthropic)")
    config: Dict[str, Any] = Field(default_factory=dict, description="Branding and placement details")
    is_active: bool = Field(True, description="Toggles if chatbot responds to users")


class AgentCreate(AgentBase):
    pass


class AgentUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    system_prompt: Optional[str] = None
    temperature: Optional[float] = Field(None, ge=0.0, le=1.0)
    provider: Optional[str] = Field(None, description="LLM provider")
    config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class AgentResponse(AgentBase):
    id: uuid.UUID
    business_id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Knowledge Base Schemas ---

class KnowledgeBaseBase(BaseModel):
    name: str = Field(..., max_length=255, description="Name of the knowledge base document")
    source_type: Literal["file", "url", "pdf"] = Field(..., description="Source medium")
    source_url: Optional[str] = Field(None, max_length=2048, description="Scraping target URL")


class KnowledgeBaseCreate(KnowledgeBaseBase):
    pass


class KnowledgeBaseResponse(KnowledgeBaseBase):
    id: uuid.UUID
    business_id: uuid.UUID
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Message Schemas ---

class MessageResponse(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Conversation Schemas ---

class ConversationBase(BaseModel):
    agent_id: uuid.UUID = Field(..., description="Target support agent ID")
    customer_name: Optional[str] = Field(None, max_length=255)
    customer_email: Optional[EmailStr] = Field(None)


class ConversationCreate(ConversationBase):
    pass


class ConversationUpdate(BaseModel):
    status: Literal["active", "handoff", "closed"]


class ConversationResponse(ConversationBase):
    id: uuid.UUID
    business_id: uuid.UUID
    status: str
    created_at: datetime
    messages: Optional[List[MessageResponse]] = None

    model_config = ConfigDict(from_attributes=True)


# --- Special Request/Response Payload Schemas ---

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Message string sent by user")
