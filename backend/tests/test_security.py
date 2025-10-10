import jwt
from datetime import datetime, timezone
from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password


def test_password_hash_verify():
    h = get_password_hash("TopSecret123!")
    assert verify_password("TopSecret123!", h)
    assert not verify_password("nope", h)


def test_jwt_roundtrip():
    tok = create_access_token("user@example.com")
    payload = jwt.decode(tok, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    assert payload["sub"] == "user@example.com"
    assert datetime.fromtimestamp(payload["exp"], tz=timezone.utc) > datetime.now(
        timezone.utc
    )


def test_invalid_token():
    bad = "abc.def.ghi"
    try:
        jwt.decode(bad, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert False, "must raise"
    except jwt.InvalidTokenError:
        pass
