import base64
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

from kubernetes import client, config
from kubernetes.client.rest import ApiException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.k8s_build_job import (
    create_kaniko_job_manifest,
    create_git_clone_script,
    extract_git_host_and_port,
)
from app.models.build import Build, BuildStatus
from app.models.build_config import BuildConfig
from app.models.deployment import Deployment
from app.models.registry import Registry
from app.models.student import Student
from app.services.build_logs import build_log_service
from app.services.deploy_service import deploy_student_resources
from app.services.system_settings import get_or_create_settings

logger = logging.getLogger(__name__)

batch_v1 = None
core_v1 = None
apps_v1 = None
networking_v1 = None


def _init_k8s_clients() -> bool:
    global batch_v1, core_v1, apps_v1, networking_v1
    if batch_v1 and core_v1 and apps_v1 and networking_v1:
        return True

    try:
        if settings.K8S_IN_CLUSTER:
            config.load_incluster_config()
        else:
            config_path = os.path.expanduser(settings.K8S_CONFIG_PATH)
            if os.path.exists(config_path):
                config.load_kube_config(config_file=config_path)
            else:
                config.load_kube_config()
        batch_v1 = client.BatchV1Api()
        core_v1 = client.CoreV1Api()
        apps_v1 = client.AppsV1Api()
        networking_v1 = client.NetworkingV1Api()
        return True
    except Exception as e:
        logger.error(f"Failed to load K8s config: {e}")
        batch_v1 = None
        core_v1 = None
        apps_v1 = None
        networking_v1 = None
        return False


def _normalize_registry_host(url: str) -> str:
    if not url:
        return ""
    url = url.strip()
    if "://" in url:
        parsed = urlparse(url)
        host = parsed.netloc or parsed.path
        return host.rstrip("/")
    return url.rstrip("/")


def _safe_int(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _resolve_registry(db: Session, build_config: BuildConfig, sys_settings) -> Optional[Registry]:
    registry_id = build_config.registry_id or sys_settings.default_registry_id
    registry_int = _safe_int(registry_id)
    if registry_int is None:
        return None
    return db.query(Registry).filter(Registry.id == registry_int).first()


def _render_image_repo(template: str, registry: Optional[Registry], student: Student) -> Optional[str]:
    if not template:
        return None
    result = template
    if "{{registry}}" in result:
        if not registry or not registry.url:
            return None
        result = result.replace("{{registry}}", _normalize_registry_host(registry.url))
    result = result.replace("{{student_code}}", student.student_code)
    return result


def _resolve_image_tag(build_config: BuildConfig, commit_sha: str, branch: str) -> str:
    strategy = (build_config.tag_strategy or "short_sha").strip()
    if strategy == "branch_latest" and branch:
        return f"{branch}-latest"
    if commit_sha and commit_sha != "latest":
        return commit_sha[:7]
    return f"manual-{uuid.uuid4().hex[:6]}"


def _rewrite_git_host(
    git_url: str,
    internal_host: Optional[str],
    internal_port: Optional[int],
    external_host: Optional[str],
) -> str:
    if not git_url or not internal_host or not external_host:
        return git_url
    if git_url.startswith("git@"):
        _, rest = git_url.split("@", 1)
        host, path = rest.split(":", 1) if ":" in rest else (rest, "")
        if host == external_host and path:
            port = internal_port or 22
            return f"ssh://git@{internal_host}:{port}/{path}"
        return git_url
    if git_url.startswith("ssh://"):
        parsed = urlparse(git_url)
        if parsed.hostname == external_host:
            user = parsed.username or "git"
            port = internal_port or parsed.port or 22
            path = (parsed.path or "").lstrip("/")
            return f"ssh://{user}@{internal_host}:{port}/{path}"
        return git_url
    return git_url


def _ensure_git_secret(namespace: str, secret_name: str, private_key: str) -> None:
    if not _init_k8s_clients():
        raise RuntimeError("Kubernetes client unavailable")
    secret = client.V1Secret(
        metadata=client.V1ObjectMeta(name=secret_name, namespace=namespace),
        type="Opaque",
        string_data={"id_rsa": private_key},
    )
    try:
        core_v1.read_namespaced_secret(secret_name, namespace)
        core_v1.replace_namespaced_secret(secret_name, namespace, secret)
    except ApiException as e:
        if e.status == 404:
            core_v1.create_namespaced_secret(namespace, secret)
        else:
            raise


def _ensure_registry_secret(namespace: str, secret_name: str, registry: Registry) -> None:
    if not _init_k8s_clients():
        raise RuntimeError("Kubernetes client unavailable")
    if not registry.username or not registry.password:
        raise ValueError("Registry credentials are incomplete")

    registry_host = _normalize_registry_host(registry.url)
    auth = base64.b64encode(f"{registry.username}:{registry.password}".encode("utf-8")).decode("utf-8")
    config_json = {
        "auths": {
            registry_host: {
                "username": registry.username,
                "password": registry.password,
                "auth": auth,
            }
        }
    }
    secret = client.V1Secret(
        metadata=client.V1ObjectMeta(name=secret_name, namespace=namespace),
        type="kubernetes.io/dockerconfigjson",
        string_data={".dockerconfigjson": json.dumps(config_json)},
    )
    try:
        core_v1.read_namespaced_secret(secret_name, namespace)
        core_v1.replace_namespaced_secret(secret_name, namespace, secret)
    except ApiException as e:
        if e.status == 404:
            core_v1.create_namespaced_secret(namespace, secret)
        else:
            raise


class BuildOrchestrator:
    def trigger_build(
        self,
        db: Session,
        student_id: int,
        commit_sha: str = "latest",
        branch: Optional[str] = None,
    ) -> Build:
        build_config = db.query(BuildConfig).filter(BuildConfig.student_id == student_id).first()
        if not build_config:
            raise ValueError("Build config not found for student")
        if not build_config.repo_url:
            raise ValueError("repo_url is required for builds")

        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            raise ValueError("Student not found")

        if not branch:
            branch = build_config.branch

        sys_settings = get_or_create_settings(db)
        registry = _resolve_registry(db, build_config, sys_settings)

        image_repo = build_config.image_repo or _render_image_repo(
            sys_settings.default_image_repo_template,
            registry,
            student,
        )
        if not image_repo:
            raise ValueError("Image repository is not configured")

        image_tag = _resolve_image_tag(build_config, commit_sha, branch)
        final_image = f"{image_repo}:{image_tag}"

        build = Build(
            student_id=student_id,
            commit_sha=commit_sha,
            branch=branch,
            image_tag=image_tag,
            status=BuildStatus.pending,
            message="Initializing...",
        )
        db.add(build)
        db.commit()
        db.refresh(build)

        try:
            job_name = self._create_k8s_job(build, build_config, final_image, sys_settings, registry)
            build.status = BuildStatus.running
            build.job_name = job_name
            build.started_at = datetime.now(timezone.utc)
            build.message = "Job submitted"
            db.commit()
        except Exception as e:
            logger.error(f"Failed to create build job: {e}")
            build.status = BuildStatus.failed
            build.message = str(e)
            db.commit()

        return build

    def _create_k8s_job(
        self,
        build: Build,
        build_config: BuildConfig,
        final_image: str,
        sys_settings,
        registry: Optional[Registry],
    ) -> str:
        if not _init_k8s_clients():
            raise RuntimeError("Kubernetes client unavailable")

        job_name = f"build-{build.id}-{uuid.uuid4().hex[:6]}"
        namespace = sys_settings.build_namespace or settings.K8S_NAMESPACE
        git_repo_url = build_config.repo_url
        use_ssh = git_repo_url.startswith("git@") or git_repo_url.startswith("ssh://")
        external_host = urlparse(settings.GITEA_URL).hostname if settings.GITEA_URL else None
        clone_repo_url = _rewrite_git_host(
            git_repo_url,
            settings.GITEA_SSH_INTERNAL_HOST,
            settings.GITEA_SSH_INTERNAL_PORT,
            external_host,
        ) if use_ssh else git_repo_url
        git_host, git_port = extract_git_host_and_port(clone_repo_url)

        git_secret_name = None
        if use_ssh:
            if not build_config.deploy_key_private:
                raise ValueError("Deploy key is required for SSH clones")
            git_secret_name = f"student-deploy-key-{build.student_id}"
            _ensure_git_secret(namespace, git_secret_name, build_config.deploy_key_private)

        registry_secret_name = "kaniko-registry-auth"
        if registry:
            registry_secret_name = f"kaniko-registry-auth-{registry.id}"
            _ensure_registry_secret(namespace, registry_secret_name, registry)

        clone_script = create_git_clone_script(
            git_url=clone_repo_url,
            commit_sha=build.commit_sha,
            branch=build.branch,
            repo_dir="/workspace/repo",
            git_host=git_host if use_ssh else None,
            git_port=git_port if use_ssh else None,
        )

        manifest = create_kaniko_job_manifest(
            job_name=job_name,
            namespace=namespace,
            git_repo_url=clone_repo_url,
            image_destination=final_image,
            context_path=build_config.context_path,
            dockerfile_path=build_config.dockerfile_path,
            git_secret_name=git_secret_name,
            registry_secret_name=registry_secret_name,
            repo_dir="/workspace/repo",
            git_clone_script=clone_script,
            labels={
                "build-id": str(build.id),
                "student-id": str(build.student_id),
            },
        )

        batch_v1.create_namespaced_job(namespace, manifest)
        return job_name

    def sync_build_status(self, db: Session, build: Build) -> Build:
        if build.status in {BuildStatus.success, BuildStatus.failed, BuildStatus.error}:
            return build
        if not build.job_name:
            return build
        if not _init_k8s_clients():
            return build

        sys_settings = get_or_create_settings(db)
        namespace = sys_settings.build_namespace or settings.K8S_NAMESPACE

        try:
            job = batch_v1.read_namespaced_job_status(build.job_name, namespace)
        except ApiException as e:
            if e.status == 404:
                build.status = BuildStatus.error
                build.message = "Build job not found"
                db.commit()
                return build
            raise

        job_status = job.status
        updated = False
        finished = False
        message = None

        if job_status.succeeded:
            build.status = BuildStatus.success
            message = "Build succeeded"
            finished = True
            updated = True
        elif job_status.failed:
            build.status = BuildStatus.failed
            message = "Build failed"
            finished = True
            updated = True
        elif job_status.active:
            if build.status != BuildStatus.running:
                build.status = BuildStatus.running
                message = "Build running"
                updated = True

        if finished:
            build.finished_at = datetime.now(timezone.utc)
            if build.started_at:
                start = build.started_at
                if start.tzinfo is None:
                    start = start.replace(tzinfo=timezone.utc)
                end = build.finished_at
                if end.tzinfo is None:
                    end = end.replace(tzinfo=timezone.utc)
                build.duration = int((end - start).total_seconds())
            if message:
                build.message = message
            self._archive_job_logs(db, build, namespace)
            self._auto_deploy_if_needed(db, build)
        elif message:
            build.message = message

        if updated:
            db.commit()
            db.refresh(build)
        return build

    def _archive_job_logs(self, db: Session, build: Build, namespace: str) -> None:
        if build.log_object_key:
            return
        log_content = self._collect_job_logs(namespace, build.job_name)
        if not log_content:
            return
        object_key = f"builds/{build.id}/{build.job_name}.log"
        if build_log_service.upload_log(object_key, log_content):
            build.log_object_key = object_key
            db.commit()

    def _collect_job_logs(self, namespace: str, job_name: str) -> Optional[str]:
        if not _init_k8s_clients():
            return None
        try:
            pods = core_v1.list_namespaced_pod(namespace, label_selector=f"job-name={job_name}")
        except Exception as e:
            logger.warning(f"Failed to list pods for job {job_name}: {e}")
            return None
        if not pods.items:
            return None

        pod = pods.items[0]
        lines = []
        for container_name in ["git-clone", "kaniko"]:
            try:
                log_text = core_v1.read_namespaced_pod_log(
                    name=pod.metadata.name,
                    namespace=namespace,
                    container=container_name,
                    timestamps=True,
                )
                if log_text:
                    lines.append(f"--- {container_name} ---")
                    lines.append(log_text)
            except Exception:
                continue
        return "\n".join(lines).strip() or None

    def _auto_deploy_if_needed(self, db: Session, build: Build) -> None:
        if build.status != BuildStatus.success:
            return
        if not _init_k8s_clients():
            return
        build_config = db.query(BuildConfig).filter(BuildConfig.student_id == build.student_id).first()
        if not build_config or not build_config.auto_deploy:
            return
        existing = db.query(Deployment).filter(Deployment.build_id == build.id).first()
        if existing:
            return

        student = db.query(Student).filter(Student.id == build.student_id).first()
        if not student:
            return

        sys_settings = get_or_create_settings(db)
        image_repo = build_config.image_repo
        if not image_repo:
            registry = _resolve_registry(db, build_config, sys_settings)
            image_repo = _render_image_repo(sys_settings.default_image_repo_template, registry, student)
        if not image_repo:
            return
        image = f"{image_repo}:{build.image_tag}"

        project_type_value = getattr(student.project_type, "value", student.project_type)
        build_id = build.id
        try:
            deploy_student_resources(
                db=db,
                student=student,
                image=image,
                project_type=project_type_value,
                build_id=build_id,
                apps_v1=apps_v1,
                core_v1=core_v1,
                networking_v1=networking_v1,
            )
        except Exception as e:
            db.rollback()
            logger.warning("Auto deploy failed for build %s: %s", build_id, e)


build_orchestrator = BuildOrchestrator()
