import pytest


def test_admin_students_create_schema():
    """Test that AdminStudentCreate schema can be imported and has required fields"""
    from app.api.v1.schemas.admin_students import AdminStudentCreate
    
    # Test valid data
    student = AdminStudentCreate(
        name="Test Student",
        email="test@example.com",
        class_name="4A",
        cluster="A",
        team_number=1,
        status="active"
    )
    
    assert student.name == "Test Student"
    assert student.email == "test@example.com"
    assert student.class_name == "4A"
    assert student.cluster == "A"
    assert student.team_number == 1
    assert student.status == "active"
    
    # Test optional fields
    student_minimal = AdminStudentCreate(
        name="Minimal Student",
        email="minimal@example.com"
    )
    
    assert student_minimal.name == "Minimal Student"
    assert student_minimal.email == "minimal@example.com"
    assert student_minimal.class_name is None
    assert student_minimal.cluster is None
    assert student_minimal.team_number is None
    assert student_minimal.status == "active"
