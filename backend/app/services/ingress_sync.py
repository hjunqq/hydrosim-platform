import logging
import os
from typing import Dict, Iterable, List, Optional

from kubernetes import client, config
from kubernetes.client.rest import ApiException

from app.core.config import settings

logger = logging.getLogger("ingress-sync")

STUDENT_NAMESPACES = ["students-gd", "students-cd"]


def _load_k8s_config() -> bool:
    if settings.K8S_IN_CLUSTER:
        try:
            config.load_incluster_config()
            logger.info("Loaded in-cluster kubeconfig")
            return True
        except config.ConfigException as exc:
            logger.warning("In-cluster kubeconfig not available: %s", exc)

    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(current_dir, "../.."))
    local_config_path = os.path.join(project_root, ".kube", "config")

    try:
        if os.path.exists(local_config_path):
            config.load_kube_config(config_file=local_config_path)
            logger.info("Loaded project kubeconfig: %s", local_config_path)
            return True

        config_path = os.path.expanduser(settings.K8S_CONFIG_PATH) if settings.K8S_CONFIG_PATH else ""
        if config_path and os.path.exists(config_path):
            config.load_kube_config(config_file=config_path)
            logger.info("Loaded kubeconfig: %s", config_path)
            return True

        config.load_kube_config()
        logger.info("Loaded default kubeconfig")
        return True
    except Exception as exc:
        logger.error("Failed to load kubeconfig: %s", exc)
        return False


def _is_student_ingress(ingress: client.V1Ingress) -> bool:
    if not ingress or not ingress.metadata:
        return False
    labels = ingress.metadata.labels or {}
    if labels.get("managed-by") == "portal-controller":
        return True
    if "student" in labels:
        return True
    name = ingress.metadata.name or ""
    return name.startswith("student-")


def _collect_hosts(ingress: client.V1Ingress) -> List[str]:
    hosts: List[str] = []
    rules = ingress.spec.rules if ingress and ingress.spec else None
    if not rules:
        return hosts
    for rule in rules:
        if rule and rule.host:
            if rule.host not in hosts:
                hosts.append(rule.host)
    return hosts


def _needs_tls_patch(
    ingress: client.V1Ingress,
    secret_name: str,
    hosts: List[str],
    entrypoints: str,
    ingress_class: str,
) -> bool:
    annotations = ingress.metadata.annotations or {}
    if annotations.get("traefik.ingress.kubernetes.io/router.entrypoints") != entrypoints:
        return True
    if annotations.get("traefik.ingress.kubernetes.io/router.tls") != "true":
        return True
    if annotations.get("kubernetes.io/ingress.class") != ingress_class:
        return True
    if getattr(ingress.spec, "ingress_class_name", None) != ingress_class:
        return True

    existing_tls = ingress.spec.tls or []
    existing_hosts = set()
    existing_secrets = set()
    for tls in existing_tls:
        if tls.secret_name:
            existing_secrets.add(tls.secret_name)
        if tls.hosts:
            existing_hosts.update(tls.hosts)

    if secret_name not in existing_secrets:
        return True
    if hosts and not set(hosts).issubset(existing_hosts):
        return True
    return False


def sync_student_ingress_tls(namespaces: Optional[Iterable[str]] = None) -> Dict[str, int]:
    secret_name = settings.STUDENT_TLS_SECRET_NAME
    if not secret_name:
        logger.info("STUDENT_TLS_SECRET_NAME not configured, skip TLS sync")
        return {"patched": 0, "skipped": 0, "errors": 0}

    if not _load_k8s_config():
        logger.warning("Kubernetes config unavailable, skip TLS sync")
        return {"patched": 0, "skipped": 0, "errors": 0}

    networking_v1 = client.NetworkingV1Api()
    target_namespaces = list(namespaces) if namespaces else STUDENT_NAMESPACES
    result = {"patched": 0, "skipped": 0, "errors": 0}

    for namespace in target_namespaces:
        try:
            ingresses = networking_v1.list_namespaced_ingress(namespace=namespace)
        except ApiException as exc:
            logger.warning("Failed to list ingresses in %s: %s", namespace, exc)
            result["errors"] += 1
            continue

        for ingress in ingresses.items:
            if not _is_student_ingress(ingress):
                continue
            hosts = _collect_hosts(ingress)
            if not hosts:
                result["skipped"] += 1
                continue
            if not _needs_tls_patch(ingress, secret_name, hosts, "web,websecure", "traefik"):
                result["skipped"] += 1
                continue

            annotations = dict(ingress.metadata.annotations or {})
            annotations["kubernetes.io/ingress.class"] = "traefik"
            annotations["traefik.ingress.kubernetes.io/router.entrypoints"] = "web,websecure"
            annotations["traefik.ingress.kubernetes.io/router.tls"] = "true"
            tls = [client.V1IngressTLS(hosts=hosts, secret_name=secret_name)]
            patch_body = {
                "metadata": {"annotations": annotations},
                "spec": {"tls": tls, "ingressClassName": "traefik"},
            }
            try:
                networking_v1.patch_namespaced_ingress(
                    name=ingress.metadata.name,
                    namespace=namespace,
                    body=patch_body,
                )
                result["patched"] += 1
            except ApiException as exc:
                logger.warning(
                    "Failed to patch ingress %s/%s: %s",
                    namespace,
                    ingress.metadata.name,
                    exc,
                )
                result["errors"] += 1

    if result["patched"] or result["errors"]:
        logger.info("Student ingress TLS sync result: %s", result)
    return result
