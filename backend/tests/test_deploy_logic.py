import sys
import os
import unittest

# Ensure we can import from 'app'
# Assuming this script is run from 'backend/' or 'backend/tests/'
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, ".."))
sys.path.append(backend_dir)

from app.core.k8s_resources import StudentProjectBuilder

class TestStudentProjectBuilder(unittest.TestCase):
    
    def setUp(self):
        self.student_code = "s2025_001"
        self.image = "registry.example.com/repo/img:tag"
        self.namespace = "students-gd"
        self.domain = "gd.hydrosim.cn"
        
        self.builder = StudentProjectBuilder(
            student_code=self.student_code,
            image=self.image,
            namespace=self.namespace,
            domain_suffix=self.domain
        )

    def test_deployment_generation(self):
        deploy = self.builder.build_deployment()
        
        self.assertEqual(deploy.metadata.name, "student-s2025_001")
        self.assertEqual(deploy.spec.replicas, 1)
        
        # Check Strategy
        self.assertEqual(deploy.spec.strategy.type, "RollingUpdate")
        self.assertEqual(deploy.spec.strategy.rolling_update.max_unavailable, 0)
        
        # Check Container
        container = deploy.spec.template.spec.containers[0]
        self.assertEqual(container.image, self.image)
        self.assertEqual(container.resources.limits['cpu'], "500m")
        
        # Check Probes
        self.assertIsNotNone(container.readiness_probe)
        self.assertEqual(container.readiness_probe.tcp_socket.port, 8000)

    def test_service_generation(self):
        svc = self.builder.build_service()
        self.assertEqual(svc.metadata.name, "student-s2025_001")
        self.assertEqual(svc.spec.type, "ClusterIP")
        self.assertEqual(svc.spec.ports[0].port, 80)
        self.assertEqual(svc.spec.ports[0].target_port, "http")

    def test_ingress_generation(self):
        ing = self.builder.build_ingress()
        expected_host = "s2025_001.gd.hydrosim.cn"
        self.assertEqual(ing.spec.rules[0].host, expected_host)
        self.assertEqual(ing.metadata.annotations["kubernetes.io/ingress.class"], "traefik")

if __name__ == "__main__":
    unittest.main()
