"""
FastAPI application main entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.api import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Hydrosim graduation deployment platform - teacher portal API",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.on_event("startup")
def sync_student_ingress_tls_on_startup() -> None:
    from app.services.ingress_sync import sync_student_ingress_tls

    sync_student_ingress_tls()


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": settings.VERSION}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
