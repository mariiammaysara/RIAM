FROM python:3.12-slim

# Install compilation tools needed for some Python packages (e.g. psycopg2, cryptography)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Inject the ultra-fast Astral uv package manager
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set working directory
WORKDIR /app

# Copy dependency files first (enables Docker layer caching)
COPY pyproject.toml uv.lock ./

# Install Python dependencies (locked, no-cache for lean image)
RUN uv sync --frozen --no-cache --no-dev

# Copy project source
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Health check so orchestrators know when the container is ready
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the server
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
