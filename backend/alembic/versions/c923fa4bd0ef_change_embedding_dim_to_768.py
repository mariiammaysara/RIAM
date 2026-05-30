"""change_embedding_dim_to_768

Revision ID: c923fa4bd0ef
Revises: a5b19e390259
Create Date: 2026-05-24 23:50:49.445361

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = 'c923fa4bd0ef'
down_revision: Union[str, Sequence[str], None] = 'a5b19e390259'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Change document_chunks.embedding from vector(1536) to vector(768) to match text-embedding-004."""
    # Check if the table exists before altering (guards against torn-down test databases)
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_name = 'document_chunks')"
        )
    )
    if result.scalar():
        op.alter_column(
            'document_chunks',
            'embedding',
            type_=Vector(768),
            postgresql_using='embedding::vector(768)',
        )


def downgrade() -> None:
    """Revert document_chunks.embedding back to vector(1536)."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_name = 'document_chunks')"
        )
    )
    if result.scalar():
        op.alter_column(
            'document_chunks',
            'embedding',
            type_=Vector(1536),
            postgresql_using='embedding::vector(1536)',
        )
