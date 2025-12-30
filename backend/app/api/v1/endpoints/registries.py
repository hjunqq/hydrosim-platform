from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps, admin_deps
from app.schemas.registry import Registry, RegistryCreate, RegistryUpdate, RegistryTestRequest
from app.services.registry_service import registry_service

router = APIRouter()

@router.post("/test", response_model=bool)
async def test_registry_connection(
    payload: RegistryTestRequest,
    current_user = Depends(admin_deps.get_current_admin),
):
    result = await registry_service.test_connection(payload.url, payload.username, payload.password)
    return result

@router.get("/", response_model=List[Registry])
def read_registries(
    db: Session = Depends(deps.get_db),
    current_user = Depends(admin_deps.get_current_admin),
    skip: int = 0,
    limit: int = 100
):
    return registry_service.get_all(db, skip=skip, limit=limit)

@router.post("/", response_model=Registry)
def create_registry(
    registry_in: RegistryCreate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(admin_deps.get_current_admin),
):
    return registry_service.create(db, registry_in)

@router.put("/{registry_id}", response_model=Registry)
def update_registry(
    registry_id: int,
    registry_in: RegistryUpdate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(admin_deps.get_current_admin),
):
    registry = registry_service.get(db, registry_id)
    if not registry:
        raise HTTPException(status_code=404, detail="Registry not found")
    return registry_service.update(db, registry, registry_in)

@router.delete("/{registry_id}", response_model=Registry)
def delete_registry(
    registry_id: int,
    db: Session = Depends(deps.get_db),
    current_user = Depends(admin_deps.get_current_admin),
):
    registry = registry_service.get(db, registry_id)
    if not registry:
        raise HTTPException(status_code=404, detail="Registry not found")
    return registry_service.remove(db, registry_id)

@router.get("/{registry_id}/catalog", response_model=List[str])
async def get_registry_catalog(
    registry_id: int,
    db: Session = Depends(deps.get_db),
    current_user = Depends(admin_deps.get_current_admin),
):
    registry = registry_service.get(db, registry_id)
    if not registry:
        raise HTTPException(status_code=404, detail="Registry not found")
        
    return await registry_service.get_catalog(registry.url, registry.username, registry.password)

@router.get("/{registry_id}/tags", response_model=List[str])
async def get_registry_tags(
    registry_id: int,
    repository: str,
    db: Session = Depends(deps.get_db),
    current_user = Depends(admin_deps.get_current_admin),
):
    registry = registry_service.get(db, registry_id)
    if not registry:
        raise HTTPException(status_code=404, detail="Registry not found")
        
    return await registry_service.get_tags(registry.url, repository, registry.username, registry.password)

@router.delete("/{registry_id}/tags", response_model=bool)
async def delete_registry_tag(
    registry_id: int,
    repository: str,
    tag: str,
    db: Session = Depends(deps.get_db),
    current_user = Depends(admin_deps.get_current_admin),
):
    registry = registry_service.get(db, registry_id)
    if not registry:
        raise HTTPException(status_code=404, detail="Registry not found")
    
    try:
        return await registry_service.delete_tag(registry.url, repository, tag, registry.username, registry.password)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
