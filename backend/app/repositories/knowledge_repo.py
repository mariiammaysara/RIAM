"""
Knowledge base and document chunks repository module.
Manages file/URL source metadata and performs tenant-isolated pgvector semantic searches.
Supports SQLite fallback for robust local test automation (pytest).
"""
from typing import Any, Dict, List, Tuple
import uuid
from sqlalchemy import select, cast
from sqlalchemy.orm import joinedload
from pgvector.sqlalchemy import Vector

from app.models.base import DocumentChunk, KnowledgeBase
from app.repositories.base import BaseRepository


class KnowledgeBaseRepository(BaseRepository[KnowledgeBase]):
    """
    KnowledgeBase repository class.
    Manages document/URL indexes and runs high-performance pgvector queries.
    """

    async def add_document_chunk(
        self, *, knowledge_base_id: uuid.UUID, content: str, embedding: List[float], metadata: Dict[str, Any]
    ) -> DocumentChunk:
        """
        Securely inserts a text chunk and its computed vector embedding.
        Verifies ownership of the parent knowledge base before writing.
        """
        # Verify ownership first
        kb = await self.get(knowledge_base_id)
        if not kb:
            raise PermissionError("Access denied: Knowledge base not found or belongs to another tenant")

        chunk = DocumentChunk(
            knowledge_base_id=knowledge_base_id,
            content=content,
            embedding=embedding,
            meta_data=metadata
        )
        self.db.add(chunk)
        await self.db.flush()
        return chunk

    async def delete_all_chunks(self, knowledge_base_id: uuid.UUID) -> None:
        """
        Deletes all document chunks associated with a specific knowledge base.
        Verifies ownership before deleting.
        """
        kb = await self.get(knowledge_base_id)
        if not kb:
            raise PermissionError("Access denied: Knowledge base not found or belongs to another tenant")

        from sqlalchemy import delete
        stmt = delete(DocumentChunk).where(DocumentChunk.knowledge_base_id == knowledge_base_id)
        await self.db.execute(stmt)
        await self.db.flush()

    async def search_similar_chunks(
        self, *, embedding: List[float], limit: int = 5
    ) -> List[Tuple[DocumentChunk, float]]:
        """
        Performs a vector similarity search across all document chunks owned by this tenant.
        Joins KnowledgeBase to guarantee strict customer isolation.
        
        Returns a list of tuples containing the DocumentChunk and its similarity distance.
        Supports SQLite database fallback in local test environments.
        """
        # Detect SQLite fallback for automated unit testing (bypasses pgvector binary operators)
        bind_url = str(self.db.bind.url if self.db.bind else "")
        if "sqlite" in bind_url:
            # Enforce the identical multi-tenant isolation joins and where clauses in SQLite
            query = (
                select(DocumentChunk)
                .join(KnowledgeBase, DocumentChunk.knowledge_base_id == KnowledgeBase.id)
                .where(KnowledgeBase.business_id == self.business_id)
                .limit(limit)
            )
            result = await self.db.execute(query)
            return [(chunk, 0.0) for chunk in result.scalars().all()]

        # Standard high-performance pgvector Cosine distance search in PostgreSQL
        vector_embedding = cast(embedding, Vector(len(embedding)))
        distance_col = DocumentChunk.embedding.cosine_distance(vector_embedding).label("distance")
        
        query = (
            select(DocumentChunk, distance_col)
            .join(KnowledgeBase, DocumentChunk.knowledge_base_id == KnowledgeBase.id)
            .where(KnowledgeBase.business_id == self.business_id)
            .order_by(distance_col)
            .limit(limit)
        )
        
        result = await self.db.execute(query)
        rows = result.all()
        
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Found {len(rows)} chunks for query")
        
        return [(row[0], row[1]) for row in rows]
