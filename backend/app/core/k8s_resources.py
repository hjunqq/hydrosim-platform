from kubernetes import client
from typing import Dict, List, Optional

from app.core.naming import student_dns_label, student_resource_name

class StudentProjectBuilder:
    """
    负责使用 Kubernetes Python Client 对象模型生成学生项目的资源对象。
    不使用 YAML，不使用 Jinja2，纯 Python 对象构造。
    """

    def __init__(
        self, 
        student_code: str, 
        image: str, 
        namespace: str, 
        domain_suffix: str,
        host_prefix: str = ""
    ):
        self.student_code = student_code
        self.student_dns_label = student_dns_label(student_code)
        self.image = image
        self.namespace = namespace
        self.domain_suffix = domain_suffix.lstrip(".") # 确保无前导点
        self.host_prefix = host_prefix or ""
        
        # 统一命名规范：student-{code}
        self.app_name = student_resource_name(student_code)
        self.labels = {
            "app": self.app_name,
            "student": student_code,
            "managed-by": "portal-controller"
        }

    def _get_common_metadata(self, name: str) -> client.V1ObjectMeta:
        return client.V1ObjectMeta(
            name=name,
            namespace=self.namespace,
            labels=self.labels
        )

    def build_deployment(self) -> client.V1Deployment:
        """
        生成 V1Deployment 对象
        强制策略: 1 replica, limited resources
        """
        # 1. Container 定义
        container = client.V1Container(
            name="app",
            image=self.image,
            image_pull_policy="Always",
            ports=[client.V1ContainerPort(container_port=8000, name="http")],
            resources=client.V1ResourceRequirements(
                limits={"cpu": "500m", "memory": "512Mi"},
                requests={"cpu": "100m", "memory": "128Mi"}
            ),
            env=[
                client.V1EnvVar(name="STUDENT_CODE", value=self.student_code),
                client.V1EnvVar(name="APP_NAME", value=self.app_name)
            ],
            # 安全上下文
            security_context=client.V1SecurityContext(
                run_as_non_root=True,
                run_as_user=1000,
                allow_privilege_escalation=False
            ),
            # === 新增 防御策略 ===
            # 就绪探针：Pod 必须通过此检查才接收流量，且在此之前旧 Pod 不会被杀
            readiness_probe=client.V1Probe(
                tcp_socket=client.V1TCPSocketAction(port=8000),
                initial_delay_seconds=5,
                period_seconds=10,
                failure_threshold=3
            ),
            # 存活探针：失败则重启 Pod
            liveness_probe=client.V1Probe(
                tcp_socket=client.V1TCPSocketAction(port=8000),
                initial_delay_seconds=15, # 给应用更多启动时间
                period_seconds=20,
                failure_threshold=3
            )
        )

        # 2. Pod Template 定义
        template = client.V1PodTemplateSpec(
            metadata=client.V1ObjectMeta(labels=self.labels),
            spec=client.V1PodSpec(
                containers=[container],
                restart_policy="Always"
            )
        )

        # 3. Deployment Spec 定义
        spec = client.V1DeploymentSpec(
            replicas=1, 
            selector=client.V1LabelSelector(match_labels=self.labels),
            template=template,
            # === 新增 回滚与更新策略 ===
            # 限制进度超时，防止永远卡在 Progressing
            progress_deadline_seconds=600, 
            # 滚动更新策略：零停机
            strategy=client.V1DeploymentStrategy(
                type="RollingUpdate",
                rolling_update=client.V1RollingUpdateDeployment(
                    max_surge=1,        # 允许先创建一个新 Pod
                    max_unavailable=0   # 必须等新 Pod Ready 后才能杀旧 Pod
                )
            )
        )

        # 4. Deployment 对象
        return client.V1Deployment(
            api_version="apps/v1",
            kind="Deployment",
            metadata=self._get_common_metadata(self.app_name),
            spec=spec
        )

    def build_service(self) -> client.V1Service:
        """
        生成 V1Service 对象 (ClusterIP)
        """
        spec = client.V1ServiceSpec(
            selector=self.labels,
            ports=[
                client.V1ServicePort(
                    name="http",
                    port=80,
                    target_port="http" # 引用 container port name
                )
            ],
            type="ClusterIP"
        )

        return client.V1Service(
            api_version="v1",
            kind="Service",
            metadata=self._get_common_metadata(self.app_name),
            spec=spec
        )

    def build_ingress(self) -> client.V1Ingress:
        """
        生成 V1Ingress 对象
        Host: {student_code}.{domain_suffix}
        """
        host = f"{self.host_prefix}{self.student_dns_label}.{self.domain_suffix}"
        
        # 路径规则
        path = client.V1HTTPIngressPath(
            path="/",
            path_type="Prefix",
            backend=client.V1IngressBackend(
                service=client.V1IngressServiceBackend(
                    name=self.app_name,
                    port=client.V1ServiceBackendPort(number=80)
                )
            )
        )

        rule = client.V1IngressRule(
            host=host,
            http=client.V1HTTPIngressRuleValue(paths=[path])
        )

        return client.V1Ingress(
            api_version="networking.k8s.io/v1",
            kind="Ingress",
            metadata=client.V1ObjectMeta(
                name=self.app_name,
                namespace=self.namespace,
                labels=self.labels,
                annotations={
                    "kubernetes.io/ingress.class": "traefik",
                    "traefik.ingress.kubernetes.io/router.entrypoints": "web"
                }
            ),
            spec=client.V1IngressSpec(rules=[rule])
        )

def generate_resources(
    student_code: str, 
    image: str, 
    namespace: str,
    domain_suffix: str,
    host_prefix: str = ""
) -> Dict[str, object]:
    """
    Helper function to get all resources at once
    """
    builder = StudentProjectBuilder(student_code, image, namespace, domain_suffix, host_prefix=host_prefix)
    return {
        "deployment": builder.build_deployment(),
        "service": builder.build_service(),
        "ingress": builder.build_ingress()
    }
