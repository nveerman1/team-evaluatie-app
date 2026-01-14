"""
Test for status filter parameter in list_evaluations endpoint
"""

from unittest.mock import Mock

from app.infra.db.models import User, Evaluation, Course


class TestStatusFilter:
    """Test status filter functionality"""

    def test_list_evaluations_status_filter_parameter_name(self):
        """Test that status parameter (not status_) is correctly used in filter"""
        from app.api.v1.routers.evaluations import list_evaluations
        
        # Mock database and user
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"
        
        # Mock evaluation with 'open' status
        evaluation = Mock(spec=Evaluation)
        evaluation.id = 1
        evaluation.school_id = 1
        evaluation.course_id = 1
        evaluation.status = "open"
        evaluation.title = "Test Evaluation"
        evaluation.rubric_id = 1
        evaluation.evaluation_type = "peer"
        evaluation.settings = {}
        evaluation.closed_at = None
        evaluation.created_at = None
        evaluation.project_id = None
        evaluation.project_team_id = None
        
        # Mock course
        course = Mock(spec=Course)
        course.name = "Test Course"
        evaluation.course = course
        
        # Setup execute mock to return our evaluation
        scalars_mock = Mock()
        scalars_mock.all.return_value = [evaluation]
        execute_mock = Mock()
        execute_mock.scalars.return_value = scalars_mock
        db.execute.return_value = execute_mock
        
        # Call endpoint with status filter using 'status' parameter (not 'status_')
        result = list_evaluations(
            db=db,
            user=user,
            q=None,
            status="open",  # This is the key - using 'status' not 'status_'
            course_id=None,
            evaluation_type=None,
            page=1,
            limit=50
        )
        
        # Verify the function executed without error
        assert result is not None
        assert len(result) == 1
        assert result[0].status == "open"
    
    def test_list_evaluations_all_status_values(self):
        """Test that all valid status values work correctly"""
        from app.api.v1.routers.evaluations import list_evaluations
        
        valid_statuses = ["draft", "open", "closed"]
        
        for status_value in valid_statuses:
            # Mock database and user
            db = Mock()
            user = Mock(spec=User)
            user.school_id = 1
            user.role = "teacher"
            
            # Mock evaluation with the current status
            evaluation = Mock(spec=Evaluation)
            evaluation.id = 1
            evaluation.school_id = 1
            evaluation.course_id = 1
            evaluation.status = status_value
            evaluation.title = f"Test Evaluation {status_value}"
            evaluation.rubric_id = 1
            evaluation.evaluation_type = "peer"
            evaluation.settings = {}
            evaluation.closed_at = None
            evaluation.created_at = None
            evaluation.project_id = None
            evaluation.project_team_id = None
            
            # Mock course
            course = Mock(spec=Course)
            course.name = "Test Course"
            evaluation.course = course
            
            # Setup execute mock to return our evaluation
            scalars_mock = Mock()
            scalars_mock.all.return_value = [evaluation]
            execute_mock = Mock()
            execute_mock.scalars.return_value = scalars_mock
            db.execute.return_value = execute_mock
            
            # Call endpoint with status filter
            result = list_evaluations(
                db=db,
                user=user,
                q=None,
                status=status_value,
                course_id=None,
                evaluation_type=None,
                page=1,
                limit=50
            )
            
            # Verify the function executed without error and returned correct status
            assert result is not None
            assert len(result) == 1
            assert result[0].status == status_value
    
    def test_list_evaluations_no_status_filter(self):
        """Test that omitting status parameter returns all evaluations"""
        from app.api.v1.routers.evaluations import list_evaluations
        
        # Mock database and user
        db = Mock()
        user = Mock(spec=User)
        user.school_id = 1
        user.role = "teacher"
        
        # Mock multiple evaluations with different statuses
        evaluations = []
        for idx, status in enumerate(["draft", "open", "closed"]):
            evaluation = Mock(spec=Evaluation)
            evaluation.id = idx + 1
            evaluation.school_id = 1
            evaluation.course_id = 1
            evaluation.status = status
            evaluation.title = f"Test Evaluation {status}"
            evaluation.rubric_id = 1
            evaluation.evaluation_type = "peer"
            evaluation.settings = {}
            evaluation.closed_at = None
            evaluation.created_at = None
            evaluation.project_id = None
            evaluation.project_team_id = None
            
            # Mock course
            course = Mock(spec=Course)
            course.name = "Test Course"
            evaluation.course = course
            
            evaluations.append(evaluation)
        
        # Setup execute mock to return all evaluations
        scalars_mock = Mock()
        scalars_mock.all.return_value = evaluations
        execute_mock = Mock()
        execute_mock.scalars.return_value = scalars_mock
        db.execute.return_value = execute_mock
        
        # Call endpoint without status filter
        result = list_evaluations(
            db=db,
            user=user,
            q=None,
            status=None,  # No filter
            course_id=None,
            evaluation_type=None,
            page=1,
            limit=50
        )
        
        # Verify the function executed without error and returned all evaluations
        assert result is not None
        assert len(result) == 3
        statuses = [r.status for r in result]
        assert "draft" in statuses
        assert "open" in statuses
        assert "closed" in statuses
