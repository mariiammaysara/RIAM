FROM python:3.11-slim

# Install compilation tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Injects the ultra-fast Astral uv package manager binaries
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Configure workspace
WORKDIR /app

# Ingest and lock dependencies
COPY pyproject.toml uv.lock ./

# Install python requirements in container using uv sync
RUN uv sync --frozen --no-cache

# Import project files
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Execute server using uvicorn inside the uv environment
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
