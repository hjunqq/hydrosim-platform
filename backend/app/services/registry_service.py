from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.registry import Registry
from app.schemas.registry import RegistryCreate, RegistryUpdate

class RegistryService:
    def get_all(self, db: Session, skip: int = 0, limit: int = 100) -> List[Registry]:
        return db.query(Registry).offset(skip).limit(limit).all()

    def get(self, db: Session, registry_id: int) -> Optional[Registry]:
        return db.query(Registry).filter(Registry.id == registry_id).first()

    def create(self, db: Session, obj_in: RegistryCreate) -> Registry:
        db_obj = Registry(
            name=obj_in.name,
            url=obj_in.url,
            username=obj_in.username,
            password=obj_in.password,  # NOTE: In real prod, encrypt this!
            is_active=obj_in.is_active
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: Registry, obj_in: RegistryUpdate) -> Registry:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, registry_id: int) -> Optional[Registry]:
        obj = db.query(Registry).get(registry_id)
        if obj:
            db.delete(obj)
            db.commit()
        return obj

    async def test_connection(self, url: str, username: Optional[str] = None, password: Optional[str] = None) -> bool:
        # Simple mock interaction or real http check
        # For now, just checking if URL is reachable via basic HTTP if needed, 
        # or assuming valid if logic passes.
        # In production, use docker sdk or http client to key v2 endpoint
        import httpx
        try:
            auth = None
            if username and password:
                auth = (username, password)
            
            async with httpx.AsyncClient(verify=False, timeout=5.0) as client:
                resp = await client.get(f"{url}/v2/", auth=auth)
                if resp.status_code in [200, 401]:
                    return True
                return False
        except Exception:
            return False

    async def get_catalog(self, url: str, username: Optional[str] = None, password: Optional[str] = None) -> List[str]:
        import httpx
        try:
            auth = None
            if username and password:
                auth = (username, password)
                
            async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
                resp = await client.get(f"{url}/v2/_catalog", auth=auth)
                if resp.status_code == 200:
                    return resp.json().get("repositories", [])
                return []
        except Exception as e:
            print(f"Catalog error: {e}")
            return []

    async def get_tags(self, url: str, repo_name: str, username: Optional[str] = None, password: Optional[str] = None) -> List[str]:
        import httpx
        try:
            auth = None
            if username and password:
                auth = (username, password)
                
            async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
                resp = await client.get(f"{url}/v2/{repo_name}/tags/list", auth=auth)
                if resp.status_code == 200:
                    return resp.json().get("tags", [])
                return []
        except Exception as e:
            print(f"Tags error: {e}")
            return []

    async def delete_tag(self, url: str, repo_name: str, tag: str, username: Optional[str] = None, password: Optional[str] = None) -> bool:
        import httpx
        try:
            auth = None
            if username and password:
                auth = (username, password)
            
            async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
                # 1. Get Digest
                # essential to accept all manifest types to get the correct digest for the tag
                headers = {
                    "Accept": "application/vnd.docker.distribution.manifest.v2+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.oci.image.index.v1+json"
                }
                head_resp = await client.head(f"{url}/v2/{repo_name}/manifests/{tag}", auth=auth, headers=headers)
                
                if head_resp.status_code != 200:
                    # Try GET if HEAD fails (some registries are picky)
                    head_resp = await client.get(f"{url}/v2/{repo_name}/manifests/{tag}", auth=auth, headers=headers)
                    if head_resp.status_code != 200:
                        raise Exception("Manifest not found")

                digest = head_resp.headers.get("Docker-Content-Digest")
                if not digest:
                    raise Exception("No digest header found")

                # 2. Delete by Digest
                del_resp = await client.delete(f"{url}/v2/{repo_name}/manifests/{digest}", auth=auth)
                
                if del_resp.status_code == 202:
                    return True
                elif del_resp.status_code == 405:
                    raise Exception("Registry configuration does not permit deletion (405 Method Not Allowed).")
                else:
                    raise Exception(f"Delete failed: status {del_resp.status_code}")
                    
        except Exception as e:
            print(f"Delete tag error: {e}")
            raise e

registry_service = RegistryService()
