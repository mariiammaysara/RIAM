"""
Conversations and Chat API Router.
Exposes public endpoints for unauthenticated chat widgets (using SSE streaming)
alongside authenticated inbox and handoff management controllers.
"""
from typing import List
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_tenant_id
from app.models.base import Agent, Conversation
from app.repositories.conversation_repo import ConversationRepository
from app.schemas.base import (
    ChatRequest,
    ConversationCreate,
    ConversationResponse,
    ConversationUpdate,
    MessageResponse,
)
from app.services.chat_service import ChatService

router = APIRouter(prefix="/conversations", tags=["Conversations & Live Support"])


# --- Public / Widget Endpoints ---
# These do NOT require Clerk authentication because they are accessed
# by the unauthenticated end-customers on external website widgets.

@router.post("/", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def start_conversation(
    conv_in: ConversationCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Public Endpoint: Initiates a new support chat session.
    Retrieves the business_id from the target agent to bind the tenant.
    """
    # Look up the agent to extract the owning tenant's business_id
    stmt = select(Agent).where(Agent.id == conv_in.agent_id)
    result = await db.execute(stmt)
    agent = result.scalars().first()
    if not agent or not agent.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Support agent is either inactive or not found"
        )

    # Initialize repository with the agent's business_id
    repo = ConversationRepository(db, agent.business_id)
    conv_data = conv_in.model_dump()
    conv = await repo.create(conv_data)

    # Eagerly reload with messages
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == conv.id)
    )
    return result.scalars().first()


@router.post("/{conversation_id}/chat/stream")
async def chat_interaction_stream(
    conversation_id: uuid.UUID,
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Public Endpoint: Streams AI support response token-by-token using Server-Sent Events (SSE).
    Uses the existing conversation context to extract the tenant scope safely.
    """
    # Fetch conversation to identify business_id (no auth token from customer widget)
    stmt = select(Conversation).where(Conversation.id == conversation_id)
    result = await db.execute(stmt)
    conv = result.scalars().first()
    
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active chat session not found"
        )
    
    if conv.status == "closed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This conversation session has already been closed"
        )

    # Instantiate chat service scoped to this conversation's tenant business
    chat_service = ChatService(db, conv.business_id)
    
    # Return EventStream StreamingResponse
    return StreamingResponse(
        chat_service.stream_chat_response(
            conversation_id=conversation_id,
            user_message=payload.message
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable buffering for NGINX proxies to allow smooth stream
        }
    )


# --- Authenticated / Dashboard Inbox Endpoints ---
# These require valid Clerk authentication and are strictly tenant-isolated.

@router.get("/", response_model=List[ConversationResponse])
async def list_active_conversations(
    business_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Dashboard Endpoint: Retrieves all active and handoff support tickets for the inbox.
    """
    repo = ConversationRepository(db, business_id)
    return await repo.get_active_conversations()


@router.get("/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_conversation_history(
    conversation_id: uuid.UUID,
    business_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Dashboard Endpoint: Retrieves all historical messages for a conversation log.
    """
    repo = ConversationRepository(db, business_id)
    try:
        return await repo.get_messages(conversation_id)
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation_status(
    conversation_id: uuid.UUID,
    conv_update: ConversationUpdate,
    business_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Dashboard Endpoint: Transitions conversation status (e.g. human intervention handoff or closed).
    """
    repo = ConversationRepository(db, business_id)
    conv = await repo.get(conversation_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation ticket not found"
        )
    await repo.update(db_obj=conv, obj_in=conv_update)

    # Eagerly reload with messages
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == conversation_id)
    )
    return result.scalars().first()


from pydantic import BaseModel
from typing import Literal

class MessageCreate(BaseModel):
    sender: Literal["customer", "agent", "human"]
    content: str


@router.post("/{conversation_id}/messages", response_model=MessageResponse)
async def create_conversation_message(
    conversation_id: uuid.UUID,
    msg_in: MessageCreate,
    business_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Dashboard Endpoint: Appends a manual message (e.g. from live agent operator) to the conversation.
    """
    repo = ConversationRepository(db, business_id)
    try:
        msg = await repo.create_message(
            conversation_id=conversation_id,
            sender=msg_in.sender,
            content=msg_in.content
        )
        await db.commit()
        return msg
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("/{conversation_id}/messages/public", response_model=List[MessageResponse])
async def get_public_conversation_history(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Public Endpoint: Retrieves chronological message history for a conversation.
    Accessed by unauthenticated chat widgets.
    """
    stmt = select(Conversation).where(Conversation.id == conversation_id)
    result = await db.execute(stmt)
    conv = result.scalars().first()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation session not found"
        )
    
    repo = ConversationRepository(db, conv.business_id)
    return await repo.get_messages(conversation_id)


@router.post("/{conversation_id}/messages/public", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_public_conversation_message(
    conversation_id: uuid.UUID,
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Public Endpoint: Appends a customer message to the conversation.
    Accessed by unauthenticated chat widgets (e.g. during human handoff mode).
    """
    stmt = select(Conversation).where(Conversation.id == conversation_id)
    result = await db.execute(stmt)
    conv = result.scalars().first()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation session not found"
        )
    
    repo = ConversationRepository(db, conv.business_id)
    msg = await repo.create_message(
        conversation_id=conversation_id,
        sender="customer",
        content=payload.message
    )
    await db.commit()
    return msg
