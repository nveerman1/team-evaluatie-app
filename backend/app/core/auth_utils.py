from __future__ import annotations

def normalize_email(email: str | None) -> str:
    """
    Normalize an email address for authentication + user lookup.

    Policy:
    - trim whitespace
    - case-insensitive compare => store/lookup in lowercase
    """
    return (email or "").strip().lower()
