import sys
import os
import logging
import time
from kubernetes import client, config
from sqlalchemy.orm import Session

# Add current dir to path
sys.path.append(os.getcwd())
# Add current dir to path
sys.path.append(os.getcwd())
os.environ["MINIO_ENDPOINT"] = "" # Disable MinIO for local verification
os.environ["K8S_CONFIG_PATH"] = os.path.expanduser("~/.kube/config")

from app.db.session import SessionLocal
from app.api import deps
from app.models.student import Student, ProjectType
from app.models.build_config import BuildConfig
from app.models.build import Build
from app.services.build_orchestrator import build_orchestrator
# from app.core import crypto # Removed

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_dummy_secrets():
    try:
        config.load_kube_config()
        v1 = client.CoreV1Api()
        namespace = "gitea-runner" # Force using the namespace where we saw jobs, or settings.K8S_NAMESPACE if confident
        # Actually proper way:
        from app.core.config import settings
        namespace = settings.K8S_NAMESPACE or "gitea-runner"
        logger.info(f"Target Namespace: {namespace}")
        
        # Git Secret
        try:
            v1.read_namespaced_secret("portal-git-credentials", namespace)
            logger.info("Secret portal-git-credentials exists.")
        except:
            logger.info("Creating dummy portal-git-credentials...")
            sec = client.V1Secret(
                metadata=client.V1ObjectMeta(name="portal-git-credentials"),
                string_data={"id_rsa": "DUMMY_KEY"}
            )
            v1.create_namespaced_secret(namespace, sec)

        # Registry Secret
        try:
            v1.read_namespaced_secret("kaniko-registry-auth", namespace)
            logger.info("Secret kaniko-registry-auth exists.")
        except:
            logger.info("Creating dummy kaniko-registry-auth...")
            sec = client.V1Secret(
                metadata=client.V1ObjectMeta(name="kaniko-registry-auth"),
                string_data={".dockerconfigjson": "{\"auths\":{}}"}
            )
            v1.create_namespaced_secret(namespace, sec)
            
    except Exception as e:
        logger.error(f"Failed to manage K8s secrets: {e}")

def verify_build_flow():
    db = SessionLocal()
    from app.core.config import settings
    namespace = settings.K8S_NAMESPACE or "gitea-runner"
    
    try:
        # 1. Create Dummy Student and Config
        student_code = "TEST_KANIKO_001"
        student = db.query(Student).filter(Student.student_code == student_code).first()
        if not student:
            student = Student(
                student_code=student_code,
                name="Kaniko Tester",
                project_type=ProjectType.gd,
                password_hash="dummy"
            )
            db.add(student)
            db.commit()
            db.refresh(student)
            logger.info(f"Created student {student.id}")
        
        build_config = db.query(BuildConfig).filter(BuildConfig.student_id == student.id).first()
        if not build_config:
            build_config = BuildConfig(
                student_id=student.id,
                repo_url="https://github.com/example/repo.git",
                branch="main",
                image_repo="registry.example.com/test/image"
            )
            db.add(build_config)
            db.commit()
            logger.info("Created build config")
            
        # 2. Trigger Build
        logger.info("Triggering build...")
        build = build_orchestrator.trigger_build(db, student.id, branch="main")
        logger.info(f"Build triggered: ID={build.id}, Status={build.status}")
        
        # 3. Verify K8s Job
        time.sleep(2)
        batch_v1 = client.BatchV1Api()
        jobs = batch_v1.list_namespaced_job(namespace, label_selector="app=kaniko-build")
        
        found = False
        for job in jobs.items:
            if job.metadata.name.startswith(f"build-{build.id}-"):
                logger.info(f"SUCCESS: Found K8s Job {job.metadata.name}")
                found = True
                break
        
        if not found:
            logger.error("FAILURE: K8s Job not found!")
        else:
            logger.info("Verification Passed: Build System is creating Jobs.")

    except Exception as e:
        logger.error(f"Verification Failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_dummy_secrets()
    verify_build_flow()
