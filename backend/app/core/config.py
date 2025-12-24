"""
Application configuration settings
"""
from typing import List, Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用配置"""
    
    # 项目信息
    PROJECT_NAME: str = "Hydrosim Platform Backend"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # 环境
    PORTAL_ENV: str = "development"
    
    # 数据库 (必填)
    DATABASE_URL: str

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["*"]
    
    # Gitea (可选)
    GITEA_URL: Optional[str] = None
    GITEA_TOKEN: Optional[str] = None
    GITEA_ADMIN_USER: str = "gitea_admin"
    GITEA_ADMIN_PASSWORD: str = ""
    
    # MinIO (可选)
    MINIO_ENDPOINT: Optional[str] = None
    MINIO_ACCESS_KEY: Optional[str] = None
    MINIO_SECRET_KEY: Optional[str] = None
    MINIO_BUCKET: str = "hydrosim-platform"
    MINIO_SECURE: bool = False
    
    # Kubernetes (可选)
    K8S_NAMESPACE: str = "hydrosim"
    K8S_IN_CLUSTER: bool = False
    K8S_CONFIG_PATH: str = "~/.kube/config"
    
    # JWT (可选，但建议设置)
    JWT_SECRET_KEY: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # 管理员
    PORTAL_ADMIN_USER: str = "teacher"
    PORTAL_ADMIN_PASSWORD: str = "changeme"
    
    # 其他
    ALLOW_DEMO_LOGIN: bool = True
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
