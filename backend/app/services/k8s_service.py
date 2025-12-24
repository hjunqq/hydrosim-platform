import logging
import os
from kubernetes import client, config
from app.core.config import settings

logger = logging.getLogger(__name__)

class K8sService:
    def __init__(self):
        self.load_config()
        self.apps_v1 = client.AppsV1Api()
        self.core_v1 = client.CoreV1Api()
        self.networking_v1 = client.NetworkingV1Api()

    def load_config(self):
        try:
            if settings.K8S_IN_CLUSTER:
                config.load_incluster_config()
                logger.info("Loaded in-cluster Kubernetes config")
            else:
                config.load_kube_config(config_file=settings.K8S_CONFIG_PATH)
                logger.info(f"Loaded local Kubernetes config from {settings.K8S_CONFIG_PATH}")
        except Exception as e:
            logger.error(f"Failed to load Kubernetes config: {e}")
            raise e

    def create_deployment(self, student_code: str, image_tag: str):
        deployment_name = f"{student_code}-app"
        namespace = settings.K8S_NAMESPACE
        
        # Define the deployment
        deployment = client.V1Deployment(
            api_version="apps/v1",
            kind="Deployment",
            metadata=client.V1ObjectMeta(name=deployment_name, labels={"app": deployment_name, "student": student_code}),
            spec=client.V1DeploymentSpec(
                replicas=1,
                selector=client.V1LabelSelector(match_labels={"app": deployment_name}),
                template=client.V1PodTemplateSpec(
                    metadata=client.V1ObjectMeta(labels={"app": deployment_name}),
                    spec=client.V1PodSpec(
                        containers=[
                            client.V1Container(
                                name="main",
                                image=image_tag,
                                ports=[client.V1ContainerPort(container_port=80)],
                                image_pull_policy="Always" # Or IfNotPresent
                            )
                        ]
                    )
                )
            )
        )

        try:
            # Check if exists
            existing = self.apps_v1.list_namespaced_deployment(namespace, field_selector=f"metadata.name={deployment_name}")
            if existing.items:
                logger.info(f"Updating existing deployment {deployment_name}")
                return self.apps_v1.patch_namespaced_deployment(deployment_name, namespace, deployment)
            else:
                logger.info(f"Creating new deployment {deployment_name}")
                return self.apps_v1.create_namespaced_deployment(namespace, deployment)
        except Exception as e:
            logger.error(f"Failed to create/update deployment: {e}")
            raise e

    def create_service(self, student_code: str):
        service_name = f"{student_code}-svc"
        deployment_name = f"{student_code}-app"
        namespace = settings.K8S_NAMESPACE

        service = client.V1Service(
            api_version="v1",
            kind="Service",
            metadata=client.V1ObjectMeta(name=service_name, labels={"app": deployment_name, "student": student_code}),
            spec=client.V1ServiceSpec(
                selector={"app": deployment_name},
                ports=[client.V1ServicePort(port=80, target_port=80, protocol="TCP")],
                type="ClusterIP"
            )
        )

        try:
             # Check if exists
            existing = self.core_v1.list_namespaced_service(namespace, field_selector=f"metadata.name={service_name}")
            if existing.items:
                 logger.info(f"Service {service_name} already exists")
                 # We generally don't need to update service often unless ports change
                 return existing.items[0]
            else:
                return self.core_v1.create_namespaced_service(namespace, service)
        except Exception as e:
            logger.error(f"Failed to create service: {e}")
            raise e

    def create_ingress(self, student_code: str, domain: str):
        # TODO: Implement Ingress creation based on Hydrosim requirements (Traefik/Nginx)
        pass

k8s_service = K8sService()
