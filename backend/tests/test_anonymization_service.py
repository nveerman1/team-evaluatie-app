"""Tests for the AnonymizationService."""
from app.infra.services.anonymization_service import AnonymizationService


class TestAnonymizationService:
    """Test suite for AnonymizationService."""

    def test_anonymize_empty_list(self):
        """Test anonymizing empty list returns empty list."""
        result = AnonymizationService.anonymize_comments([])
        assert result == []

    def test_anonymize_none_comments(self):
        """Test handling None values in comments."""
        result = AnonymizationService.anonymize_comments([None, "Test", None])
        assert result == ["Test"]

    def test_remove_email_addresses(self):
        """Test that email addresses are removed."""
        comments = [
            "Contact me at john.doe@example.com for more info",
            "Email: student123@school.nl is the right address",
        ]
        result = AnonymizationService.anonymize_comments(comments)
        
        assert len(result) == 2
        assert "@" not in result[0]
        assert "@" not in result[1]
        assert "[...]" in result[0]
        assert "[...]" in result[1]

    def test_remove_student_names(self):
        """Test that student names are removed from comments."""
        names = ["Jan Jansen", "Marie de Vries", "Piet"]
        comments = [
            "Jan Jansen werkt goed samen",
            "Marie de Vries moet meer bijdragen",
            "Piet is een goede teamleider",
            "De samenwerking met jan jansen verliep prima",  # Case insensitive
        ]
        
        result = AnonymizationService.anonymize_comments(comments, names)
        
        assert len(result) == 4
        for comment in result:
            assert "Jan Jansen" not in comment
            assert "Marie de Vries" not in comment
            assert "Piet" not in comment
            # Should be replaced with [...]
            assert "[...]" in comment

    def test_preserve_content_without_names(self):
        """Test that regular content without names is preserved."""
        comments = [
            "De samenwerking verliep goed en iedereen droeg bij.",
            "Meer communicatie is gewenst voor de volgende keer.",
        ]
        
        result = AnonymizationService.anonymize_comments(comments, [])
        
        assert len(result) == 2
        assert result[0] == comments[0]
        assert result[1] == comments[1]

    def test_clean_up_multiple_spaces(self):
        """Test that multiple spaces are cleaned up."""
        comments = ["Dit   is   een    test   met   veel   spaties"]
        
        result = AnonymizationService.anonymize_comments(comments)
        
        assert len(result) == 1
        assert "  " not in result[0]  # No double spaces

    def test_extract_student_names_from_users(self):
        """Test extracting names from user objects."""
        # Mock user objects
        class User:
            def __init__(self, name):
                self.name = name
        
        users = [User("Jan"), User("Marie"), User("")]
        result = AnonymizationService.extract_student_names_from_users(users)
        
        # Empty names are filtered out by the service
        assert len(result) == 2
        assert "Jan" in result
        assert "Marie" in result

    def test_extract_names_from_dicts(self):
        """Test extracting names from dictionaries."""
        users = [
            {"name": "Jan", "id": 1},
            {"name": "Marie", "id": 2},
            {"id": 3},  # No name
        ]
        
        result = AnonymizationService.extract_student_names_from_users(users)
        
        assert len(result) == 2
        assert "Jan" in result
        assert "Marie" in result

    def test_case_insensitive_name_removal(self):
        """Test that name removal is case-insensitive."""
        names = ["Jan Jansen"]
        comments = [
            "jan jansen werkt hard",
            "JAN JANSEN is enthousiast",
            "Jan jansen helpt anderen",
        ]
        
        result = AnonymizationService.anonymize_comments(comments, names)
        
        for comment in result:
            assert "jan jansen" not in comment.lower()
            assert "[...]" in comment

    def test_short_names_ignored(self):
        """Test that very short names (<=2 chars) are not removed."""
        names = ["A", "AB", "ABC"]
        comments = ["A werkt goed", "AB is actief", "ABC draagt bij"]
        
        result = AnonymizationService.anonymize_comments(comments, names)
        
        # Only ABC (>2 chars) should be replaced
        assert len(result) == 3
        assert "A werkt goed" == result[0]
        assert "AB is actief" == result[1]
        assert "[...]" in result[2]
        assert "ABC" not in result[2]

    def test_only_brackets_comments_removed(self):
        """Test that comments containing only [...] are removed."""
        names = ["Complete Comment"]
        comments = ["Complete Comment", "Another valid comment"]
        
        result = AnonymizationService.anonymize_comments(comments, names)
        
        # First comment becomes only [...] and should be removed
        assert len(result) == 1
        assert result[0] == "Another valid comment"
