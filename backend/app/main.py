"""
FastAPI application entrypoint for Riam.
Configures CORS, lifespan events, exception handlers, and mounts domain routers.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.api.v1.api import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Asynchronous lifespan manager for the FastAPI application.
    Executes startup and shutdown tasks safely.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Starting {settings.PROJECT_NAME} in environment: {settings.ENV}...")
    
    # Pre-load HF model on startup
    if settings.EMBEDDING_PROVIDER == "huggingface":
        logger.info("Pre-loading HuggingFace embeddings model...")
        from app.services.llm_factory import get_embeddings
        get_embeddings()  # This caches it
        logger.info("HuggingFace model loaded and cached!")
        
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
    description="Production-grade AI Customer Support Agent Builder backend API.",
    version="1.0.0"
)

# CORS middleware configuration
# Supports frontend dashboard and floating external website widgets
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin).strip("/") for origin in settings.BACKEND_CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    """
    Global exception handler capturing unhandled errors to avoid exposing stacktraces.
    """
    print(f"Unhandled server error: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please contact support."}
    )


@app.get("/health", tags=["Health Check"], status_code=status.HTTP_200_OK)
async def health_check():
    """
    API Health check endpoint to audit server status.
    """
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "environment": settings.ENV,
        "api_version": "1.0.0"
    }


# Mount API V1 Unified Router
app.include_router(api_router, prefix=settings.API_V1_STR)
