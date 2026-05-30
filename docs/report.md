# Walkthrough: HuggingFace Embeddings Integration & Vector Search Optimizations

Successfully integrated **HuggingFace embeddings** (`sentence-transformers/all-mpnet-base-v2` with exactly 768 dimensions) as a free alternative to Gemini/OpenAI embeddings in Riam. Additionally, resolved request-time loading bottlenecks and fixed the pgvector similarity search serialization crash.

---

## Changes Made

### 1. Dependencies
- Installed the required libraries in the backend environment:
  - `langchain-huggingface`
  - `sentence-transformers`

### 2. LLM & Embedding Factory (with Singleton Caching)
- Updated [llm_factory.py](file:///c:/Users/Mariam%20Hagag/Desktop/Riam/backend/app/services/llm_factory.py):
  - Declared `_hf_embeddings = None` at module scope.
  - Configured `get_embeddings()` using the singleton pattern so that `HuggingFaceEmbeddings` is initialized exactly **once** on first invocation, and cached globally.

### 3. Application Lifecycle Pre-loading
- Updated [main.py](file:///c:/Users/Mariam%20Hagag/Desktop/Riam/backend/app/main.py):
  - Modified the FastAPI `lifespan` manager to dynamically pre-load and cache the HuggingFace embeddings model when `EMBEDDING_PROVIDER == "huggingface"` on server startup.
  - This guarantees that model loading (which takes several seconds) occurs **only once on startup** and never blocks API requests or triggers timeouts/500 errors.

### 4. pgvector Similarity Search Query Serialization Fix
- Updated [base.py](file:///c:/Users/Mariam%20Hagag/Desktop/Riam/backend/app/models/base.py):
  - Identified that during a pgvector similarity search, passing a raw Python `list` to the SQLAlchemy similarity function (`func.cosine_distance`) bypasses the column-level type-binding processor, causing `asyncpg.exceptions.DataError: invalid input for query argument $1 (expected str, got list)`.
  - Modified the `VectorComparator` class's similarity comparator methods (`cosine_distance`, `l2_distance`, and `max_inner_product`) to intercept Python lists and tuples and serialize them into clean, pgvector-compliant string literals (e.g. `"[0.1,0.2,...]"`).
  - This ensures complete PostgreSQL driver compatibility during semantic search without relying on implicit driver casting.

### 5. Settings & Configuration
- Configured default settings in [config.py](file:///c:/Users/Mariam%20Hagag/Desktop/Riam/backend/app/core/config.py) and [.env](file:///c:/Users/Mariam%20Hagag/Desktop/Riam/backend/.env):
  - `EMBEDDING_PROVIDER: str = "huggingface"`

### 6. Automated Tests
- Updated [conftest.py](file:///c:/Users/Mariam%20Hagag/Desktop/Riam/backend/tests/conftest.py):
  - Added a session-scoped autouse pytest fixture `mock_hf_embeddings_globally` that globally intercepts and mocks `langchain_huggingface.HuggingFaceEmbeddings`.
  - This ensures that integration tests and ASGI lifespan startups never download or load real heavy model files during test runs.
- Updated [test_embeddings.py](file:///c:/Users/Mariam%20Hagag/Desktop/Riam/backend/tests/test_embeddings.py):
  - Validated that `get_embeddings()` returns the correctly configured cached singleton model and handles mock expectations accurately.
- Updated [test_pdf_upload.py](file:///c:/Users/Mariam%20Hagag/Desktop/Riam/backend/tests/test_pdf_upload.py):
  - Ensured correct mocking and isolation for RAG operations under testing.

---

## Verification Results

### Automated Tests
Successfully ran the backend pytest suite:
```powershell
uv run pytest --tb=short
```

**Output:**
```
============================= test session starts =============================
platform win32 -- Python 3.12.4, pytest-9.0.3, pluggy-1.6.0
rootdir: C:\Users\Mariam Hagag\Desktop\Riam\backend
configfile: pyproject.toml
testpaths: tests
plugins: anyio-4.13.0, langsmith-0.8.5, asyncio-1.3.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 11 items

tests\test_analytics.py ...                                              [ 27%]
tests\test_embeddings.py ..                                              [ 45%]
tests\test_multi_tenancy.py ..                                           [ 63%]
tests\test_pdf_upload.py ....                                            [100%]

============================= 11 passed in 52.79s =============================
```
