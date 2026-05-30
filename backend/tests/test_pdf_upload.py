"""
Integration tests for Riam PDF upload and indexing.
Validates that PDF parsing extracts text page by page, splits into chunks,
persists embeddings strictly isolated by business_id, and handles
corrupted or password-protected files gracefully.
"""
import os
import pytest
from unittest.mock import patch
from fpdf import FPDF
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Business, KnowledgeBase
from app.services.rag_service import RAGService
from app.repositories.knowledge_repo import KnowledgeBaseRepository


@pytest.fixture(autouse=True)
def mock_embeddings(monkeypatch):
    from unittest.mock import MagicMock
    mock_emb = MagicMock()
    monkeypatch.setattr(
        "app.services.rag_service.get_embeddings",
        lambda *args, **kwargs: mock_emb
    )
    async def fake_embed(texts):
        return [[0.1] * 768 for _ in texts]
    monkeypatch.setattr(
        "app.services.rag_service.RagService._get_embeddings",
        fake_embed
    )


def create_mock_pdf(path: str, text: str):
    """
    Creates a simple mock PDF containing the specified text using fpdf2.
    """
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=12)
    pdf.multi_cell(0, 10, text=text)
    pdf.output(path)


@pytest.fixture
def temp_pdf_files():
    """
    Fixture to handle temporary test PDFs.
    """
    valid_path = "test_valid.pdf"
    corrupted_path = "test_corrupted.pdf"
    
    # 1. Create a valid mock PDF
    sample_text = (
        "Riam Enterprise Return Policy Guidelines.\n"
        "Customers can return any product within 30 days of purchase for a full refund.\n"
        "Products must be in their original packaging and unused.\n"
        "Refunds are processed back to the original payment method within 5-7 business days."
    )
    create_mock_pdf(valid_path, sample_text)

    # 2. Create a corrupted PDF
    with open(corrupted_path, "wb") as f:
        f.write(b"This is a completely corrupted non-PDF file payload.")

    yield {
        "valid": valid_path,
        "corrupted": corrupted_path,
        "sample_text": sample_text
    }

    # Cleanup after tests
    for p in [valid_path, corrupted_path]:
        if os.path.exists(p):
            try:
                os.remove(p)
            except Exception:
                pass


@pytest.mark.asyncio
async def test_pdf_parsing_and_ingestion(db_session: AsyncSession, temp_pdf_files):
    """
    Tests that a valid PDF file is parsed, split into chunks, embedded,
    and stored in the database isolated by business_id.
    """
    # Create a business
    business = Business(name="Enterprise PDF Corp", clerk_org_id="org_pdf_clerk")
    db_session.add(business)
    await db_session.flush()
    await db_session.refresh(business)

    # Create a Knowledge Base source record for this business
    kb = KnowledgeBase(
        business_id=business.id,
        name="Return Policies PDF",
        source_type="pdf",
        status="indexing"
    )
    db_session.add(kb)
    await db_session.flush()
    await db_session.refresh(kb)

    # Instantiate service
    service = RAGService(db_session, business.id)

    # Index the PDF
    chunk_count = await service.index_pdf(
        knowledge_base_id=kb.id,
        file_path=temp_pdf_files["valid"],
        filename="test_valid.pdf"
    )

    assert chunk_count > 0

    # Retrieve knowledge base status
    await db_session.refresh(kb)
    assert kb.status == "ready"

    # Query DB to verify chunks are stored with correct business isolation
    repo = KnowledgeBaseRepository(db_session, business.id)
    chunks_with_dist = await repo.search_similar_chunks(embedding=[0.1]*768, limit=10)
    
    assert len(chunks_with_dist) > 0
    # Make sure text contents from PDF are present
    chunk_contents = [chunk.content for chunk, dist in chunks_with_dist]
    assert any("Return Policy Guidelines" in content for content in chunk_contents)

    # Verify that a different business cannot access these chunks
    other_business = Business(name="Hacker Corp", clerk_org_id="org_hacker_clerk")
    db_session.add(other_business)
    await db_session.flush()
    await db_session.refresh(other_business)

    other_repo = KnowledgeBaseRepository(db_session, other_business.id)
    hacker_results = await other_repo.search_similar_chunks(embedding=[0.1]*768, limit=10)
    assert len(hacker_results) == 0  # Perfect multi-tenant isolation!


@pytest.mark.asyncio
async def test_corrupted_pdf_graceful_handling(db_session: AsyncSession, temp_pdf_files):
    """
    Verifies that a corrupted PDF updates the knowledge base status to 'failed'
    and raises a clean ValueError.
    """
    business = Business(name="Graceful Corp", clerk_org_id="org_graceful_clerk")
    db_session.add(business)
    await db_session.flush()
    await db_session.refresh(business)

    kb = KnowledgeBase(
        business_id=business.id,
        name="Corrupted PDF Ingestion",
        source_type="pdf",
        status="indexing"
    )
    db_session.add(kb)
    await db_session.flush()
    await db_session.refresh(kb)

    service = RAGService(db_session, business.id)

    with pytest.raises(ValueError) as exc_info:
        await service.index_pdf(
            knowledge_base_id=kb.id,
            file_path=temp_pdf_files["corrupted"],
            filename="test_corrupted.pdf"
        )
    
    assert "Failed to process PDF" in str(exc_info.value)
    
    # Reload and assert status is failed
    await db_session.refresh(kb)
    assert kb.status == "failed"


@pytest.mark.asyncio
async def test_password_protected_pdf_graceful_handling(db_session: AsyncSession, temp_pdf_files):
    """
    Mocks a password-protected PDF parsing exception and verifies it is handled gracefully
    by updating the status to failed and raising a ValueError.
    """
    business = Business(name="Secure Corp", clerk_org_id="org_secure_clerk")
    db_session.add(business)
    await db_session.flush()
    await db_session.refresh(business)

    kb = KnowledgeBase(
        business_id=business.id,
        name="Protected PDF Ingestion",
        source_type="pdf",
        status="indexing"
    )
    db_session.add(kb)
    await db_session.flush()
    await db_session.refresh(kb)

    service = RAGService(db_session, business.id)

    # Mock PdfReader to act as password-protected/encrypted
    with patch("pypdf.PdfReader") as mock_reader_cls:
        mock_reader = mock_reader_cls.return_value
        mock_reader.is_encrypted = True

        with pytest.raises(ValueError) as exc_info:
            await service.index_pdf(
                knowledge_base_id=kb.id,
                file_path=temp_pdf_files["valid"],
                filename="test_protected.pdf"
            )
        assert "Failed to process PDF" in str(exc_info.value)

    # Verify status is failed
    await db_session.refresh(kb)
    assert kb.status == "failed"


@pytest.mark.asyncio
async def test_pdf_upload_endpoint(db_session: AsyncSession, temp_pdf_files):
    """
    Integration test for POST /api/v1/knowledge/upload/pdf.
    Verifies that the PDF upload endpoint responds with a 200 OK and successfully parses the PDF.
    """
    import httpx
    from app.main import app
    from app.core.security import get_current_tenant_id
    from app.core.database import get_db

    # Create a business
    business = Business(name="Endpoint PDF Corp", clerk_org_id="org_endpoint_pdf")
    db_session.add(business)
    await db_session.flush()
    await db_session.refresh(business)

    # Create a Knowledge Base source record for this business
    kb = KnowledgeBase(
        business_id=business.id,
        name="Endpoint Policy PDF",
        source_type="pdf",
        status="indexing"
    )
    db_session.add(kb)
    await db_session.flush()
    await db_session.refresh(kb)

    # Override dependencies
    app.dependency_overrides[get_current_tenant_id] = lambda: business.id
    app.dependency_overrides[get_db] = lambda: db_session

    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            with open(temp_pdf_files["valid"], "rb") as f:
                files = {"file": (os.path.basename(temp_pdf_files["valid"]), f, "application/pdf")}
                response = await client.post(
                    f"/api/v1/knowledge/upload/pdf?kb_id={kb.id}",
                    files=files
                )
        
        assert response.status_code == 200
        data = response.json()
        assert data["knowledge_base_id"] == str(kb.id)
        assert data["status"] == "ready"
        assert data["chunk_count"] > 0
        
        # Verify status in database
        await db_session.refresh(kb)
        assert kb.status == "ready"

    finally:
        # Clear overrides
        app.dependency_overrides.clear()

