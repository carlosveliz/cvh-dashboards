import hashlib
import os
import uuid
from pathlib import Path

from ..config import settings

UPLOAD_DIR = Path(settings.upload_dir)


def ensure_upload_dir() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _ext_for_type(dashboard_type: str) -> str:
    return ".html" if dashboard_type == "static_html" else ".xlsx"


def save_version(
    dashboard_id: uuid.UUID, dashboard_type: str, data: bytes, version_no: int
) -> tuple[str, int, str]:
    """Save one version to the uploads volume. Returns (relative_path, size, sha256).

    Each version is a distinct file (`{id}-v{n}.ext`) so restoring an older
    version only repoints the dashboard — no file is rewritten. The filename is
    derived from the dashboard id (never user input), so there is no traversal."""
    ensure_upload_dir()
    ext = _ext_for_type(dashboard_type)
    filename = f"{dashboard_id}-v{version_no}{ext}"
    target = UPLOAD_DIR / filename
    target.write_bytes(data)
    digest = hashlib.sha256(data).hexdigest()
    return filename, len(data), digest


def read_file(relative_path: str) -> bytes:
    return (UPLOAD_DIR / relative_path).read_bytes()


def delete_file(relative_path: str | None) -> None:
    if not relative_path:
        return
    target = UPLOAD_DIR / relative_path
    try:
        os.remove(target)
    except FileNotFoundError:
        pass
