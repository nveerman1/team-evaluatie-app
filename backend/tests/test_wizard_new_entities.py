"""
Tests for new wizard functionality - creating proper entity types
"""

from unittest.mock import Mock, patch
from datetime import datetime
from app.infra.db.models import (
    User,
    Project,
    Rubric,
    Group,
    Competency,
)
from app.api.v1.routers.projects import wizard_create_project
from app.api.v1.schemas.projects import (
    ProjectCreate,
    WizardProjectCreate,
    EvaluationConfig,
    PeerEvaluationConfig,
    ProjectAssessmentConfig,
    CompetencyScanConfig,
)


def setup_mock_db():
    """Helper to setup a mock database with proper side effects"""
    db = Mock()

    # Mock db.add to set attributes on the added object
    def mock_add(obj):
        if isinstance(obj, Project):
            obj.id = 1
            obj.created_at = datetime.now()
            obj.updated_at = datetime.now()
        elif hasattr(obj, "id") and obj.id is None:
            obj.id = 1

    db.add = Mock(side_effect=mock_add)
    db.flush = Mock()
    db.commit = Mock()
    db.refresh = Mock()

    return db


class TestWizardPeerEvaluations:
    """Tests for peer evaluations with deadlines"""

    def test_wizard_creates_peer_evaluation_with_deadline(self):
        """Test that wizard creates peer evaluation with deadline"""
        db = setup_mock_db()
        user = Mock(spec=User)
        user.school_id = 1
        user.id = 10
        user.role = "teacher"

        # Mock rubric
        mock_rubric = Mock(spec=Rubric)
        mock_rubric.id = 1

        def query_side_effect(model):
            query_mock = Mock()
            query_mock.filter = Mock(return_value=query_mock)

            if model == Rubric:
                query_mock.first = Mock(return_value=mock_rubric)
            else:
                query_mock.first = Mock(return_value=None)
                query_mock.all = Mock(return_value=[])

            return query_mock

        db.query = Mock(side_effect=query_side_effect)

        deadline = datetime(2025, 6, 30, 23, 59, 59)
        payload = WizardProjectCreate(
            project=ProjectCreate(
                title="Test Project",
                course_id=1,
            ),
            evaluations=EvaluationConfig(
                peer_tussen=PeerEvaluationConfig(
                    enabled=True, deadline=deadline, title_suffix="tussentijds"
                )
            ),
        )

        with patch("app.api.v1.routers.projects.require_role"):
            with patch(
                "app.api.v1.routers.projects.can_access_course", return_value=True
            ):
                with patch("app.api.v1.routers.projects.log_action"):
                    result = wizard_create_project(payload=payload, db=db, user=user)

                    # Verify entities were created
                    assert len(result.entities) == 1
                    assert result.entities[0].type == "peer"
                    assert result.entities[0].data["deadline"] == deadline.isoformat()


class TestWizardProjectAssessments:
    """Tests for project assessment creation"""

    def test_wizard_creates_project_assessment_per_group(self):
        """Test that wizard creates ProjectAssessment records per group"""
        db = setup_mock_db()
        user = Mock(spec=User)
        user.school_id = 1
        user.id = 10
        user.role = "teacher"

        # Mock groups
        mock_group1 = Mock(spec=Group)
        mock_group1.id = 1
        mock_group1.name = "Team 1"

        mock_group2 = Mock(spec=Group)
        mock_group2.id = 2
        mock_group2.name = "Team 2"

        def query_side_effect(model):
            query_mock = Mock()
            query_mock.filter = Mock(return_value=query_mock)

            if model == Group:
                query_mock.all = Mock(return_value=[mock_group1, mock_group2])
            else:
                query_mock.first = Mock(return_value=None)
                query_mock.all = Mock(return_value=[])

            return query_mock

        db.query = Mock(side_effect=query_side_effect)

        payload = WizardProjectCreate(
            project=ProjectCreate(
                title="Test Project",
                course_id=1,
            ),
            evaluations=EvaluationConfig(
                project_assessment=ProjectAssessmentConfig(
                    enabled=True, rubric_id=5, version="tussentijds"
                )
            ),
        )

        with patch("app.api.v1.routers.projects.require_role"):
            with patch(
                "app.api.v1.routers.projects.can_access_course", return_value=True
            ):
                with patch("app.api.v1.routers.projects.log_action"):
                    result = wizard_create_project(payload=payload, db=db, user=user)

                    # Should create 2 ProjectAssessment records (one per group)
                    assert len(result.entities) == 2
                    assert all(e.type == "project_assessment" for e in result.entities)

                    # Check group IDs
                    group_ids = [e.data["group_id"] for e in result.entities]
                    assert 1 in group_ids
                    assert 2 in group_ids

    def test_wizard_warns_when_course_has_no_groups(self):
        """Test that wizard warns when course has no groups for project assessment"""
        db = setup_mock_db()
        user = Mock(spec=User)
        user.school_id = 1
        user.id = 10
        user.role = "teacher"

        def query_side_effect(model):
            query_mock = Mock()
            query_mock.filter = Mock(return_value=query_mock)
            query_mock.first = Mock(return_value=None)
            query_mock.all = Mock(return_value=[])  # No groups

            return query_mock

        db.query = Mock(side_effect=query_side_effect)

        payload = WizardProjectCreate(
            project=ProjectCreate(
                title="Test Project",
                course_id=1,
            ),
            evaluations=EvaluationConfig(
                project_assessment=ProjectAssessmentConfig(
                    enabled=True,
                    rubric_id=5,
                )
            ),
        )

        with patch("app.api.v1.routers.projects.require_role"):
            with patch(
                "app.api.v1.routers.projects.can_access_course", return_value=True
            ):
                with patch("app.api.v1.routers.projects.log_action"):
                    result = wizard_create_project(payload=payload, db=db, user=user)

                    # Should have warning about no groups
                    assert len(result.warnings) > 0
                    assert any("no groups" in w.lower() for w in result.warnings)

                    # Should not create any project assessments
                    assert not any(
                        e.type == "project_assessment" for e in result.entities
                    )


class TestWizardCompetencyScans:
    """Tests for competency scan creation"""

    def test_wizard_creates_competency_window(self):
        """Test that wizard creates CompetencyWindow record"""
        db = setup_mock_db()
        user = Mock(spec=User)
        user.school_id = 1
        user.id = 10
        user.role = "teacher"

        # Mock competencies
        mock_comp1 = Mock(spec=Competency)
        mock_comp1.id = 1
        mock_comp2 = Mock(spec=Competency)
        mock_comp2.id = 2

        def query_side_effect(model):
            query_mock = Mock()
            query_mock.filter = Mock(return_value=query_mock)

            if model == Competency:
                query_mock.all = Mock(return_value=[mock_comp1, mock_comp2])
            else:
                query_mock.first = Mock(return_value=None)
                query_mock.all = Mock(return_value=[])

            return query_mock

        db.query = Mock(side_effect=query_side_effect)

        start = datetime(2025, 1, 1)
        end = datetime(2025, 6, 30)

        payload = WizardProjectCreate(
            project=ProjectCreate(
                title="Test Project",
                course_id=1,
            ),
            evaluations=EvaluationConfig(
                competency_scan=CompetencyScanConfig(
                    enabled=True,
                    start_date=start,
                    end_date=end,
                    competency_ids=[1, 2],
                    title="Q1 Competentiescan",
                )
            ),
        )

        with patch("app.api.v1.routers.projects.require_role"):
            with patch(
                "app.api.v1.routers.projects.can_access_course", return_value=True
            ):
                with patch("app.api.v1.routers.projects.log_action"):
                    result = wizard_create_project(payload=payload, db=db, user=user)

                    # Should create 1 CompetencyWindow
                    assert len(result.entities) == 1
                    assert result.entities[0].type == "competency_scan"
                    assert result.entities[0].data["start_date"] == start.isoformat()
                    assert result.entities[0].data["end_date"] == end.isoformat()
                    assert result.entities[0].data["competency_ids"] == [1, 2]

    def test_wizard_warns_when_competency_ids_invalid(self):
        """Test that wizard warns when some competency IDs are invalid"""
        db = setup_mock_db()
        user = Mock(spec=User)
        user.school_id = 1
        user.id = 10
        user.role = "teacher"

        # Mock only one valid competency out of two
        mock_comp1 = Mock(spec=Competency)
        mock_comp1.id = 1

        def query_side_effect(model):
            query_mock = Mock()
            query_mock.filter = Mock(return_value=query_mock)

            if model == Competency:
                # Only return one competency even though two were requested
                query_mock.all = Mock(return_value=[mock_comp1])
            else:
                query_mock.first = Mock(return_value=None)
                query_mock.all = Mock(return_value=[])

            return query_mock

        db.query = Mock(side_effect=query_side_effect)

        payload = WizardProjectCreate(
            project=ProjectCreate(
                title="Test Project",
                course_id=1,
            ),
            evaluations=EvaluationConfig(
                competency_scan=CompetencyScanConfig(
                    enabled=True,
                    start_date=datetime(2025, 1, 1),
                    end_date=datetime(2025, 6, 30),
                    competency_ids=[1, 999],  # 999 is invalid
                )
            ),
        )

        with patch("app.api.v1.routers.projects.require_role"):
            with patch(
                "app.api.v1.routers.projects.can_access_course", return_value=True
            ):
                with patch("app.api.v1.routers.projects.log_action"):
                    result = wizard_create_project(payload=payload, db=db, user=user)

                    # Should have warning about invalid IDs
                    assert len(result.warnings) > 0
                    assert any("invalid" in w.lower() for w in result.warnings)


class TestWizardMixedEntities:
    """Tests for creating multiple entity types in one wizard run"""

    def test_wizard_creates_mixed_entities(self):
        """Test that wizard can create peer eval, project assessment, and competency scan together"""
        db = setup_mock_db()
        user = Mock(spec=User)
        user.school_id = 1
        user.id = 10
        user.role = "teacher"

        # Mock rubric, groups, and competencies
        mock_rubric = Mock(spec=Rubric)
        mock_rubric.id = 1

        mock_group = Mock(spec=Group)
        mock_group.id = 1
        mock_group.name = "Team 1"

        mock_comp = Mock(spec=Competency)
        mock_comp.id = 1

        def query_side_effect(model):
            query_mock = Mock()
            query_mock.filter = Mock(return_value=query_mock)

            if model == Rubric:
                query_mock.first = Mock(return_value=mock_rubric)
            elif model == Group:
                query_mock.all = Mock(return_value=[mock_group])
            elif model == Competency:
                query_mock.all = Mock(return_value=[mock_comp])
            else:
                query_mock.first = Mock(return_value=None)
                query_mock.all = Mock(return_value=[])

            return query_mock

        db.query = Mock(side_effect=query_side_effect)

        payload = WizardProjectCreate(
            project=ProjectCreate(
                title="Test Project",
                course_id=1,
            ),
            evaluations=EvaluationConfig(
                peer_tussen=PeerEvaluationConfig(
                    enabled=True, title_suffix="tussentijds"
                ),
                project_assessment=ProjectAssessmentConfig(
                    enabled=True,
                    rubric_id=5,
                ),
                competency_scan=CompetencyScanConfig(
                    enabled=True,
                    start_date=datetime(2025, 1, 1),
                    end_date=datetime(2025, 6, 30),
                    competency_ids=[1],
                ),
            ),
        )

        with patch("app.api.v1.routers.projects.require_role"):
            with patch(
                "app.api.v1.routers.projects.can_access_course", return_value=True
            ):
                with patch("app.api.v1.routers.projects.log_action"):
                    result = wizard_create_project(payload=payload, db=db, user=user)

                    # Should create 3 entities
                    assert len(result.entities) == 3

                    # Check types
                    types = [e.type for e in result.entities]
                    assert "peer" in types
                    assert "project_assessment" in types
                    assert "competency_scan" in types
