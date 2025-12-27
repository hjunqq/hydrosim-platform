"""
API v1 router aggregation
"""
from fastapi import APIRouter

from app.api.v1.endpoints import auth, projects, students, deployments, workflows, deploy_controller

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
api_router.include_router(students.router, prefix="/students", tags=["Students"])
api_router.include_router(deployments.router, prefix="/deployments", tags=["Deployments"])
api_router.include_router(deploy_controller.router, prefix="/deploy", tags=["Ops"])
api_router.include_router(workflows.router, prefix="/workflows", tags=["CI/CD Workflows"])
