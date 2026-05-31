import asyncio
from sqlalchemy import text
from app.core.database import async_session_maker

async def clear_db():
    print("Clearing document_chunks and knowledge_bases tables on Neon DB...")
    async with async_session_maker() as session:
        try:
            # Delete document chunks first due to foreign key constraints
            await session.execute(text("DELETE FROM document_chunks;"))
            await session.execute(text("DELETE FROM knowledge_bases;"))
            await session.commit()
            print("Tables cleared successfully!")
        except Exception as e:
            await session.rollback()
            print(f"Error clearing database: {str(e)}")

if __name__ == "__main__":
    asyncio.run(clear_db())
