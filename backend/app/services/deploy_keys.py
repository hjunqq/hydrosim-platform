import base64
import hashlib
from dataclasses import dataclass

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa


@dataclass
class DeployKeyPair:
    public_key: str
    private_key: str
    fingerprint: str


def generate_deploy_key_pair(key_size: int = 4096) -> DeployKeyPair:
    key = rsa.generate_private_key(public_exponent=65537, key_size=key_size)
    private_key = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    public_key_bytes = key.public_key().public_bytes(
        encoding=serialization.Encoding.OpenSSH,
        format=serialization.PublicFormat.OpenSSH,
    )
    public_key = public_key_bytes.decode("utf-8")
    fingerprint = _fingerprint(public_key_bytes)
    return DeployKeyPair(
        public_key=public_key,
        private_key=private_key,
        fingerprint=fingerprint,
    )


def _fingerprint(public_key: bytes) -> str:
    digest = hashlib.sha256(public_key).digest()
    return "SHA256:" + base64.b64encode(digest).decode("utf-8").rstrip("=")
