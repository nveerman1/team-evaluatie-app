"""
Tests for CSV injection protection
"""

from app.api.v1.utils.csv_sanitization import sanitize_csv_value


class TestCSVSanitization:
    """Tests for CSV injection prevention via sanitization"""

    def test_sanitize_formula_with_equals(self):
        """Test that formulas starting with = are sanitized"""
        assert sanitize_csv_value("=1+1") == "'=1+1"
        assert sanitize_csv_value("=SUM(A1:A10)") == "'=SUM(A1:A10)"
        assert sanitize_csv_value("=cmd|' /C calc'!A0") == "'=cmd|' /C calc'!A0"

    def test_sanitize_formula_with_plus(self):
        """Test that formulas starting with + are sanitized"""
        assert sanitize_csv_value("+1+1") == "'+1+1"
        assert sanitize_csv_value("+cmd|' /C calc'!A0") == "'+cmd|' /C calc'!A0"

    def test_sanitize_formula_with_minus(self):
        """Test that formulas starting with - are sanitized"""
        assert sanitize_csv_value("-1+1") == "'-1+1"
        assert sanitize_csv_value("-cmd|' /C calc'!A0") == "'-cmd|' /C calc'!A0"

    def test_sanitize_formula_with_at(self):
        """Test that formulas starting with @ are sanitized"""
        assert sanitize_csv_value("@SUM(A1:A10)") == "'@SUM(A1:A10)"

    def test_sanitize_formula_with_tab(self):
        """Test that formulas starting with tab are sanitized"""
        assert sanitize_csv_value("\t=1+1") == "'\t=1+1"

    def test_sanitize_formula_with_carriage_return(self):
        """Test that formulas starting with carriage return are sanitized"""
        assert sanitize_csv_value("\r=1+1") == "'\r=1+1"

    def test_normal_text_not_sanitized(self):
        """Test that normal text is not modified"""
        assert sanitize_csv_value("normal text") == "normal text"
        assert sanitize_csv_value("John Doe") == "John Doe"
        assert sanitize_csv_value("test@example.com") == "test@example.com"

    def test_numbers_not_sanitized(self):
        """Test that numbers are not modified"""
        assert sanitize_csv_value(123) == "123"
        assert sanitize_csv_value(456.78) == "456.78"

    def test_none_returns_empty_string(self):
        """Test that None values return empty string"""
        assert sanitize_csv_value(None) == ""

    def test_empty_string_returns_empty_string(self):
        """Test that empty strings return empty string"""
        assert sanitize_csv_value("") == ""

    def test_text_with_dangerous_chars_in_middle(self):
        """Test that dangerous chars in middle of text are not modified"""
        assert sanitize_csv_value("text=formula") == "text=formula"
        assert sanitize_csv_value("test+plus") == "test+plus"
        assert sanitize_csv_value("negative-value") == "negative-value"

    def test_realistic_csv_injection_payloads(self):
        """Test with realistic CSV injection attack payloads"""
        # Remote code execution attempts
        assert sanitize_csv_value("=cmd|' /C calc'!A0") == "'=cmd|' /C calc'!A0"
        assert sanitize_csv_value("=HYPERLINK(\"http://evil.com\",\"Click here\")") == "'=HYPERLINK(\"http://evil.com\",\"Click here\")"
        
        # DDE (Dynamic Data Exchange) attacks
        assert sanitize_csv_value("=2+5+cmd|'/c calc'!A1") == "'=2+5+cmd|'/c calc'!A1"
        assert sanitize_csv_value("@SUM(1+1)*cmd|'/c calc'!A1") == "'@SUM(1+1)*cmd|'/c calc'!A1"
        
        # Common attack patterns
        assert sanitize_csv_value("-2+3+cmd|'/c calc'!A1") == "'-2+3+cmd|'/c calc'!A1"
        assert sanitize_csv_value("+2+3+cmd|'/c calc'!A1") == "'+2+3+cmd|'/c calc'!A1"

    def test_boolean_values(self):
        """Test that boolean values are converted to string"""
        assert sanitize_csv_value(True) == "True"
        assert sanitize_csv_value(False) == "False"

    def test_special_characters_in_names(self):
        """Test that names with special characters (but not at start) are safe"""
        assert sanitize_csv_value("O'Brien") == "O'Brien"
        assert sanitize_csv_value("Jean-Paul") == "Jean-Paul"
        assert sanitize_csv_value("user@domain.com") == "user@domain.com"


class TestCSVExportSanitization:
    """Integration tests to ensure CSV exports use sanitization"""

    def test_teachers_export_imports_sanitization(self):
        """Test that teachers export module imports sanitization function"""
        from app.api.v1.routers import teachers
        # Check that the sanitize_csv_value function is imported
        assert hasattr(teachers, 'sanitize_csv_value')

    def test_admin_students_export_imports_sanitization(self):
        """Test that admin_students export module imports sanitization function"""
        from app.api.v1.routers import admin_students
        # Check that the sanitize_csv_value function is imported
        assert hasattr(admin_students, 'sanitize_csv_value')
