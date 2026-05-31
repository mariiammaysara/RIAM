from enum import Enum

class LLMProvider(str, Enum):
    GEMINI = "gemini"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GROQ = "groq"

class EmbeddingProvider(str, Enum):
    GEMINI = "gemini"
    OPENAI = "openai"
    HUGGINGFACE = "huggingface"

class KnowledgeSourceType(str, Enum):
    PDF = "pdf"
    URL = "url"
    FILE = "file"

class ConversationStatus(str, Enum):
    ACTIVE = "active"
    HANDOFF = "handoff"
    CLOSED = "closed"

class MessageSender(str, Enum):
    CUSTOMER = "customer"
    AGENT = "agent"
    HUMAN = "human"

class KnowledgeBaseStatus(str, Enum):
    INDEXING = "indexing"
    READY = "ready"
    FAILED = "failed"
