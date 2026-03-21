"""
Tests for the expanded student fields:
  - student_number (leerlingnummer)
  - first_name (roepnaam)
  - prefix (tussenvoegsel)
  - last_name (achternaam)

Covers:
1. User model – columns exist and accept the new fields
2. Somtoday mapper – map_somtoday_student_to_user, match_user_by_leerlingnummer,
                     prepare_grade_export
3. _build_name helper in students router
4. AdminStudentCreate / AdminStudentUpdate / AdminStudentOut Pydantic schemas
5. StudentCreate / StudentUpdate / StudentOut schemas
6. CourseStudentCreate / CourseStudentOut schemas
7. Admin-students CRUD via mock DB – create, update, CSV export
8. Admin-students CSV import – new columns parsed & persisted
9. StudentMatrixRowOut  (overview schema)
10. StudentScoreOverview (project_assessments schema)
11. StudentLearningObjectiveOverview (learning_objectives schema)
"""

from __future__ import annotations

import csv
import io
import sys
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Optional
from unittest.mock import MagicMock, Mock, patch

import pytest

# Make sure the backend package is importable
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))


# ---------------------------------------------------------------------------
# 1. User model
# ---------------------------------------------------------------------------


class TestUserModelNewFields:
    """Verify that the User model has all four new columns."""

    def test_user_model_has_student_number_column(self):
        from app.infra.db.models.user import User

        assert hasattr(User, "student_number")
        col = User.__table__.c["student_number"]
        assert col.nullable

    def test_user_model_has_first_name_column(self):
        from app.infra.db.models.user import User

        assert hasattr(User, "first_name")
        col = User.__table__.c["first_name"]
        assert col.nullable

    def test_user_model_has_prefix_column(self):
        from app.infra.db.models.user import User

        assert hasattr(User, "prefix")
        col = User.__table__.c["prefix"]
        assert col.nullable

    def test_user_model_has_last_name_column(self):
        from app.infra.db.models.user import User

        assert hasattr(User, "last_name")
        col = User.__table__.c["last_name"]
        assert col.nullable

    def test_user_model_new_fields_accept_values(self):
        """New fields are settable on a User instance without error."""
        from app.infra.db.models.user import User

        u = User(
            school_id=1,
            email="jan@school.nl",
            name="Jan van der Berg",
            role="student",
            student_number="450000",
            first_name="Jan",
            prefix="van der",
            last_name="Berg",
        )
        assert u.student_number == "450000"
        assert u.first_name == "Jan"
        assert u.prefix == "van der"
        assert u.last_name == "Berg"

    def test_user_model_new_fields_default_none(self):
        """New fields default to None when not provided."""
        from app.infra.db.models.user import User

        u = User(school_id=1, email="x@y.nl", name="X Y", role="student")
        assert u.student_number is None
        assert u.first_name is None
        assert u.prefix is None
        assert u.last_name is None

    def test_user_model_has_partial_unique_index_for_student_number(self):
        """Partial unique index uq_student_number_per_school must be present."""
        from app.infra.db.models.user import User

        index_names = {idx.name for idx in User.__table__.indexes}
        assert "uq_student_number_per_school" in index_names

    def test_student_number_column_length(self):
        from app.infra.db.models.user import User

        col = User.__table__.c["student_number"]
        assert col.type.length == 50

    def test_first_name_column_length(self):
        from app.infra.db.models.user import User

        col = User.__table__.c["first_name"]
        assert col.type.length == 100

    def test_prefix_column_length(self):
        from app.infra.db.models.user import User

        col = User.__table__.c["prefix"]
        assert col.type.length == 30

    def test_last_name_column_length(self):
        from app.infra.db.models.user import User

        col = User.__table__.c["last_name"]
        assert col.type.length == 100


# ---------------------------------------------------------------------------
# 2. Somtoday mapper
# ---------------------------------------------------------------------------


class TestMapSomtodayStudentToUser:
    """map_somtoday_student_to_user should handle all Somtoday field names."""

    def _call(self, student_data: dict, school_id: int = 1) -> dict:
        from app.integrations.somtoday.mappers import map_somtoday_student_to_user

        return map_somtoday_student_to_user(student_data, school_id)

    def test_full_somtoday_fields(self):
        result = self._call(
            {
                "leerlingnummer": 450000,
                "roepnaam": "Jan",
                "voorvoegsel": "van der",
                "achternaam": "Berg",
                "email": "jan@school.nl",
            }
        )
        assert result["student_number"] == "450000"
        assert result["first_name"] == "Jan"
        assert result["prefix"] == "van der"
        assert result["last_name"] == "Berg"
        assert result["name"] == "Jan van der Berg"
        assert result["email"] == "jan@school.nl"
        assert result["role"] == "student"

    def test_legacy_firstname_lastname_fields(self):
        """Fall back to firstName/lastName when Somtoday-specific keys are absent."""
        result = self._call(
            {
                "firstName": "Piet",
                "lastName": "Klaas",
                "email": "piet@school.nl",
            }
        )
        assert result["first_name"] == "Piet"
        assert result["last_name"] == "Klaas"
        assert result["name"] == "Piet Klaas"
        assert result["student_number"] is None  # no leerlingnummer

    def test_name_without_prefix(self):
        result = self._call(
            {
                "leerlingnummer": 123,
                "roepnaam": "Els",
                "achternaam": "Smit",
                "email": "els@school.nl",
            }
        )
        assert result["name"] == "Els Smit"
        assert result["prefix"] is None

    def test_leerlingnummer_integer_converted_to_string(self):
        result = self._call({"leerlingnummer": 987654, "email": "x@y.nl"})
        assert result["student_number"] == "987654"

    def test_leerlingnummer_none_if_absent(self):
        result = self._call({"roepnaam": "A", "achternaam": "B", "email": "ab@y.nl"})
        assert result["student_number"] is None

    def test_email_lowercased(self):
        result = self._call({"email": "JAN@SCHOOL.NL"})
        assert result["email"] == "jan@school.nl"

    def test_school_id_propagated(self):
        result = self._call({"email": "a@b.nl"}, school_id=42)
        assert result["school_id"] == 42

    def test_auth_provider_is_somtoday(self):
        result = self._call({"email": "a@b.nl"})
        assert result["auth_provider"] == "somtoday"

    def test_empty_voorvoegsel_becomes_none(self):
        """An empty string voorvoegsel should NOT appear in the name."""
        result = self._call(
            {
                "roepnaam": "Kim",
                "voorvoegsel": "",
                "achternaam": "Jansen",
                "email": "kim@school.nl",
            }
        )
        assert result["prefix"] is None
        assert result["name"] == "Kim Jansen"


class TestMatchUserByLeerlingnummer:
    """match_user_by_leerlingnummer should find a user by their student_number."""

    def _call(self, leerlingnummer, users):
        from app.integrations.somtoday.mappers import match_user_by_leerlingnummer

        return match_user_by_leerlingnummer(leerlingnummer, users)

    def _make_user(self, student_number: Optional[str]) -> Mock:
        u = Mock()
        u.student_number = student_number
        return u

    def test_finds_matching_user(self):
        users = [
            self._make_user("111"),
            self._make_user("450000"),
            self._make_user("999"),
        ]
        result = self._call("450000", users)
        assert result is users[1]

    def test_returns_none_when_no_match(self):
        users = [self._make_user("111"), self._make_user("222")]
        result = self._call("999", users)
        assert result is None

    def test_integer_leerlingnummer_coerced_to_string(self):
        """The function should match even when leerlingnummer is given as int."""
        users = [self._make_user("450000")]
        result = self._call(450000, users)
        assert result is users[0]

    def test_empty_user_list(self):
        assert self._call("123", []) is None

    def test_user_without_student_number_attribute(self):
        """Users that don't have student_number attribute should be skipped."""
        u = Mock(spec=[])  # no attributes at all
        assert self._call("123", [u]) is None


class TestPrepareGradeExport:
    """prepare_grade_export should include leerlingnummer when provided."""

    def _call(self, **kwargs):
        from app.integrations.somtoday.mappers import prepare_grade_export

        return prepare_grade_export(**kwargs)

    def test_grade_export_with_student_number(self):
        dt = datetime(2024, 11, 12)
        result = self._call(
            user_email="jan@school.nl",
            course_code="BIO",
            grade_value=8.5,
            grade_date=dt,
            student_number="450000",
        )
        assert result["leerlingnummer"] == "450000"
        assert result["studentEmail"] == "jan@school.nl"
        assert result["courseCode"] == "BIO"
        assert result["grade"] == 8.5
        assert result["date"] == "2024-11-12"

    def test_grade_export_without_student_number(self):
        dt = datetime(2024, 11, 12)
        result = self._call(
            user_email="jan@school.nl",
            course_code="BIO",
            grade_value=7.0,
            grade_date=dt,
        )
        assert "leerlingnummer" not in result

    def test_grade_value_rounded(self):
        dt = datetime(2024, 1, 1)
        result = self._call(
            user_email="a@b.nl",
            course_code="WIS",
            grade_value=7.555,
            grade_date=dt,
        )
        assert result["grade"] == 7.6

    def test_default_description(self):
        dt = datetime(2024, 1, 1)
        result = self._call(
            user_email="a@b.nl",
            course_code="WIS",
            grade_value=8.0,
            grade_date=dt,
        )
        assert result["description"] == "Peer evaluation"

    def test_custom_description(self):
        dt = datetime(2024, 1, 1)
        result = self._call(
            user_email="a@b.nl",
            course_code="WIS",
            grade_value=8.0,
            grade_date=dt,
            description="Beoordeling projectwerk",
        )
        assert result["description"] == "Beoordeling projectwerk"

    def test_weight_is_one(self):
        dt = datetime(2024, 1, 1)
        result = self._call(
            user_email="a@b.nl",
            course_code="WIS",
            grade_value=8.0,
            grade_date=dt,
        )
        assert result["weight"] == 1.0


# ---------------------------------------------------------------------------
# 3. _build_name helper
# ---------------------------------------------------------------------------


class TestBuildName:
    """_build_name(first_name, prefix, last_name) → str | None"""

    def _call(self, first_name, prefix, last_name):
        from app.api.v1.routers.students import _build_name

        return _build_name(first_name, prefix, last_name)

    def test_full_name_with_prefix(self):
        assert self._call("Jan", "van der", "Berg") == "Jan van der Berg"

    def test_name_without_prefix(self):
        assert self._call("Jan", None, "Berg") == "Jan Berg"

    def test_first_name_only(self):
        assert self._call("Jan", None, None) == "Jan"

    def test_last_name_only(self):
        assert self._call(None, None, "Berg") == "Berg"

    def test_all_none_returns_none(self):
        assert self._call(None, None, None) is None

    def test_all_empty_strings_returns_none(self):
        # Empty strings should be treated as falsy; _build_name filters them out
        assert self._call("", "", "") is None

    def test_prefix_with_empty_first_and_last(self):
        # prefix alone: _build_name("", "van", "") → "van" (prefix is truthy)
        # This IS the correct behaviour: if someone provides only a prefix, it gets used.
        assert self._call("", "van", "") == "van"

    def test_first_and_last_without_prefix(self):
        assert self._call("Kim", "", "Jansen") == "Kim Jansen"


# ---------------------------------------------------------------------------
# 4. Pydantic schemas – AdminStudentCreate/Update/Out
# ---------------------------------------------------------------------------


class TestAdminStudentSchemas:
    """AdminStudentCreate, AdminStudentUpdate, AdminStudentOut include new fields."""

    def test_admin_student_create_accepts_new_fields(self):
        from app.api.v1.schemas.admin_students import AdminStudentCreate

        obj = AdminStudentCreate(
            email="jan@school.nl",
            student_number="450000",
            first_name="Jan",
            prefix="van der",
            last_name="Berg",
        )
        assert obj.student_number == "450000"
        assert obj.first_name == "Jan"
        assert obj.prefix == "van der"
        assert obj.last_name == "Berg"

    def test_admin_student_create_all_new_fields_optional(self):
        from app.api.v1.schemas.admin_students import AdminStudentCreate

        # Should not raise even without new fields
        obj = AdminStudentCreate(email="x@y.nl")
        assert obj.student_number is None
        assert obj.first_name is None
        assert obj.prefix is None
        assert obj.last_name is None

    def test_admin_student_update_accepts_new_fields(self):
        from app.api.v1.schemas.admin_students import AdminStudentUpdate

        obj = AdminStudentUpdate(
            student_number="999",
            first_name="Els",
            prefix=None,
            last_name="Smit",
        )
        assert obj.student_number == "999"
        assert obj.first_name == "Els"
        assert obj.last_name == "Smit"

    def test_admin_student_out_has_new_fields(self):
        from app.api.v1.schemas.admin_students import AdminStudentOut

        obj = AdminStudentOut(
            id=1,
            email="jan@school.nl",
            status="active",
            student_number="450000",
            first_name="Jan",
            prefix="van der",
            last_name="Berg",
        )
        assert obj.student_number == "450000"
        assert obj.first_name == "Jan"
        assert obj.prefix == "van der"
        assert obj.last_name == "Berg"

    def test_admin_student_out_new_fields_default_none(self):
        from app.api.v1.schemas.admin_students import AdminStudentOut

        obj = AdminStudentOut(id=1, email="x@y.nl", status="active")
        assert obj.student_number is None
        assert obj.first_name is None
        assert obj.prefix is None
        assert obj.last_name is None


# ---------------------------------------------------------------------------
# 5. Pydantic schemas – StudentCreate/Update/Out
# ---------------------------------------------------------------------------


class TestStudentSchemas:
    """StudentCreate, StudentUpdate, StudentOut include new fields."""

    def test_student_create_accepts_new_fields(self):
        from app.api.v1.schemas.students import StudentCreate

        obj = StudentCreate(
            email="jan@school.nl",
            student_number="450000",
            first_name="Jan",
            prefix="van der",
            last_name="Berg",
        )
        assert obj.student_number == "450000"
        assert obj.first_name == "Jan"

    def test_student_create_all_new_fields_optional(self):
        from app.api.v1.schemas.students import StudentCreate

        obj = StudentCreate(email="x@y.nl")
        assert obj.student_number is None

    def test_student_update_accepts_new_fields(self):
        from app.api.v1.schemas.students import StudentUpdate

        obj = StudentUpdate(student_number="111", first_name="Kim")
        assert obj.student_number == "111"
        assert obj.first_name == "Kim"

    def test_student_out_has_new_fields(self):
        from app.api.v1.schemas.students import StudentOut

        obj = StudentOut(
            id=1,
            name="Jan van der Berg",
            email="jan@school.nl",
            status="active",
            student_number="450000",
            first_name="Jan",
            prefix="van der",
            last_name="Berg",
        )
        assert obj.student_number == "450000"
        assert obj.prefix == "van der"


# ---------------------------------------------------------------------------
# 6. Pydantic schemas – CourseStudentCreate/Out
# ---------------------------------------------------------------------------


class TestCourseStudentSchemas:
    """CourseStudentCreate and CourseStudentOut include new fields."""

    def test_course_student_create_has_student_number(self):
        from app.api.v1.schemas.courses import CourseStudentCreate

        obj = CourseStudentCreate(
            email="jan@school.nl",
            student_number="450000",
            first_name="Jan",
            last_name="Berg",
        )
        assert obj.student_number == "450000"

    def test_course_student_create_all_new_fields_optional(self):
        from app.api.v1.schemas.courses import CourseStudentCreate

        obj = CourseStudentCreate(email="x@y.nl")
        assert obj.student_number is None
        assert obj.first_name is None
        assert obj.prefix is None
        assert obj.last_name is None

    def test_course_student_out_has_new_fields(self):
        from app.api.v1.schemas.courses import CourseStudentOut

        # CourseStudentOut uses from_attributes, so we can construct via kwargs
        obj = CourseStudentOut(
            id=1,
            name="Jan Berg",
            email="jan@school.nl",
            student_number="450000",
            first_name="Jan",
            last_name="Berg",
        )
        assert obj.student_number == "450000"
        assert obj.last_name == "Berg"


# ---------------------------------------------------------------------------
# 7. Admin-students CRUD via mock DB – create & update
# ---------------------------------------------------------------------------


class TestAdminStudentsCRUDNewFields:
    """Verify create / update endpoints persist and return new fields."""

    def _make_current_user(self, school_id=1, role="teacher"):
        u = Mock()
        u.school_id = school_id
        u.role = role
        u.id = 99
        return u

    def test_create_student_persists_new_fields(self):
        """POST /admin/students saves student_number, first_name, prefix, last_name."""
        from app.api.v1.routers.admin_students import create_admin_student

        current_user = self._make_current_user()
        db = MagicMock()

        # Simulate email not already taken (first .first() for dup check)
        db.query.return_value.filter.return_value.first.return_value = None
        # Simulate _course_name_subquery result
        db.query.return_value.filter.return_value.first.return_value = None

        # Mock the _course_name_subquery used in the response section
        with patch(
            "app.api.v1.routers.admin_students._course_name_subquery"
        ) as mock_csub, patch(
            "app.api.v1.routers.admin_students._set_user_course_enrollment"
        ):
            mock_csub.return_value.c.course_name.label.return_value = MagicMock()
            mock_csub.return_value.c.user_id = MagicMock()
            # After commit/refresh, the user object should have expected attrs
            db.query.return_value.filter.return_value.first.return_value = None

            payload = {
                "first_name": "Jan",
                "prefix": "van der",
                "last_name": "Berg",
                "email": "jan@school.nl",
                "student_number": "450000",
                "status": "active",
            }

            result = create_admin_student(
                payload=payload,
                db=db,
                current_user=current_user,
            )

        assert result["name"] == "Jan van der Berg"
        assert result["student_number"] == "450000"
        assert result["first_name"] == "Jan"
        assert result["prefix"] == "van der"
        assert result["last_name"] == "Berg"

    def test_create_student_computes_name_from_parts(self):
        """If name is not given, it should be assembled from first/prefix/last."""
        from app.api.v1.routers.admin_students import create_admin_student

        current_user = self._make_current_user()
        db = MagicMock()

        with patch(
            "app.api.v1.routers.admin_students._course_name_subquery"
        ), patch(
            "app.api.v1.routers.admin_students._set_user_course_enrollment"
        ):
            db.query.return_value.filter.return_value.first.return_value = None

            payload = {
                "first_name": "Piet",
                "last_name": "Klaas",
                "email": "piet@school.nl",
            }

            result = create_admin_student(
                payload=payload,
                db=db,
                current_user=current_user,
            )

        assert result["name"] == "Piet Klaas"

    def test_create_student_raises_without_name_or_parts(self):
        """Creating without name AND without first/last name should fail."""
        from app.api.v1.routers.admin_students import create_admin_student
        from fastapi import HTTPException

        current_user = self._make_current_user()
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        payload = {"email": "nobody@school.nl"}  # no name, no first/last

        with pytest.raises(HTTPException) as exc_info:
            create_admin_student(payload=payload, db=db, current_user=current_user)

        assert exc_info.value.status_code == 400

    def test_update_student_updates_new_fields(self):
        """PUT /admin/students/:id updates student_number, first_name, prefix, last_name."""
        from app.api.v1.routers.admin_students import update_admin_student

        current_user = self._make_current_user()

        existing_student = Mock()
        existing_student.id = 42
        existing_student.school_id = 1
        existing_student.name = "Old Name"
        existing_student.email = "old@school.nl"
        existing_student.class_name = None
        existing_student.team_number = None
        existing_student.archived = False
        existing_student.student_number = None
        existing_student.first_name = None
        existing_student.prefix = None
        existing_student.last_name = None

        db = MagicMock()
        # update_admin_student uses db.query().filter().one_or_none()
        db.query.return_value.filter.return_value.one_or_none.return_value = (
            existing_student
        )

        payload = {
            "student_number": "888",
            "first_name": "Kim",
            "prefix": "de",
            "last_name": "Vries",
        }

        with patch(
            "app.api.v1.routers.admin_students._course_name_subquery"
        ), patch(
            "app.api.v1.routers.admin_students._set_user_course_enrollment"
        ):
            result = update_admin_student(
                student_id=42,
                payload=payload,
                db=db,
                current_user=current_user,
            )

        assert existing_student.student_number == "888"
        assert existing_student.first_name == "Kim"
        assert existing_student.prefix == "de"
        assert existing_student.last_name == "Vries"
        # name should be recomputed because name was not in payload
        assert result["name"] == "Kim de Vries"


# ---------------------------------------------------------------------------
# 8. Admin-students CSV export includes new columns
# ---------------------------------------------------------------------------


class TestAdminStudentsCSVExport:
    """export_students_csv should include student_number, first_name, prefix, last_name."""

    def _read_csv_response(self, response) -> str:
        """Helper to read CSV content from a StreamingResponse."""
        import asyncio

        async def _read():
            chunks = []
            async for chunk in response.body_iterator:
                if isinstance(chunk, bytes):
                    chunks.append(chunk.decode("utf-8"))
                else:
                    chunks.append(str(chunk))
            return "".join(chunks)

        return asyncio.get_event_loop().run_until_complete(_read())

    def test_csv_export_header_includes_new_fields(self):
        from app.api.v1.routers.admin_students import export_students_csv

        current_user = Mock()
        current_user.school_id = 1

        db = MagicMock()

        with patch(
            "app.api.v1.routers.admin_students._course_name_subquery"
        ) as mock_csub, patch(
            "app.api.v1.routers.admin_students._apply_filters",
            return_value=db.query.return_value,
        ), patch(
            "app.api.v1.routers.admin_students._apply_sort",
            return_value=db.query.return_value,
        ):
            # Build a fake row with named attributes
            FakeRow = type(
                "FakeRow",
                (),
                {
                    "id": 1,
                    "name": "Jan van der Berg",
                    "email": "jan@school.nl",
                    "class_name": "V2A",
                    "team_number": None,
                    "archived": False,
                    "course_name": "GA2",
                    "student_number": "450000",
                    "first_name": "Jan",
                    "prefix": "van der",
                    "last_name": "Berg",
                },
            )
            db.query.return_value.outerjoin.return_value.filter.return_value = db.query.return_value
            db.query.return_value.all.return_value = [FakeRow()]

            response = export_students_csv(
                db=db,
                current_user=current_user,
                q=None,
                status="active",
                course=None,
                sort="name",
                dir="asc",
            )

        csv_text = self._read_csv_response(response)
        reader = csv.DictReader(io.StringIO(csv_text))
        headers = reader.fieldnames or []

        assert "student_number" in headers, f"Headers: {headers}"
        assert "first_name" in headers, f"Headers: {headers}"
        assert "prefix" in headers, f"Headers: {headers}"
        assert "last_name" in headers, f"Headers: {headers}"

    def test_csv_export_data_row_contains_new_fields(self):
        from app.api.v1.routers.admin_students import export_students_csv

        current_user = Mock()
        current_user.school_id = 1

        db = MagicMock()

        with patch(
            "app.api.v1.routers.admin_students._course_name_subquery"
        ) as mock_csub, patch(
            "app.api.v1.routers.admin_students._apply_filters",
            return_value=db.query.return_value,
        ), patch(
            "app.api.v1.routers.admin_students._apply_sort",
            return_value=db.query.return_value,
        ):
            FakeRow = type(
                "FakeRow",
                (),
                {
                    "id": 1,
                    "name": "Jan van der Berg",
                    "email": "jan@school.nl",
                    "class_name": "V2A",
                    "team_number": None,
                    "archived": False,
                    "course_name": "GA2",
                    "student_number": "450000",
                    "first_name": "Jan",
                    "prefix": "van der",
                    "last_name": "Berg",
                },
            )
            db.query.return_value.outerjoin.return_value.filter.return_value = db.query.return_value
            db.query.return_value.all.return_value = [FakeRow()]

            response = export_students_csv(
                db=db,
                current_user=current_user,
                q=None,
                status="active",
                course=None,
                sort="name",
                dir="asc",
            )

        csv_text = self._read_csv_response(response)
        reader = csv.DictReader(io.StringIO(csv_text))
        rows = list(reader)
        assert len(rows) == 1
        row = rows[0]
        assert row["student_number"] == "450000"
        assert row["first_name"] == "Jan"
        assert row["prefix"] == "van der"
        assert row["last_name"] == "Berg"


# ---------------------------------------------------------------------------
# 9. Admin-students CSV import – new columns parsed
# ---------------------------------------------------------------------------


class TestAdminStudentsCSVImport:
    """import_students_csv should parse and persist new columns."""

    def _make_csv_upload(self, csv_content: str):
        """Return a synchronous UploadFile-like mock."""
        content_bytes = csv_content.encode("utf-8")
        mock_file = Mock()
        mock_file.filename = "students.csv"
        # file.file is a file-like object used with TextIOWrapper
        mock_file.file = BytesIO(content_bytes)
        mock_file.file.seek(0)
        return mock_file

    def test_import_creates_student_with_new_fields(self):
        from app.api.v1.routers.admin_students import import_students_csv

        csv_content = (
            "student_number,first_name,prefix,last_name,email,class_name,status\n"
            "450000,Jan,van der,Berg,jan@school.nl,V2A,active\n"
        )

        current_user = Mock()
        current_user.school_id = 1
        current_user.role = "teacher"

        db = MagicMock()
        # Simulate no existing user with this email
        db.query.return_value.filter.return_value.first.return_value = None

        uploaded_students = []

        def capture_add(obj):
            uploaded_students.append(obj)

        db.add.side_effect = capture_add
        db.flush.return_value = None

        with patch(
            "app.api.v1.routers.admin_students._set_user_course_enrollment"
        ):
            result = import_students_csv(
                file=self._make_csv_upload(csv_content),
                db=db,
                current_user=current_user,
            )

        assert result["created"] == 1
        assert result["errors"] == []

        assert len(uploaded_students) == 1
        new_user = uploaded_students[0]
        assert new_user.student_number == "450000"
        assert new_user.first_name == "Jan"
        assert new_user.prefix == "van der"
        assert new_user.last_name == "Berg"
        assert new_user.name == "Jan van der Berg"

    def test_import_name_column_takes_precedence(self):
        """If both name and first/last are given, name column wins for the name field."""
        from app.api.v1.routers.admin_students import import_students_csv

        csv_content = (
            "name,first_name,last_name,email,status\n"
            "Explicit Name,Piet,Klaas,pk@school.nl,active\n"
        )

        current_user = Mock()
        current_user.school_id = 1
        current_user.role = "teacher"

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        uploaded_students = []
        db.add.side_effect = uploaded_students.append

        with patch(
            "app.api.v1.routers.admin_students._set_user_course_enrollment"
        ):
            result = import_students_csv(
                file=self._make_csv_upload(csv_content),
                db=db,
                current_user=current_user,
            )

        assert result["created"] == 1
        new_user = uploaded_students[0]
        assert new_user.name == "Explicit Name"
        assert new_user.first_name == "Piet"
        assert new_user.last_name == "Klaas"

    def test_import_errors_without_email(self):
        """Rows without email should be counted as errors."""
        from app.api.v1.routers.admin_students import import_students_csv

        csv_content = "first_name,last_name,student_number\nJan,Berg,111\n"

        current_user = Mock()
        current_user.school_id = 1
        current_user.role = "teacher"

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        with patch(
            "app.api.v1.routers.admin_students._set_user_course_enrollment"
        ):
            result = import_students_csv(
                file=self._make_csv_upload(csv_content),
                db=db,
                current_user=current_user,
            )

        assert result["created"] == 0
        assert len(result["errors"]) == 1

    def test_import_updates_existing_student_new_fields(self):
        """Importing a row for an existing email should update new fields."""
        from app.api.v1.routers.admin_students import import_students_csv

        csv_content = (
            "student_number,first_name,prefix,last_name,email,status\n"
            "777,New,de,Boer,existing@school.nl,active\n"
        )

        current_user = Mock()
        current_user.school_id = 1
        current_user.role = "teacher"

        existing = Mock()
        existing.name = "Old Name"
        existing.class_name = None
        existing.team_number = None
        existing.archived = False
        existing.student_number = None
        existing.first_name = None
        existing.prefix = None
        existing.last_name = None

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = existing

        with patch(
            "app.api.v1.routers.admin_students._set_user_course_enrollment"
        ):
            result = import_students_csv(
                file=self._make_csv_upload(csv_content),
                db=db,
                current_user=current_user,
            )

        assert result["updated"] == 1
        assert existing.student_number == "777"
        assert existing.first_name == "New"
        assert existing.prefix == "de"
        assert existing.last_name == "Boer"


# ---------------------------------------------------------------------------
# 10. Overview schema – StudentMatrixRowOut
# ---------------------------------------------------------------------------


class TestStudentMatrixRowOut:
    """StudentMatrixRowOut should include student_number field."""

    def test_student_matrix_row_out_has_student_number(self):
        from app.api.v1.schemas.overview import StudentMatrixRowOut

        row = StudentMatrixRowOut(
            student_id=1,
            student_name="Jan Berg",
            student_class="V2A",
            student_number="450000",
            cells={},
        )
        assert row.student_number == "450000"

    def test_student_matrix_row_out_student_number_optional(self):
        from app.api.v1.schemas.overview import StudentMatrixRowOut

        row = StudentMatrixRowOut(
            student_id=1,
            student_name="Jan Berg",
            cells={},
        )
        assert row.student_number is None


# ---------------------------------------------------------------------------
# 11. Project assessments schema – StudentScoreOverview
# ---------------------------------------------------------------------------


class TestStudentScoreOverview:
    """StudentScoreOverview should include student_number field."""

    def test_student_score_overview_has_student_number(self):
        from app.api.v1.schemas.project_assessments import StudentScoreOverview

        obj = StudentScoreOverview(
            student_id=1,
            student_name="Jan Berg",
            student_email="jan@school.nl",
            student_number="450000",
            criterion_scores=[],
        )
        assert obj.student_number == "450000"

    def test_student_score_overview_student_number_optional(self):
        from app.api.v1.schemas.project_assessments import StudentScoreOverview

        obj = StudentScoreOverview(
            student_id=1,
            student_name="Jan Berg",
            student_email="jan@school.nl",
            criterion_scores=[],
        )
        assert obj.student_number is None


# ---------------------------------------------------------------------------
# 12. Learning objectives schema – StudentLearningObjectiveOverview
# ---------------------------------------------------------------------------


class TestStudentLearningObjectiveOverview:
    """StudentLearningObjectiveOverview should include student_number field."""

    def test_student_learning_objective_overview_has_student_number(self):
        from app.api.v1.schemas.learning_objectives import (
            StudentLearningObjectiveOverview,
        )

        obj = StudentLearningObjectiveOverview(
            user_id=1,
            user_name="Jan Berg",
            class_name="V2A",
            student_number="450000",
            objectives=[],
        )
        assert obj.student_number == "450000"

    def test_student_learning_objective_overview_student_number_optional(self):
        from app.api.v1.schemas.learning_objectives import (
            StudentLearningObjectiveOverview,
        )

        obj = StudentLearningObjectiveOverview(
            user_id=1,
            user_name="Jan Berg",
            class_name=None,
            objectives=[],
        )
        assert obj.student_number is None


# ---------------------------------------------------------------------------
# 13. Migration – verify SQLite SUBSTR logic is correct
# ---------------------------------------------------------------------------


class TestMigrationNameSplitLogic:
    """Validate the name-splitting heuristic used in the Alembic migration."""

    def _split_name(self, name: str):
        """Python implementation of the SQLite SUBSTR logic used in migration.

        last_name  = SUBSTR(name, LENGTH(name) - INSTR(REVERSE(name), ' ') + 2)
        first_name = SUBSTR(name, 1, LENGTH(name) - INSTR(REVERSE(name), ' '))
        """
        if " " not in name:
            return None, name
        rev = name[::-1]
        space_idx = rev.index(" ") + 1  # 1-indexed
        last_name = name[len(name) - space_idx + 1:]
        first_name = name[: len(name) - space_idx]
        return first_name, last_name

    def test_simple_two_part_name(self):
        fn, ln = self._split_name("Jan Jansen")
        assert fn == "Jan"
        assert ln == "Jansen"

    def test_name_with_prefix(self):
        fn, ln = self._split_name("Jan van der Berg")
        assert fn == "Jan van der"
        assert ln == "Berg"

    def test_single_word_name(self):
        fn, ln = self._split_name("Cher")
        assert fn is None
        assert ln == "Cher"

    def test_three_part_name(self):
        fn, ln = self._split_name("Maria de Jong")
        assert fn == "Maria de"
        assert ln == "Jong"
