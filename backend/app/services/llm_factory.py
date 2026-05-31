"""
LLM and Embeddings Provider Factory.
Provides dynamic initialization of LangChain LLM models and Embeddings
based on system settings or custom agent configuration.
"""
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.embeddings import Embeddings
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_anthropic import ChatAnthropic
from langchain_groq import ChatGroq

from app.core.config import settings
from app.core.enums import LLMProvider, EmbeddingProvider

# At module level - loaded once on startup
_hf_embeddings = None


def get_llm(provider: str = None) -> BaseChatModel:
    """
    Returns the correct LangChain LLM instance based on configuration.
    """
    p = LLMProvider(provider or settings.LLM_PROVIDER)
    if p == LLMProvider.GEMINI:
        return ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.0,
            streaming=True
        )
    elif p == LLMProvider.OPENAI:
        return ChatOpenAI(
            model="gpt-4o",
            api_key=settings.OPENAI_API_KEY,
            temperature=0.0,
            streaming=True
        )
    elif p == LLMProvider.ANTHROPIC:
        return ChatAnthropic(
            model="claude-sonnet-4-20250514",
            api_key=settings.ANTHROPIC_API_KEY,
            temperature=0.0,
            streaming=True
        )
    elif p == LLMProvider.GROQ:
        return ChatGroq(
            model="llama-3.3-70b-versatile",
            api_key=settings.GROQ_API_KEY,
            temperature=0.0,
            streaming=True
        )
    else:
        raise ValueError(f"Unknown provider: {p}")


def get_embeddings(provider: str = None) -> Embeddings:
    """
    Returns the correct LangChain Embeddings instance based on configuration.
    """
    global _hf_embeddings
    p = EmbeddingProvider(provider or settings.EMBEDDING_PROVIDER)
    if p == EmbeddingProvider.HUGGINGFACE:
        if _hf_embeddings is None:
            from langchain_huggingface import HuggingFaceEmbeddings
            _hf_embeddings = HuggingFaceEmbeddings(
                model_name="sentence-transformers/all-mpnet-base-v2",
                model_kwargs={"device": "cpu"},
                encode_kwargs={"normalize_embeddings": True}
            )
        return _hf_embeddings
    elif p == EmbeddingProvider.GEMINI:
        return GoogleGenerativeAIEmbeddings(
            model="gemini-embedding-001",
            google_api_key=settings.GEMINI_API_KEY,
            task_type="retrieval_document",
            output_dimensionality=768,
        )
    elif p == EmbeddingProvider.OPENAI:
        return OpenAIEmbeddings(
            model="text-embedding-3-small",
            api_key=settings.OPENAI_API_KEY
        )
    else:
        raise ValueError(f"Unknown embedding provider: {p}")
