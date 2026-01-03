"""
API v1 router aggregation
"""
from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth, projects, students, deployments, workflows, deploy_controller,
    admin_projects, registries, monitoring, admin_settings, profile,
    webhooks, builds, build_configs
)


api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(profile.router, prefix="/profile", tags=["Profile"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
api_router.include_router(students.router, prefix="/students", tags=["Students"])
api_router.include_router(deployments.router, prefix="/deployments", tags=["Deployments"])
api_router.include_router(deploy_controller.router, prefix="/deploy", tags=["Ops"])
api_router.include_router(workflows.router, prefix="/workflows", tags=["CI/CD Workflows"])

# Admin Routes
api_router.include_router(admin_projects.router, prefix="/admin", tags=["Admin Projects"])
api_router.include_router(registries.router, prefix="/admin/registries", tags=["Admin Registries"])
api_router.include_router(monitoring.router, prefix="/admin/monitoring", tags=["Admin Monitoring"])
api_router.include_router(admin_settings.router, prefix="/admin", tags=["Admin Settings"])

# Build Orchestration
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["Webhooks"])
api_router.include_router(builds.router, prefix="/builds", tags=["Builds"])
api_router.include_router(build_configs.router, prefix="/build-configs", tags=["Build Configs"])
