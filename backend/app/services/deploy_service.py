import logging
from datetime import datetime
from typing import Optional, Dict

from kubernetes.client.rest import ApiException

from app import models
from app.core.k8s_resources import generate_resources
from app.core.config import settings as app_settings
from app.core.naming import student_resource_name
from app.models.deployment import DeploymentStatus
from app.services.system_settings import get_or_create_settings, get_student_domain_parts

logger = logging.getLogger(__name__)

NAMESPACE_MAP = {
    "gd": "students-gd",
    "cd": "students-cd",
}


def deploy_student_resources(
    db,
    student: models.Student,
    image: str,
    project_type: str,
    apps_v1,
    core_v1,
    networking_v1,
    build_id: Optional[int] = None,
) -> Dict[str, str]:
    if project_type not in NAMESPACE_MAP:
        raise ValueError(f"Invalid project_type. Must be one of {list(NAMESPACE_MAP.keys())}")

    if getattr(student.project_type, "value", student.project_type) != project_type:
        raise ValueError("Project type mismatch")

    if not apps_v1 or not core_v1 or not networking_v1:
        raise RuntimeError("Kubernetes clients are not available")

    namespace = NAMESPACE_MAP[project_type]
    deployment_name = student_resource_name(student.student_code)

    settings = get_or_create_settings(db)
    host_prefix, domain_suffix, full_domain = get_student_domain_parts(
        settings, student.student_code, project_type
    )

    deployment_record = models.Deployment(
        student_id=student.id,
        image_tag=image,
        status=DeploymentStatus.deploying,
        message="Deployment requested",
        last_deploy_time=datetime.utcnow(),
        build_id=build_id,
    )
    db.add(deployment_record)
    db.commit()
    db.refresh(deployment_record)

    logger.info(f"Starting deployment for {student.student_code} in {namespace}, image={image}")

    try:
        resources = generate_resources(
            student_code=student.student_code,
            image=image,
            namespace=namespace,
            domain_suffix=domain_suffix,
            host_prefix=host_prefix,
            pvc_enabled=app_settings.STUDENT_PVC_ENABLED,
            pvc_size=app_settings.STUDENT_PVC_SIZE,
            pvc_storage_class=app_settings.STUDENT_PVC_STORAGE_CLASS,
            pvc_mount_path=app_settings.STUDENT_PVC_MOUNT_PATH,
            tls_secret_name=app_settings.STUDENT_TLS_SECRET_NAME,
        )
        exists = False
        try:
            apps_v1.read_namespaced_deployment(name=deployment_name, namespace=namespace)
            exists = True
        except ApiException as e:
            if e.status != 404:
                raise
        pvc = resources.get("pvc")
        if pvc is not None:
            try:
                core_v1.create_namespaced_persistent_volume_claim(
                    namespace=namespace,
                    body=pvc,
                )
            except ApiException as e:
                if e.status != 409:
                    raise

        if exists:
            patch_body = {
                "spec": {
                    "template": resources["deployment"].spec.template
                }
            }
            apps_v1.patch_namespaced_deployment(
                name=deployment_name,
                namespace=namespace,
                body=patch_body,
            )
            result_status = "updated"
        else:
            apps_v1.create_namespaced_deployment(
                namespace=namespace,
                body=resources["deployment"],
            )
            try:
                core_v1.create_namespaced_service(
                    namespace=namespace,
                    body=resources["service"],
                )
            except ApiException as e:
                if e.status != 409:
                    raise
            result_status = "created"

        # Ensure ingress is updated with latest TLS/annotations
        try:
            networking_v1.read_namespaced_ingress(name=deployment_name, namespace=namespace)
            ingress_patch = {
                "metadata": {
                    "annotations": resources["ingress"].metadata.annotations
                },
                "spec": resources["ingress"].spec,
            }
            networking_v1.patch_namespaced_ingress(
                name=deployment_name,
                namespace=namespace,
                body=ingress_patch,
            )
        except ApiException as e:
            if e.status == 404:
                networking_v1.create_namespaced_ingress(
                    namespace=namespace,
                    body=resources["ingress"],
                )
            else:
                raise

        deployment_record.status = DeploymentStatus.running
        deployment_record.message = f"Project {deployment_name} successfully {result_status}"
        deployment_record.last_deploy_time = datetime.utcnow()

        if student.domain != full_domain:
            student.domain = full_domain

        db.commit()
        return {
            "status": result_status,
            "message": f"Project {deployment_name} successfully {result_status}",
            "url": f"http://{full_domain}",
        }
    except ApiException as e:
        logger.error(f"K8s API failed: {e}")
        deployment_record.status = DeploymentStatus.failed
        deployment_record.message = f"Kubernetes Operation Failed: {e.reason}"
        deployment_record.last_deploy_time = datetime.utcnow()
        db.commit()
        raise
    except Exception as e:
        deployment_record.status = DeploymentStatus.failed
        deployment_record.message = str(e)
        deployment_record.last_deploy_time = datetime.utcnow()
        db.commit()
        raise
