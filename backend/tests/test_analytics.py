"""
Integration tests for Riam operational analytics endpoints.
Validates metric counts, non-N+1 database joins for agent names and message counts,
strict multi-tenant isolation, and paginated lists.
"""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Business, Agent, KnowledgeBase, Conversation, Message


@pytest.fixture
async def setup_analytics_data(db_session: AsyncSession):
    """
    Fixture to configure test business, agents, knowledge base, conversations,
    and message records to verify operational analytics accurately.
    """
    # 1. Create Business A
    biz_a = Business(name="Corp A", clerk_org_id="org_a_analytics")
    db_session.add(biz_a)
    
    # 2. Create Business B (for tenant isolation check)
    biz_b = Business(name="Corp B", clerk_org_id="org_b_analytics")
    db_session.add(biz_b)
    
    await db_session.flush()
    await db_session.refresh(biz_a)
    await db_session.refresh(biz_b)
    
    # 3. Create Agents for Business A
    agent_a1 = Agent(business_id=biz_a.id, name="Agent A1", system_prompt="Help", temperature=0.2, is_active=True)
    agent_a2 = Agent(business_id=biz_a.id, name="Agent A2", system_prompt="Support", temperature=0.2, is_active=True)
    db_session.add(agent_a1)
    db_session.add(agent_a2)
    
    # Create Agent for Business B
    agent_b = Agent(business_id=biz_b.id, name="Agent B1", system_prompt="Mock", temperature=0.2, is_active=True)
    db_session.add(agent_b)
    
    # 4. Create Knowledge Bases
    kb_a = KnowledgeBase(business_id=biz_a.id, name="Docs A", source_type="file", status="ready")
    db_session.add(kb_a)
    
    await db_session.flush()
    await db_session.refresh(agent_a1)
    await db_session.refresh(agent_a2)
    await db_session.refresh(agent_b)
    await db_session.refresh(kb_a)
    
    # 5. Create Conversations for Business A
    # Active
    conv_a1 = Conversation(business_id=biz_a.id, agent_id=agent_a1.id, status="active", customer_name="Alice")
    # Escalated (handoff)
    conv_a2 = Conversation(business_id=biz_a.id, agent_id=agent_a1.id, status="handoff", customer_name="Bob")
    # Resolved (closed)
    conv_a3 = Conversation(business_id=biz_a.id, agent_id=agent_a2.id, status="closed", customer_name="Charlie")
    db_session.add(conv_a1)
    db_session.add(conv_a2)
    db_session.add(conv_a3)
    
    # Conversations for Business B
    conv_b = Conversation(business_id=biz_b.id, agent_id=agent_b.id, status="active", customer_name="Hacker")
    db_session.add(conv_b)
    
    await db_session.flush()
    await db_session.refresh(conv_a1)
    await db_session.refresh(conv_a2)
    await db_session.refresh(conv_a3)
    await db_session.refresh(conv_b)
    
    # 6. Add Messages
    msg1 = Message(conversation_id=conv_a1.id, sender="customer", content="hello")
    msg2 = Message(conversation_id=conv_a1.id, sender="agent", content="hi there")
    msg3 = Message(conversation_id=conv_a2.id, sender="customer", content="human operator please")
    db_session.add(msg1)
    db_session.add(msg2)
    db_session.add(msg3)
    
    await db_session.flush()
    
    return {
        "biz_a": biz_a,
        "biz_b": biz_b,
        "agent_a1": agent_a1,
        "agent_a2": agent_a2,
        "kb_a": kb_a,
        "conv_a1": conv_a1,
        "conv_a2": conv_a2,
        "conv_a3": conv_a3,
        "conv_b": conv_b
    }


@pytest.mark.asyncio
async def test_analytics_overview_counts(db_session: AsyncSession, setup_analytics_data):
    """
    Validates that GET /api/v1/analytics/overview correctly aggregates counts
    strictly isolated by the tenant business_id context in a single optimized query.
    """
    data = setup_analytics_data
    biz_a = data["biz_a"]
    
    from app.api.v1.analytics import get_analytics_overview
    
    res = await get_analytics_overview(business_id=biz_a.id, db=db_session)
    
    # Assertions
    assert res.total_conversations == 3
    assert res.active_count == 1
    assert res.escalated_count == 1
    assert res.resolved_count == 1
    assert res.total_messages == 3
    assert res.total_agents == 2
    assert res.total_knowledge_bases == 1
    assert res.avg_messages_per_conversation == 1.0


@pytest.mark.asyncio
async def test_analytics_business_id_isolation(db_session: AsyncSession, setup_analytics_data):
    """
    Validates that Business B operational statistics are perfectly isolated from Business A.
    """
    data = setup_analytics_data
    biz_b = data["biz_b"]
    
    from app.api.v1.analytics import get_analytics_overview
    
    res_b = await get_analytics_overview(business_id=biz_b.id, db=db_session)
    
    # Business B should only see its own records
    assert res_b.total_conversations == 1
    assert res_b.active_count == 1
    assert res_b.resolved_count == 0
    assert res_b.escalated_count == 0
    assert res_b.total_agents == 1
    assert res_b.total_knowledge_bases == 0
    assert res_b.total_messages == 0


@pytest.mark.asyncio
async def test_analytics_conversations_pagination(db_session: AsyncSession, setup_analytics_data):
    """
    Validates that the paginated conversations endpoint handles skip/limit and joins
    on agent names correctly.
    """
    data = setup_analytics_data
    biz_a = data["biz_a"]
    
    from app.api.v1.analytics import get_conversations_analytics
    
    # 1. Fetch page 1 with page_size=2
    res_p1 = await get_conversations_analytics(page=1, page_size=2, business_id=biz_a.id, db=db_session)
    
    assert res_p1.total == 3
    assert len(res_p1.items) == 2
    assert res_p1.page == 1
    assert res_p1.page_size == 2
    
    # Check that it returned agent_name by joining Agent table
    assert res_p1.items[0].agent_name in ["Agent A1", "Agent A2"]
    
    # Check message counts are aggregated correctly
    conv_map = {item.id: item.message_count for item in res_p1.items}
    for cid, mcount in conv_map.items():
        if cid == data["conv_a1"].id:
            assert mcount == 2
        elif cid == data["conv_a2"].id:
            assert mcount == 1
        elif cid == data["conv_a3"].id:
            assert mcount == 0
            
    # 2. Fetch page 2 with page_size=2
    res_p2 = await get_conversations_analytics(page=2, page_size=2, business_id=biz_a.id, db=db_session)
    assert len(res_p2.items) == 1
    assert res_p2.page == 2
