"""
Conversation and message repository module.
Manages customer chat sessions, message histories, and human handoff states.
"""
from typing import List, Optional
import uuid
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.base import Conversation, Message
from app.repositories.base import BaseRepository


class ConversationRepository(BaseRepository[Conversation]):
    """
    Conversation repository class.
    Controls customer support chat sessions and message records securely.
    """

    async def get_with_messages(self, id: uuid.UUID) -> Optional[Conversation]:
        """
        Retrieves a conversation by its ID, preloading all messages,
        ensuring it belongs to this tenant business.
        """
        query = (
            select(Conversation)
            .where(
                Conversation.id == id,
                Conversation.business_id == self.business_id
            )
            .options(selectinload(Conversation.messages))
        )
        result = await self.db.execute(query)
        return result.scalars().first()

    async def get_active_conversations(self) -> List[Conversation]:
        """
        Retrieves all active or handoff conversations for the tenant dashboard inbox.
        Ordered by creation timestamp descending.
        """
        query = (
            select(Conversation)
            .where(
                Conversation.business_id == self.business_id,
                Conversation.status.in_(["active", "handoff"])
            )
            .order_by(Conversation.created_at.desc())
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create_message(
        self, *, conversation_id: uuid.UUID, sender: str, content: str
    ) -> Message:
        """
        Appends a message to a conversation.
        Verifies tenant ownership of the conversation before creation.
        """
        conversation = await self.get(conversation_id)
        if not conversation:
            raise PermissionError("Access denied: Conversation not found or belongs to another tenant")

        message = Message(
            conversation_id=conversation_id,
            sender=sender,
            content=content
        )
        self.db.add(message)
        await self.db.flush()
        return message

    async def get_messages(
        self, conversation_id: uuid.UUID, limit: int = 100
    ) -> List[Message]:
        """
        Fetches the chronological message history for a conversation.
        Verifies conversation ownership before returning data.
        """
        conversation = await self.get(conversation_id)
        if not conversation:
            raise PermissionError("Access denied: Conversation not found or belongs to another tenant")

        query = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())
