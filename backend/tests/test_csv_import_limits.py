"""
Tests for CSV import DoS protection - file size and row limits
"""

import pytest
from io import BytesIO, StringIO
from unittest.mock import Mock, patch
from fastapi import UploadFile


class TestCSVImportLimits:
    """Tests for CSV import file size and row count limits"""

    def test_csv_file_size_limit_constants_defined(self):
        """Test that CSV limits are properly defined"""
        from app.api.v1.routers.teachers import MAX_CSV_FILE_SIZE, MAX_CSV_ROWS
        from app.api.v1.routers.admin_students import MAX_CSV_FILE_SIZE as ADMIN_MAX_CSV_FILE_SIZE
        from app.api.v1.routers.admin_students import MAX_CSV_ROWS as ADMIN_MAX_CSV_ROWS
        
        # Verify limits are defined
        assert MAX_CSV_FILE_SIZE == 10 * 1024 * 1024  # 10MB
        assert MAX_CSV_ROWS == 10000
        assert ADMIN_MAX_CSV_FILE_SIZE == 10 * 1024 * 1024  # 10MB
        assert ADMIN_MAX_CSV_ROWS == 10000

    @pytest.mark.asyncio
    async def test_teachers_csv_rejects_oversized_file(self):
        """Test that teacher CSV import rejects files over 10MB"""
        from app.api.v1.routers.teachers import import_teachers_csv, MAX_CSV_FILE_SIZE
        from fastapi import HTTPException
        
        # Create a file larger than the limit
        large_content = b"name,email,role\n" + b"test,test@example.com,teacher\n" * (MAX_CSV_FILE_SIZE // 30 + 1)
        
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "teachers.csv"
        mock_file.read = Mock(return_value=large_content)
        
        mock_db = Mock()
        mock_user = Mock()
        mock_user.school_id = 1
        mock_user.role = "admin"
        
        with patch("app.api.v1.routers.teachers.require_role"):
            with pytest.raises(HTTPException) as exc_info:
                await import_teachers_csv(file=mock_file, db=mock_db, user=mock_user)
            
            assert exc_info.value.status_code == 400
            assert "too large" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_teachers_csv_rejects_too_many_rows(self):
        """Test that teacher CSV import rejects files with more than 10,000 rows"""
        from app.api.v1.routers.teachers import import_teachers_csv, MAX_CSV_ROWS
        from fastapi import HTTPException
        
        # Create a CSV with more than MAX_CSV_ROWS rows
        csv_header = "name,email,role\n"
        csv_rows = "\n".join([f"Teacher {i},teacher{i}@example.com,teacher" for i in range(MAX_CSV_ROWS + 10)])
        csv_content = (csv_header + csv_rows).encode('utf-8')
        
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "teachers.csv"
        mock_file.read = Mock(return_value=csv_content)
        
        mock_db = Mock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        mock_db.commit = Mock()
        mock_db.rollback = Mock()
        
        mock_user = Mock()
        mock_user.school_id = 1
        mock_user.role = "admin"
        
        with patch("app.api.v1.routers.teachers.require_role"):
            with pytest.raises(HTTPException) as exc_info:
                await import_teachers_csv(file=mock_file, db=mock_db, user=mock_user)
            
            assert exc_info.value.status_code == 400
            assert "too many rows" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_teachers_csv_accepts_valid_size_file(self):
        """Test that teacher CSV import accepts files within size limits"""
        from app.api.v1.routers.teachers import import_teachers_csv
        
        # Create a valid small CSV
        csv_content = b"name,email,role\nTest Teacher,test@example.com,teacher\n"
        
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "teachers.csv"
        mock_file.read = Mock(return_value=csv_content)
        
        mock_db = Mock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        mock_db.commit = Mock()
        mock_db.add = Mock()
        mock_db.flush = Mock()
        
        mock_user = Mock()
        mock_user.school_id = 1
        mock_user.role = "admin"
        
        with patch("app.api.v1.routers.teachers.require_role"):
            result = await import_teachers_csv(file=mock_file, db=mock_db, user=mock_user)
            
            # Should succeed without raising exception
            assert result is not None
            assert hasattr(result, 'success_count') or 'success_count' in result or result.success_count >= 0

    def test_students_csv_rejects_oversized_file(self):
        """Test that student CSV import rejects files over 10MB"""
        from app.api.v1.routers.admin_students import import_students_csv, MAX_CSV_FILE_SIZE
        from fastapi import HTTPException
        
        # Create a mock file larger than the limit
        large_content = b"name,email\n" + b"test,test@example.com\n" * (MAX_CSV_FILE_SIZE // 25 + 1)
        
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "students.csv"
        mock_file.file = BytesIO(large_content)
        
        mock_db = Mock()
        mock_user = Mock()
        mock_user.school_id = 1
        mock_user.role = "admin"
        
        with pytest.raises(HTTPException) as exc_info:
            import_students_csv(file=mock_file, db=mock_db, current_user=mock_user)
        
        assert exc_info.value.status_code == 400
        assert "too large" in exc_info.value.detail.lower()

    def test_students_csv_rejects_too_many_rows(self):
        """Test that student CSV import rejects files with more than 10,000 rows"""
        from app.api.v1.routers.admin_students import import_students_csv, MAX_CSV_ROWS
        from fastapi import HTTPException
        
        # Create a CSV with more than MAX_CSV_ROWS rows
        csv_header = "name,email\n"
        csv_rows = "\n".join([f"Student {i},student{i}@example.com" for i in range(MAX_CSV_ROWS + 10)])
        csv_content = csv_header + csv_rows
        
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "students.csv"
        mock_file.file = BytesIO(csv_content.encode('utf-8'))
        
        mock_db = Mock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        mock_db.commit = Mock()
        
        mock_user = Mock()
        mock_user.school_id = 1
        mock_user.role = "admin"
        
        with pytest.raises(HTTPException) as exc_info:
            import_students_csv(file=mock_file, db=mock_db, current_user=mock_user)
        
        assert exc_info.value.status_code == 400
        assert "too many rows" in exc_info.value.detail.lower()

    def test_students_csv_accepts_valid_size_file(self):
        """Test that student CSV import accepts files within size limits"""
        from app.api.v1.routers.admin_students import import_students_csv
        
        # Create a valid small CSV
        csv_content = "name,email\nTest Student,test@example.com\n"
        
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "students.csv"
        mock_file.file = BytesIO(csv_content.encode('utf-8'))
        
        mock_db = Mock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        mock_db.commit = Mock()
        mock_db.add = Mock()
        mock_db.flush = Mock()
        
        mock_user = Mock()
        mock_user.school_id = 1
        mock_user.role = "admin"
        
        result = import_students_csv(file=mock_file, db=mock_db, current_user=mock_user)
        
        # Should succeed without raising exception
        assert result is not None
        assert 'created' in result or 'updated' in result
