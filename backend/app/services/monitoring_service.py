import logging
from typing import Dict, Any, List
try:
    from kubernetes import client, config
    from kubernetes.client.rest import ApiException
    K8S_AVAILABLE = True
except ImportError:
    K8S_AVAILABLE = False

logger = logging.getLogger(__name__)

class MonitoringService:
    def __init__(self):
        self._init_k8s()

    def _init_k8s(self):
        if not K8S_AVAILABLE:
            logger.warning("Kubernetes client not installed.")
            return

        try:
            # Try loading in-cluster config first, then local kubeconfig
            try:
                config.load_incluster_config()
            except config.ConfigException:
                config.load_kube_config()
            
            self.v1 = client.CoreV1Api()
            self.cust = client.CustomObjectsApi() # For metrics.k8s.io if needed
        except Exception as e:
            logger.error(f"Failed to initialize Kubernetes client: {e}")
            self.v1 = None

    def get_cluster_overview(self) -> Dict[str, Any]:
        """
        Get high-level cluster stats.
        If metrics-server is unavailable, return counts with N/A usage.
        """
        if not K8S_AVAILABLE or not getattr(self, "v1", None):
            return self._get_mock_stats()

        try:
            nodes = self.v1.list_node()
            pods = self.v1.list_pod_for_all_namespaces()
            node_count = len(nodes.items)
            pod_count = len(pods.items)

            total_cpu_cores = 0.0
            total_mem_bytes = 0.0
            for node in nodes.items:
                capacity = node.status.capacity or {}
                total_cpu_cores += self._parse_cpu(capacity.get("cpu", "0"))
                total_mem_bytes += self._parse_memory(capacity.get("memory", "0"))

            cpu_usage = None
            mem_usage = None
            metrics_ok = False
            if getattr(self, "cust", None):
                try:
                    metrics = self.cust.list_cluster_custom_object(
                        group="metrics.k8s.io",
                        version="v1beta1",
                        plural="nodes",
                    )
                    cpu_total = 0.0
                    mem_total = 0.0
                    for item in metrics.get("items", []):
                        usage = item.get("usage", {})
                        cpu_total += self._parse_cpu(usage.get("cpu", "0"))
                        mem_total += self._parse_memory(usage.get("memory", "0"))
                    cpu_usage = cpu_total
                    mem_usage = mem_total
                    metrics_ok = True
                except Exception as exc:
                    logger.warning(f"Metrics server unavailable: {exc}")

            cpu_pct = None
            mem_pct = None
            if metrics_ok and total_cpu_cores > 0:
                cpu_pct = round((cpu_usage / total_cpu_cores) * 100, 1)
            if metrics_ok and total_mem_bytes > 0:
                mem_pct = round((mem_usage / total_mem_bytes) * 100, 1)

            return {
                "nodes": node_count,
                "pods": pod_count,
                "cpu_percentage": cpu_pct,
                "memory_percentage": mem_pct,
                "status": "Healthy" if metrics_ok else "Metrics unavailable",
            }
        except Exception as e:
            logger.error(f"Error fetching k8s stats: {e}")
            return self._get_mock_stats()

    def get_namespace_usage(self) -> List[Dict[str, Any]]:
        if not K8S_AVAILABLE or not getattr(self, "v1", None):
            return []

        try:
            # 1. Get all namespaces first
            ns_list = self.v1.list_namespace()
            namespaces = [n.metadata.name for n in ns_list.items]
            
            # 2. Get all pods
            pods = self.v1.list_pod_for_all_namespaces()
            
            # 3. Count pods per namespace
            usage_map = {name: 0 for name in namespaces}
            for pod in pods.items:
                ns = pod.metadata.namespace
                if ns in usage_map:
                    usage_map[ns] += 1
                else:
                    # Case where pod exists but namespace not in list (?) - unlikely
                    usage_map[ns] = 1

            result = []
            for ns in namespaces:
                # Relaxed filter: Show everything that is likely relevant.
                # If user wants EVERYTHING, we just exclude internal k8s stuff if appropriate,
                # but "many namespaces" suggests they want visibility.
                # Let's show all non-system namespaces OR specific system ones.
                # Actually, showing all is best for "Cluster Monitoring".
                result.append({
                    "namespace": ns,
                    "active_pods": usage_map.get(ns, 0),
                    "cpu": "N/A", 
                    "memory": "N/A"
                })
            
            # Provide stable sort
            result.sort(key=lambda x: x['namespace'])
            return result
        except Exception as e:
            logger.error(f"Error fetching namespace stats: {e}")
            return []

    def _get_mock_stats(self):
        return {
            "nodes": 3,
            "pods": 12,
            "cpu_percentage": None,
            "memory_percentage": None,
            "status": "Mock Data (K8s unavailable)"
        }

    def _parse_cpu(self, value: str) -> float:
        if not value:
            return 0.0
        try:
            if value.endswith("n"):
                return float(value[:-1]) / 1e9
            if value.endswith("u"):
                return float(value[:-1]) / 1e6
            if value.endswith("m"):
                return float(value[:-1]) / 1e3
            return float(value)
        except ValueError:
            return 0.0

    def _parse_memory(self, value: str) -> float:
        if not value:
            return 0.0
        units = {
            "Ki": 1024,
            "Mi": 1024 ** 2,
            "Gi": 1024 ** 3,
            "Ti": 1024 ** 4,
            "Pi": 1024 ** 5,
            "Ei": 1024 ** 6,
            "K": 1000,
            "M": 1000 ** 2,
            "G": 1000 ** 3,
            "T": 1000 ** 4,
            "P": 1000 ** 5,
            "E": 1000 ** 6,
        }
        try:
            for unit, factor in units.items():
                if value.endswith(unit):
                    return float(value[:-len(unit)]) * factor
            return float(value)
        except ValueError:
            return 0.0

monitoring_service = MonitoringService()
