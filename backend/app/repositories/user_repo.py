"""
User repository module.
Manages database operations for the User model within the tenant scope.
"""
from typing import Optional
from sqlalchemy import select
from app.models.base import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """
    User repository class.
    Enforces tenant filters and manages unique Clerk mappings.
    """

    async def get_by_clerk_user_id(self, clerk_user_id: str) -> Optional[User]:
        """
        Retrieves a user by their Clerk ID, ensuring they belong to the current business tenant.
        """
        query = select(User).where(
            User.clerk_user_id == clerk_user_id,
            User.business_id == self.business_id
        )
        result = await self.db.execute(query)
        return result.scalars().first()
