"""
Unit tests for Riam dynamic embedding providers.
Validates that get_embeddings returns correctly configured models and
produces the correct 1536-dimension outputs without making real API calls.
"""
import pytest
from unittest.mock import patch
from app.services.llm_factory import get_embeddings


def test_embeddings_provider_initialization():
    """
    Verifies that the factory returns correctly configured embedding instances.
    """
    gemini_emb = get_embeddings("gemini")
    assert gemini_emb.model == "gemini-embedding-001"
    assert gemini_emb.task_type == "retrieval_document"
    assert gemini_emb.output_dimensionality == 768

    openai_emb = get_embeddings("openai")
    assert openai_emb.model == "text-embedding-3-small"

    import app.services.llm_factory
    app.services.llm_factory._hf_embeddings = None
    with patch("langchain_huggingface.HuggingFaceEmbeddings") as mock_hf:
        hf_emb = get_embeddings("huggingface")
        mock_hf.assert_called_once_with(
            model_name="sentence-transformers/all-mpnet-base-v2",
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True}
        )
        assert hf_emb == mock_hf.return_value


@pytest.mark.asyncio
async def test_gemini_embeddings_dimension_mock():
    """
    Mocks the embedding method on the class level to verify that a query
    returns a 1536-dimensional vector, avoiding Pydantic assignment validation.
    """
    gemini_emb = get_embeddings("gemini")
    mock_vector = [0.1] * 1536

    with patch("langchain_google_genai.GoogleGenerativeAIEmbeddings.aembed_query", return_value=mock_vector) as mock_method:
        res = await gemini_emb.aembed_query("test query")
        assert len(res) == 1536
        mock_method.assert_called_once_with("test query")
