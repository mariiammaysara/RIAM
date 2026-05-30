"""
Analytics and Reporting API Router.
Provides metrics, KPIs, and audit trails for conversations, securely scoped by tenant.
"""
from datetime import datetime
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_tenant_id
from app.models.base import Conversation, Message, Agent, KnowledgeBase

router = APIRouter(prefix="/analytics", tags=["Inbox Analytics"])


# --- Schemas ---

class AnalyticsOverviewResponse(BaseModel):
    total_conversations: int
    resolved_count: int
    escalated_count: int
    active_count: int
    total_messages: int
    avg_messages_per_conversation: float
    total_knowledge_bases: int
    total_agents: int


class ConversationAnalyticsItem(BaseModel):
    id: uuid.UUID
    agent_name: str
    status: str
    message_count: int
    created_at: datetime


class PaginatedConversationsAnalytics(BaseModel):
    items: List[ConversationAnalyticsItem]
    total: int
    page: int
    page_size: int


# --- Endpoints ---

@router.get("/overview", response_model=AnalyticsOverviewResponse)
async def get_analytics_overview(
    business_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves high-level performance metrics and support KPIs for the tenant.
    Uses a single highly optimized SQL query (avoiding N+1 problems)
    with strict business isolation.
    """
    # Build scalar subqueries to execute counts in a single combined SELECT statement
    total_convs_sub = select(func.count(Conversation.id)).where(Conversation.business_id == business_id).scalar_subquery()
    resolved_sub = select(func.count(Conversation.id)).where(Conversation.business_id == business_id, Conversation.status == "closed").scalar_subquery()
    escalated_sub = select(func.count(Conversation.id)).where(Conversation.business_id == business_id, Conversation.status == "handoff").scalar_subquery()
    active_sub = select(func.count(Conversation.id)).where(Conversation.business_id == business_id, Conversation.status == "active").scalar_subquery()
    
    total_msgs_sub = select(func.count(Message.id)).join(Conversation).where(Conversation.business_id == business_id).scalar_subquery()
    
    total_kbs_sub = select(func.count(KnowledgeBase.id)).where(KnowledgeBase.business_id == business_id).scalar_subquery()
    total_agents_sub = select(func.count(Agent.id)).where(Agent.business_id == business_id).scalar_subquery()
    
    # Combined single query execution
    query = select(
        total_convs_sub,
        resolved_sub,
        escalated_sub,
        active_sub,
        total_msgs_sub,
        total_kbs_sub,
        total_agents_sub
    )
    
    result = await db.execute(query)
    row = result.fetchone()
    
    if not row:
        return AnalyticsOverviewResponse(
            total_conversations=0,
            resolved_count=0,
            escalated_count=0,
            active_count=0,
            total_messages=0,
            avg_messages_per_conversation=0.0,
            total_knowledge_bases=0,
            total_agents=0
        )
        
    total_conversations = row[0] or 0
    resolved_count = row[1] or 0
    escalated_count = row[2] or 0
    active_count = row[3] or 0
    total_messages = row[4] or 0
    total_knowledge_bases = row[5] or 0
    total_agents = row[6] or 0
    
    avg_messages = (
        float(total_messages) / float(total_conversations)
        if total_conversations > 0
        else 0.0
    )
    
    return AnalyticsOverviewResponse(
        total_conversations=total_conversations,
        resolved_count=resolved_count,
        escalated_count=escalated_count,
        active_count=active_count,
        total_messages=total_messages,
        avg_messages_per_conversation=round(avg_messages, 2),
        total_knowledge_bases=total_knowledge_bases,
        total_agents=total_agents
    )


@router.get("/conversations", response_model=PaginatedConversationsAnalytics)
async def get_conversations_analytics(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    business_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves a paginated list of conversations with their respective message counts
    and status. Joins with the agents table to include agent names.
    Strictly filtered by the tenant business ID.
    """
    offset = (page - 1) * page_size

    # Create an optimized subquery counting messages per conversation
    message_count_subquery = (
        select(Message.conversation_id, func.count(Message.id).label("cnt"))
        .group_by(Message.conversation_id)
        .subquery()
    )

    # 1. Query total count for pagination
    total_query = select(func.count(Conversation.id)).where(Conversation.business_id == business_id)
    total_res = await db.execute(total_query)
    total = total_res.scalar() or 0

    # 2. Query items joining Conversation, Agent, and the message count subquery
    query = (
        select(
            Conversation.id,
            Agent.name.label("agent_name"),
            Conversation.status,
            func.coalesce(message_count_subquery.c.cnt, 0).label("message_count"),
            Conversation.created_at
        )
        .join(Agent, Conversation.agent_id == Agent.id)
        .outerjoin(message_count_subquery, Conversation.id == message_count_subquery.c.conversation_id)
        .where(Conversation.business_id == business_id)
        .order_by(Conversation.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )

    result = await db.execute(query)
    rows = result.all()

    items = [
        ConversationAnalyticsItem(
            id=row[0],
            agent_name=row[1],
            status=row[2],
            message_count=row[3],
            created_at=row[4]
        )
        for row in rows
    ]

    return PaginatedConversationsAnalytics(
        items=items,
        total=total,
        page=page,
        page_size=page_size
    )
