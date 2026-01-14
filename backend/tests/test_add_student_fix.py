"""
Test for the add_student_to_course log_create fix
"""

from unittest.mock import Mock, patch
from app.infra.db.models import User, Course, Group
from app.api.v1.routers.courses import add_student_to_course
from app.api.v1.schemas.courses import CourseStudentCreate


def test_add_student_to_course_logs_correctly():
    """
    Test that add_student_to_course calls log_create with correct parameters
    
    This specifically tests the fix for AttributeError: 'Request' object has no attribute 'school_id'
    The bug was that log_create was called with positional args in wrong order,
    passing request where user was expected.
    """
    # Setup mocks
    db = Mock()
    user = Mock(spec=User)
    user.school_id = 1
    user.role = "admin"
    request = Mock()
    
    # Mock course query to return a course
    mock_course = Mock(spec=Course)
    mock_course.id = 1
    mock_course.school_id = 1
    mock_course.name = "Test Course"
    db.query.return_value.filter.return_value.first.return_value = mock_course
    
    # Mock student query to return None (new student)
    db.query.return_value.filter.return_value.first.side_effect = [
        mock_course,  # Course lookup
        None,  # Student lookup (doesn't exist)
    ]
    
    # Mock group query
    mock_group = Mock(spec=Group)
    mock_group.id = 1
    db.query.return_value.filter.return_value.first.side_effect = [
        mock_course,  # Course lookup
        None,  # Student lookup
        mock_group,  # Group lookup
    ]
    
    # Mock existing membership query
    db.query.return_value.filter.return_value.first.side_effect = [
        mock_course,  # Course lookup
        None,  # Student lookup
        mock_group,  # Group lookup  
        None,  # Existing membership (doesn't exist)
    ]
    
    # Create mock student that will be added
    mock_student = Mock(spec=User)
    mock_student.id = 10
    mock_student.name = "Test Student"
    mock_student.email = "test@example.com"
    mock_student.class_name = "5V1"
    mock_student.team_number = 1
    
    # Setup db.add to capture the student
    def capture_student(obj):
        if isinstance(obj, type(mock_student)):
            # Copy mock student properties to the added object
            obj.id = mock_student.id
            obj.name = mock_student.name
            
    db.add.side_effect = capture_student
    db.flush.return_value = None
    db.commit.return_value = None
    db.refresh.return_value = None
    
    # Payload
    payload = CourseStudentCreate(
        email="test@example.com",
        name="Test Student",
        class_name="5V1",
        team_number=1,
    )
    
    # Patch the dependencies and log_create
    with patch("app.api.v1.routers.courses.require_role"), \
         patch("app.api.v1.routers.courses.require_course_access"), \
         patch("app.api.v1.routers.courses.log_create") as mock_log_create, \
         patch("app.api.v1.routers.courses.User", return_value=mock_student):
        
        # Call the endpoint
        add_student_to_course(
            course_id=1,
            payload=payload,
            db=db,
            user=user,
            request=request,
        )
        
        # Verify log_create was called with correct named parameters
        mock_log_create.assert_called_once()
        call_args = mock_log_create.call_args
        
        # Check that the parameters are passed correctly
        assert call_args.kwargs["db"] == db
        assert call_args.kwargs["user"] == user  # This should be user, not request!
        assert call_args.kwargs["entity_type"] == "user"
        assert "details" in call_args.kwargs
        assert call_args.kwargs["request"] == request  # Request should be last
        
        # Verify that user object (not request) is passed as user parameter
        # This is the key fix - before it was passing request as user
        assert isinstance(call_args.kwargs["user"], type(user))
        assert hasattr(call_args.kwargs["user"], "school_id")


if __name__ == "__main__":
    test_add_student_to_course_logs_correctly()
    print("✅ Test passed! log_create is called with correct parameters.")
