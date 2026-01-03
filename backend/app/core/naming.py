import hashlib
import re


def normalize_k8s_name(value: str, max_length: int = 63) -> str:
    if not value:
        return "student"
    lowered = value.strip().lower()
    normalized = re.sub(r"[^a-z0-9-]+", "-", lowered)
    normalized = re.sub(r"-{2,}", "-", normalized).strip("-")
    if not normalized:
        normalized = "student"
    if len(normalized) > max_length:
        digest = hashlib.sha1(lowered.encode("utf-8")).hexdigest()[:6]
        trim_len = max_length - 7
        normalized = f"{normalized[:trim_len].rstrip('-')}-{digest}"
    return normalized


def student_resource_name(student_code: str) -> str:
    return f"student-{normalize_k8s_name(student_code)}"


def student_dns_label(student_code: str) -> str:
    return normalize_k8s_name(student_code)
