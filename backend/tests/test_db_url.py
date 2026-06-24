from app.config import Settings


def test_db_url_escapes_special_chars():
    """A password with @ / : # must not corrupt host/credentials in the URL."""
    s = Settings(
        database_url="",
        postgres_user="cvh",
        postgres_password="aB3@k/9x:Zq#1mP",
        postgres_db="cvh_dashboards",
        postgres_host="db",
        postgres_port=5432,
    )
    url = s.db_url
    # host and credentials survive intact (the bug parsed host as "k")
    assert url.host == "db"
    assert url.port == 5432
    assert url.username == "cvh"
    assert url.password == "aB3@k/9x:Zq#1mP"
    assert url.database == "cvh_dashboards"
    # rendered string is round-trippable by SQLAlchemy
    assert url.drivername == "postgresql+asyncpg"


def test_explicit_database_url_overrides_parts():
    s = Settings(
        database_url="postgresql+asyncpg://u:p@somehost:5432/dbx",
        postgres_password="ignored",
    )
    assert s.db_url == "postgresql+asyncpg://u:p@somehost:5432/dbx"
