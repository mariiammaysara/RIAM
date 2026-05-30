"""
Base repository module.
Implements the generic repository pattern with strict tenant isolation.
Every database operation is filtered by the injected business_id context.
"""
from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union
import uuid
import logging
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    """
    Abstract Base Repository enforcing multi-tenancy rules.
    Injects business_id context and automatically filters all transactions.
    """

    def __init__(self, db: AsyncSession, business_id: uuid.UUID) -> None:
        """
        Initializes the repository with an active database session and tenant context.
        """
        self.db = db
        self.business_id = business_id
        self.model: Type[ModelT] = self.__orig_bases__[0].__args__[0]  # Get the Model class type

    async def get(self, id: uuid.UUID) -> Optional[ModelT]:
        """
        Retrieve a single model instance by its primary key.
        Enforces tenant filtering on the business_id column.
        """
        query = select(self.model).where(
            self.model.id == id,
            self.model.business_id == self.business_id
        )
        result = await self.db.execute(query)
        return result.scalars().first()

    async def get_multi(
        self, *, skip: int = 0, limit: int = 100
    ) -> List[ModelT]:
        """
        Retrieve a page of model instances, ordered by created_at.
        Enforces tenant filtering on the business_id column.
        """
        query = (
            select(self.model)
            .where(self.model.business_id == self.business_id)
            .offset(skip)
            .limit(limit)
        )
        # Order by created_at if the model has that attribute
        if hasattr(self.model, "created_at"):
            query = query.order_by(self.model.created_at.desc())
        
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create(self, obj_in: Dict[str, Any]) -> ModelT:
        """
        Create a new database record.
        Forces the business_id to match the repository's tenant context.
        """
        logger = logging.getLogger(__name__)
        # Exclude business_id if present in input and override with context
        data = {**obj_in, "business_id": self.business_id}
        db_obj = self.model(**data)
        logger.info(f"[DB CREATE] Adding {self.model.__name__} record to session: {data}")
        self.db.add(db_obj)
        await self.db.flush()  # Populates id and default attributes
        logger.info(f"[DB CREATE] Flushed {self.model.__name__} (allocated ID: {db_obj.id}). Committing transaction...")
        await self.db.commit()
        await self.db.refresh(db_obj)
        logger.info(f"[DB CREATE] Committed successfully. Row persisted: ID={db_obj.id}")
        return db_obj

    async def update(
        self, *, db_obj: ModelT, obj_in: Union[Dict[str, Any], Any]
    ) -> ModelT:
        """
        Update an existing database record.
        Ensures the object belongs to the tenant context before flushing.
        """
        logger = logging.getLogger(__name__)
        if db_obj.business_id != self.business_id:
            raise PermissionError("Access denied: Tenant context mismatch")

        update_data = obj_in if isinstance(obj_in, dict) else obj_in.model_dump(exclude_unset=True)
        # Ensure tenant ownership cannot be changed
        update_data.pop("business_id", None)
        update_data.pop("id", None)

        logger.info(f"[DB UPDATE] Modifying {self.model.__name__} ID {db_obj.id} with values: {update_data}")
        for field in update_data:
            if hasattr(db_obj, field):
                setattr(db_obj, field, update_data[field])

        self.db.add(db_obj)
        await self.db.flush()
        logger.info(f"[DB UPDATE] Flushed changes for {self.model.__name__} ID {db_obj.id}. Committing transaction...")
        await self.db.commit()
        await self.db.refresh(db_obj)
        logger.info(f"[DB UPDATE] Committed successfully. Row updated: ID={db_obj.id}")
        return db_obj

    async def remove(self, id: uuid.UUID) -> Optional[ModelT]:
        """
        Remove a database record.
        Ensures the object belongs to the tenant context before deleting.
        """
        logger = logging.getLogger(__name__)
        db_obj = await self.get(id)
        if db_obj:
            logger.info(f"[DB REMOVE] Deleting {self.model.__name__} ID {db_obj.id} from session")
            await self.db.delete(db_obj)
            await self.db.flush()
            logger.info(f"[DB REMOVE] Flushed deletion. Committing transaction...")
            await self.db.commit()
            logger.info(f"[DB REMOVE] Committed successfully. Row deleted: ID={id}")
        return db_obj
