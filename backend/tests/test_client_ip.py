from app.services.audit import _client_ip


class _Req:
    def __init__(self, headers, client_host="127.0.0.1"):
        self.headers = headers
        self.client = type("C", (), {"host": client_host})()


def test_picks_first_public_in_chain():
    # Real client first, internal proxy hops after -> return the public client.
    r = _Req({"x-forwarded-for": "8.8.8.8, 10.0.1.1, 172.18.0.5"})
    assert _client_ip(r) == "8.8.8.8"


def test_skips_leading_private_to_find_public():
    # Some proxies prepend internal hops; still find the public client.
    r = _Req({"x-forwarded-for": "10.0.1.1, 1.1.1.1"})
    assert _client_ip(r) == "1.1.1.1"


def test_all_internal_returns_leftmost():
    # No public address available (internal access) -> leftmost, not a crash.
    r = _Req({"x-forwarded-for": "10.0.1.1, 172.18.0.5"})
    assert _client_ip(r) == "10.0.1.1"


def test_falls_back_to_x_real_ip():
    r = _Req({"x-real-ip": "9.9.9.9"})
    assert _client_ip(r) == "9.9.9.9"


def test_falls_back_to_peer():
    r = _Req({}, client_host="192.168.0.5")
    assert _client_ip(r) == "192.168.0.5"
