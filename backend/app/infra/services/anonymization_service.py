from __future__ import annotations
import re
from typing import List, Optional


class AnonymizationService:
    """Service for anonymizing feedback comments before AI processing."""

    @staticmethod
    def anonymize_comments(
        comments: List[str], student_names: Optional[List[str]] = None
    ) -> List[str]:
        """
        Remove names, emails, and direct references from feedback comments.

        Args:
            comments: List of raw feedback comments
            student_names: Optional list of student names to redact

        Returns:
            List of anonymized comments
        """
        if not comments:
            return []

        student_names = student_names or []
        anonymized = []

        for comment in comments:
            if not comment or not isinstance(comment, str):
                continue

            text = comment

            # Remove email addresses
            text = re.sub(
                r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "[...]", text
            )

            # Remove student names (case-insensitive)
            for name in student_names:
                if name and len(name) > 2:
                    # Match whole word only
                    pattern = r"\b" + re.escape(name) + r"\b"
                    text = re.sub(pattern, "[...]", text, flags=re.IGNORECASE)

            # Remove common direct references in Dutch
            patterns = [
                r"\b(jij|jou|jouw|je)\s+(naam|heet|bent)\b",  # "jij heet", "je naam"
                r"\b(van|door|met)\s+[A-Z][a-z]+\b",  # "van Jan", "door Piet"
            ]

            for pattern in patterns:
                text = re.sub(pattern, "[...]", text, flags=re.IGNORECASE)

            # Clean up multiple spaces
            text = re.sub(r"\s+", " ", text).strip()

            if text and text != "[...]":
                anonymized.append(text)

        return anonymized

    @staticmethod
    def extract_student_names_from_users(users: list) -> List[str]:
        """
        Extract student names from a list of user objects.

        Args:
            users: List of user objects/dicts with 'name' attribute

        Returns:
            List of names
        """
        names = []
        for user in users:
            if hasattr(user, "name") and user.name:
                names.append(user.name)
            elif isinstance(user, dict) and user.get("name"):
                names.append(user["name"])
        return names
