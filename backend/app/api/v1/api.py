"""
V1 Unified API Router.
Gathers and mounts individual domain sub-routers (agents, knowledge, conversations).
"""
from fastapi import APIRouter

from app.api.v1.agents import router as agents_router
from app.api.v1.knowledge import router as knowledge_router
from app.api.v1.conversations import router as conversations_router
from app.api.v1.analytics import router as analytics_router

api_router = APIRouter()

# Mount sub-routers with clean path prefixes
api_router.include_router(agents_router)
api_router.include_router(knowledge_router)
api_router.include_router(conversations_router)
api_router.include_router(analytics_router)
