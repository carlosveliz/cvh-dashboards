import pytest

from app.startup import check_secret_key


def test_rejects_default():
    with pytest.raises(RuntimeError):
        check_secret_key("change-me")


def test_rejects_default_example():
    with pytest.raises(RuntimeError):
        check_secret_key("change-me-to-a-long-random-string")


def test_rejects_short():
    with pytest.raises(RuntimeError):
        check_secret_key("short")


def test_accepts_strong():
    check_secret_key("x" * 40)  # no raise
