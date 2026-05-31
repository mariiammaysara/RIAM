"""
Agent API Router.
Provides REST controllers for configuring AI agents, fully scoped by tenant.
"""
from typing import List
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_tenant_id
from app.repositories.agent_repo import AgentRepository
from app.schemas.base import AgentCreate, AgentResponse, AgentUpdate

router = APIRouter(prefix="/agents", tags=["Agents Management"])


@router.post("/", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    agent_in: AgentCreate,
    business_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Creates a new support agent configuration for the business.
    """
    repo = AgentRepository(db, business_id)
    return await repo.create(agent_in.model_dump())


@router.get("/", response_model=List[AgentResponse])
async def list_agents(
    business_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves all configured support agents for the business.
    """
    repo = AgentRepository(db, business_id)
    return await repo.get_multi()


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: uuid.UUID,
    business_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves a specific agent configuration.
    """
    repo = AgentRepository(db, business_id)
    agent = await repo.get(agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    return agent


@router.patch("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: uuid.UUID,
    agent_in: AgentUpdate,
    business_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Updates an active agent configuration.
    """
    repo = AgentRepository(db, business_id)
    agent = await repo.get(agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    return await repo.update(db_obj=agent, obj_in=agent_in)


@router.delete("/{agent_id}", status_code=204)
async def delete_agent(
    agent_id: uuid.UUID,
    business_id: uuid.UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    repo = AgentRepository(db, business_id)
    agent = await repo.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404,
                          detail="Not found")
    await repo.remove(agent_id)
    return None
