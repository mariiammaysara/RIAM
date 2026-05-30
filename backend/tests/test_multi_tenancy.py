"""
Integration test cases for Riam multi-tenancy rules.
Validates that Business B cannot access, modify, or leak data belonging to Business A
under any circumstance, including transactional CRUD and pgvector RAG searches.
"""
import pytest
import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Business, Agent, KnowledgeBase, DocumentChunk
from app.repositories.agent_repo import AgentRepository
from app.repositories.knowledge_repo import KnowledgeBaseRepository


@pytest.fixture
async def setup_tenants(db_session: AsyncSession):
    """
    Fixture to set up two distinct businesses (tenants) with sample records.
    Uses .flush() instead of .commit() to support clean transactional rollbacks.
    """
    # 1. Create Business A
    business_a = Business(name="Enterprise A", clerk_org_id="org_a_clerk")
    db_session.add(business_a)
    
    # 2. Create Business B
    business_b = Business(name="Enterprise B", clerk_org_id="org_b_clerk")
    db_session.add(business_b)
    
    await db_session.flush()
    await db_session.refresh(business_a)
    await db_session.refresh(business_b)
    
    # 3. Create Agent A belonging to Business A
    agent_a = Agent(
        business_id=business_a.id,
        name="Support Agent A",
        system_prompt="Instruction A",
        temperature=0.2,
        is_active=True
    )
    db_session.add(agent_a)
    
    # 4. Create Knowledge Base A belonging to Business A
    kb_a = KnowledgeBase(
        business_id=business_a.id,
        name="Source Docs A",
        source_type="file",
        status="ready"
    )
    db_session.add(kb_a)
    
    await db_session.flush()
    await db_session.refresh(agent_a)
    await db_session.refresh(kb_a)
    
    # 5. Insert mock document chunk for Business A
    # pgvector 768 dim mock vector (matches text-embedding-004)
    vector_a = [0.1] * 768
    chunk_a = DocumentChunk(
        knowledge_base_id=kb_a.id,
        content="Secret Company A Policy regarding returns.",
        embedding=vector_a
    )
    db_session.add(chunk_a)
    await db_session.flush()
    
    return {
        "business_a": business_a,
        "business_b": business_b,
        "agent_a": agent_a,
        "kb_a": kb_a,
        "chunk_a": chunk_a
    }


@pytest.mark.asyncio
async def test_tenant_crud_isolation(db_session: AsyncSession, setup_tenants):
    """
    Tests that Business B cannot read, update, or delete Business A's agents.
    """
    # Pytest-asyncio automatically awaits async fixtures, so setup_tenants is already a dict
    tenants = setup_tenants
    biz_a = tenants["business_a"]
    biz_b = tenants["business_b"]
    agent_a = tenants["agent_a"]
    
    # Instantiate repositories
    repo_b = AgentRepository(db_session, biz_b.id)
    
    # 1. Assert Business B cannot read Business A's agent
    retrieved = await repo_b.get(agent_a.id)
    assert retrieved is None, "Security Leak: Tenant B was able to fetch Tenant A's agent!"
    
    # 2. Assert Business B cannot update Business A's agent
    # Passing an object owned by Tenant A into Tenant B's repository should raise a PermissionError
    with pytest.raises(PermissionError):
        await repo_b.update(db_obj=agent_a, obj_in={"name": "Hacked Name"})
        
    # 3. Assert Business B cannot delete Business A's agent
    # Should not delete, since get inside remove yields None
    removed = await repo_b.remove(agent_a.id)
    assert removed is None, "Security Leak: Tenant B was able to delete Tenant A's agent!"


@pytest.mark.asyncio
async def test_tenant_pgvector_rag_isolation(db_session: AsyncSession, setup_tenants):
    """
    Tests that pgvector semantic queries executed under Business B's context
    never return or leak document chunks owned by Business A's knowledge bases.
    """
    # Pytest-asyncio automatically awaits async fixtures, so setup_tenants is already a dict
    tenants = setup_tenants
    biz_b = tenants["business_b"]
    
    # Instantiate RAG repository under Business B's context
    kb_repo_b = KnowledgeBaseRepository(db_session, biz_b.id)
    
    # Compute query vector (perfect match query resembling Tenant A's secret)
    # Cosine distance should be very low, but it should return 0 results
    # because it joins KnowledgeBase and filters by business_id == biz_b.id
    query_vector = [0.1] * 768
    
    results = await kb_repo_b.search_similar_chunks(embedding=query_vector, limit=5)
    
    # Verify no leaks
    assert len(results) == 0, "Security Leak: Tenant B semantic search leaked Tenant A's document chunks!"
