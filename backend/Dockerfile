FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Inject uv package manager
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set working directory
WORKDIR /app

# Copy dependency files first (layer cache optimization)
COPY pyproject.toml uv.lock ./

# Install Python dependencies (production only, no dev extras)
RUN uv sync --frozen --no-cache --no-dev

# Copy project source
COPY . .

# Render assigns PORT dynamically — don't hardcode it
# EXPOSE is informational only, actual port comes from $PORT env var
EXPOSE 10000

# Healthcheck uses the dynamic port
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-10000}/health || exit 1

# Use sh -c so $PORT env var is resolved at runtime
# --timeout-keep-alive 75 is Render's recommended value
CMD ["sh", "-c", "uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000} --timeout-keep-alive 75"]
