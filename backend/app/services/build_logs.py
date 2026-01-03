import io
import logging
from typing import Optional, Tuple
from urllib.parse import urlparse

from minio import Minio

from app.core.config import settings

logger = logging.getLogger(__name__)

class BuildLogService:
    def __init__(self):
        self.minio_client = None
        endpoint = settings.MINIO_ENDPOINT
        if endpoint and (not settings.K8S_IN_CLUSTER) and "svc.cluster.local" in endpoint:
            if settings.MINIO_PUBLIC_ENDPOINT:
                endpoint = settings.MINIO_PUBLIC_ENDPOINT
            else:
                logger.warning(
                    "MinIO endpoint is cluster-local but K8S_IN_CLUSTER is false. Log archiving disabled."
                )
                endpoint = None

        if endpoint:
            host, secure = self._normalize_endpoint(endpoint, settings.MINIO_SECURE)
            self.minio_client = Minio(
                host,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=secure
            )
            self.bucket_name = settings.MINIO_BUCKET
            try:
                self._ensure_bucket()
            except Exception as e:
                logger.warning(f"Failed to connect to MinIO at {endpoint}: {e}. Log archiving disabled.")
                self.minio_client = None

    @staticmethod
    def _normalize_endpoint(endpoint: str, default_secure: bool) -> Tuple[str, bool]:
        if endpoint.startswith("http://") or endpoint.startswith("https://"):
            parsed = urlparse(endpoint)
            host = parsed.netloc
            secure = parsed.scheme == "https"
            return host, secure
        return endpoint, default_secure

    def _ensure_bucket(self):
        if self.minio_client and not self.minio_client.bucket_exists(self.bucket_name):
            self.minio_client.make_bucket(self.bucket_name)

    def upload_log(self, object_name: str, log_content: str) -> bool:
        if not self.minio_client:
            return False
        try:
            content_bytes = log_content.encode('utf-8')
            data_stream = io.BytesIO(content_bytes)
            self.minio_client.put_object(
                self.bucket_name,
                object_name,
                data_stream,
                len(content_bytes),
                content_type="text/plain"
            )
            return True
        except Exception as e:
            logger.error(f"Failed to upload logs to MinIO: {e}")
            return False

    def get_log(self, object_name: str) -> Optional[str]:
        if not self.minio_client:
            return None
        try:
            response = self.minio_client.get_object(self.bucket_name, object_name)
            content = response.read().decode('utf-8')
            response.close()
            response.release_conn()
            return content
        except Exception as e:
            logger.error(f"Failed to get logs from MinIO: {e}")
            return None

    def get_presigned_url(self, object_name: str) -> Optional[str]:
        if not self.minio_client:
            return None
        try:
            return self.minio_client.presigned_get_object(self.bucket_name, object_name)
        except Exception as e:
            logger.error(f"Failed to generate presigned URL: {e}")
            return None

build_log_service = BuildLogService()
