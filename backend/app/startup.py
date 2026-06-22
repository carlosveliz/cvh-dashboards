_WEAK_SECRETS = {"", "change-me", "change-me-to-a-long-random-string"}


def check_secret_key(value: str) -> None:
    """Fail fast on a default or too-short SECRET_KEY.

    The key signs JWTs and content tokens; a weak/default value is a security
    hole and a foot-gun (rotating it invalidates every session)."""
    if value in _WEAK_SECRETS or len(value) < 32:
        raise RuntimeError(
            "SECRET_KEY débil o por defecto. Define uno aleatorio de >=32 chars, "
            'p.ej. `python -c "import secrets; print(secrets.token_urlsafe(48))"`.'
        )
