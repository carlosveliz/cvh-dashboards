import hashlib

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def sha256_hex(value: str) -> str:
    """Hash opaque tokens (refresh / invitation) for at-rest storage."""
    return hashlib.sha256(value.encode("utf-8")).hexdigest()
