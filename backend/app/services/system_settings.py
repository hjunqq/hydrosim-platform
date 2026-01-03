from typing import Tuple

from sqlalchemy.orm import Session

from app import models
from app.core.naming import student_dns_label


DEFAULT_STUDENT_DOMAIN_PREFIX = "stu-"
DEFAULT_STUDENT_DOMAIN_BASE = "hydrosim.cn"


def get_or_create_settings(db: Session) -> models.SystemSetting:
    settings = db.query(models.SystemSetting).first()
    if settings:
        updated = False
        if settings.student_domain_prefix is None:
            settings.student_domain_prefix = DEFAULT_STUDENT_DOMAIN_PREFIX
            updated = True
        if not settings.student_domain_base:
            settings.student_domain_base = DEFAULT_STUDENT_DOMAIN_BASE
            updated = True
        
        # Build Settings Defaults
        if not settings.build_namespace:
            settings.build_namespace = "hydrosim"
            updated = True
        if not settings.default_image_repo_template:
            settings.default_image_repo_template = "{{registry}}/hydrosim/{{student_code}}"
            updated = True

        if updated:
            db.commit()
            db.refresh(settings)
        return settings

    settings = models.SystemSetting()
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def _normalize_project_type(project_type: object) -> str:
    return getattr(project_type, "value", str(project_type)).lower()


def get_student_domain_parts(
    settings: models.SystemSetting,
    student_code: str,
    project_type: object,
) -> Tuple[str, str, str]:
    prefix = (
        settings.student_domain_prefix
        if settings.student_domain_prefix is not None
        else DEFAULT_STUDENT_DOMAIN_PREFIX
    )
    prefix = prefix.lower()
    base = settings.student_domain_base or DEFAULT_STUDENT_DOMAIN_BASE
    base = base.strip().lstrip(".")
    project_key = _normalize_project_type(project_type)
    host_prefix = prefix
    host = f"{host_prefix}{student_dns_label(student_code)}"
    domain_suffix = f"{project_key}.{base}"
    full_domain = f"{host}.{domain_suffix}"
    return host_prefix, domain_suffix, full_domain
