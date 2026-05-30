"""
Agent repository module.
Manages database operations for the Agent model within the tenant scope.
"""
from typing import List
from sqlalchemy import select
from app.models.base import Agent
from app.repositories.base import BaseRepository


class AgentRepository(BaseRepository[Agent]):
    """
    Agent repository class.
    Provides standard and specialized CRUD methods for AI agents.
    """

    async def get_active_agents(self) -> List[Agent]:
        """
        Retrieves all active agents owned by this business tenant.
        """
        query = select(Agent).where(
            Agent.is_active == True,
            Agent.business_id == self.business_id
        ).order_by(Agent.created_at.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())
