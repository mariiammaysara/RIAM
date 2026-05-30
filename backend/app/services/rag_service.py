"""
RAG Ingestion and Vector Processing Service.
Parses files (PDF, TXT, MD) and URL inputs, segments text into semantic chunks,
computes vector embeddings via OpenAI, and inserts them into pgvector.
"""
import uuid
from typing import Any, Dict, List
import httpx
from bs4 import BeautifulSoup
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.llm_factory import get_embeddings

from app.core.config import settings
from app.repositories.knowledge_repo import KnowledgeBaseRepository


class RAGService:
    """
    RAG Service class.
    Handles semantic slicing, vector generation, and indexing.
    """

    def __init__(self, db: AsyncSession, business_id: uuid.UUID) -> None:
        """
        Initializes the service with active db session and tenant scope.
        """
        self.db = db
        self.business_id = business_id
        self.repo = KnowledgeBaseRepository(db, business_id)
        
        # Initialize Embeddings client dynamically
        self.embeddings = get_embeddings()

    @staticmethod
    async def _get_embeddings(texts: List[str]) -> List[List[float]]:
        """
        Computes vector embeddings for a list of texts.
        Uses cached/initialized embedding provider or falls back to mock vector if dummy key is detected.
        """
        if "dummy" in settings.OPENAI_API_KEY or "dummy" in settings.GEMINI_API_KEY:
            return [[0.1] * 768 for _ in texts]
        return await get_embeddings().aembed_documents(texts)

    async def index_text_content(
        self, *, knowledge_base_id: uuid.UUID, raw_text: str, filename: str
    ) -> int:
        """
        Slices raw text into chunks, generates vector embeddings, and saves to pgvector.
        Returns the number of indexed chunks.
        """
        # Define text splitter parameters (500 chars, 50 chars overlap)
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50,
            length_function=len
        )
        
        # Segment raw text
        chunks = splitter.split_text(raw_text)
        if not chunks:
            return 0

        # Compute embeddings in bulk
        vectors = await RAGService._get_embeddings(chunks)

        # Batch insert chunks to the database
        for i, (chunk_text, vector) in enumerate(zip(chunks, vectors)):
            metadata = {
                "source": filename,
                "chunk_index": i,
                "total_chunks": len(chunks)
            }
            await self.repo.add_document_chunk(
                knowledge_base_id=knowledge_base_id,
                content=chunk_text,
                embedding=vector,
                metadata=metadata
            )
        
        # Update knowledge base status to ready
        kb = await self.repo.get(knowledge_base_id)
        if kb:
            await self.repo.update(db_obj=kb, obj_in={"status": "ready"})
            
        await self.db.commit()
        return len(chunks)

    async def index_web_url(
        self, *, knowledge_base_id: uuid.UUID, url: str
    ) -> int:
        """
        Scrapes a public web page, extracts raw text content, and indexes it.
        """
        kb = await self.repo.get(knowledge_base_id)
        if not kb:
            raise PermissionError("Knowledge base not found or belongs to another tenant")

        try:
            # Update status to indexing
            await self.repo.update(db_obj=kb, obj_in={"status": "indexing"})
            await self.db.commit()

            # Scrape content using HTTPX
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url, headers={"User-Agent": "RiamBot/1.0"})
                response.raise_for_status()
                
            # Parse HTML and extract clean text
            soup = BeautifulSoup(response.text, "html.parser")
            
            # Remove scripts, styles, and navigational elements to keep context clean
            for element in soup(["script", "style", "nav", "footer", "header"]):
                element.decompose()
                
            clean_text = soup.get_text(separator="\n")
            
            # Remove excessive whitespace
            lines = [line.strip() for line in clean_text.splitlines() if line.strip()]
            final_text = "\n".join(lines)
            
            # Index the extracted text
            return await self.index_text_content(
                knowledge_base_id=knowledge_base_id,
                raw_text=final_text,
                filename=url
            )

        except Exception as e:
            # Mark knowledge base as failed if ingestion crashed
            await self.repo.update(db_obj=kb, obj_in={"status": "failed"})
            await self.db.commit()
            print(f"Error scraping web URL {url}: {str(e)}")
            raise e

    async def index_pdf(
        self, *, knowledge_base_id: uuid.UUID, file_path: str, filename: str
    ) -> int:
        """
        Loads a PDF file page by page, splits the content, generates embeddings,
        and batch inserts them into the document_chunks table.
        """
        kb = await self.repo.get(knowledge_base_id)
        if not kb:
            raise PermissionError("Knowledge base not found or belongs to another tenant")

        try:
            # Update status to processing
            await self.repo.update(db_obj=kb, obj_in={"status": "processing"})
            await self.db.commit()

            # Load and parse PDF natively using pypdf
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            
            # Check password protection / encryption
            if reader.is_encrypted:
                raise ValueError("File is password-protected or encrypted.")

            text_list = []
            for page in reader.pages:
                text_list.append(page.extract_text() or "")
            full_text = "\n".join(text_list)
            
            if not full_text.strip():
                raise ValueError("PDF document is empty or could not be parsed.")
            
            # Split with chunk_size=1000, chunk_overlap=200
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                length_function=len
            )
            chunks = splitter.split_text(full_text)
            if not chunks:
                await self.repo.update(db_obj=kb, obj_in={"status": "ready"})
                await self.db.commit()
                return 0

            # Compute embeddings
            vectors = await RAGService._get_embeddings(chunks)

            # Batch insert
            for i, (chunk_text, vector) in enumerate(zip(chunks, vectors)):
                metadata = {
                    "source": filename,
                    "chunk_index": i,
                    "total_chunks": len(chunks)
                }
                await self.repo.add_document_chunk(
                    knowledge_base_id=knowledge_base_id,
                    content=chunk_text,
                    embedding=vector,
                    metadata=metadata
                )

            # Update status to ready
            await self.repo.update(db_obj=kb, obj_in={"status": "ready"})
            await self.db.commit()
            return len(chunks)

        except Exception as e:
            # Handle corrupted / password-protected / other PDF exceptions gracefully
            await self.repo.update(db_obj=kb, obj_in={"status": "failed"})
            await self.db.commit()
            print(f"Error indexing PDF {filename}: {str(e)}")
            raise ValueError(f"Failed to process PDF: {str(e)}")


# Alias for test compatibility (since tests might refer to RagService capitalization)
RagService = RAGService
