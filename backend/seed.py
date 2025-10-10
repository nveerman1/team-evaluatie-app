from __future__ import annotations
from app.infra.db.session import SessionLocal
from app.infra.db.models import (
    School,
    User,
    Course,
    Group,
    GroupMember,
    Rubric,
    RubricCriterion,
    Evaluation,
    Allocation,
)


def get_or_create(db, model, defaults=None, **kwargs):
    inst = db.query(model).filter_by(**kwargs).first()
    if inst:
        return inst, False
    params = dict(kwargs)
    if defaults:
        params.update(defaults)
    inst = model(**params)
    db.add(inst)
    db.flush()
    return inst, True


def main():
    db = SessionLocal()
    try:
        # 1) School
        school, _ = get_or_create(db, School, name="Demo School")

        # 2) Users (3 leerlingen, 1 docent)
        s1, _ = get_or_create(
            db,
            User,
            school_id=school.id,
            email="student1@example.com",
            defaults=dict(name="Student 1", role="student", auth_provider="local"),
        )
        s2, _ = get_or_create(
            db,
            User,
            school_id=school.id,
            email="student2@example.com",
            defaults=dict(name="Student 2", role="student", auth_provider="local"),
        )
        s3, _ = get_or_create(
            db,
            User,
            school_id=school.id,
            email="student3@example.com",
            defaults=dict(name="Student 3", role="student", auth_provider="local"),
        )
        teacher, _ = get_or_create(
            db,
            User,
            school_id=school.id,
            email="docent@example.com",
            defaults=dict(name="Docent Demo", role="teacher", auth_provider="local"),
        )

        # 3) Course
        course, _ = get_or_create(
            db, Course, school_id=school.id, name="O&O 4V", period="2025-1"
        )

        # 4) Groups
        gA, _ = get_or_create(
            db, Group, school_id=school.id, course_id=course.id, name="Team A"
        )
        gB, _ = get_or_create(
            db, Group, school_id=school.id, course_id=course.id, name="Team B"
        )

        # 5) GroupMembers
        def add_member(group, user, role="lid"):
            gm, created = get_or_create(
                db,
                GroupMember,
                school_id=school.id,
                group_id=group.id,
                user_id=user.id,
                defaults=dict(role_in_team=role, active=True),
            )
            return gm

        add_member(gA, s1, "lead")
        add_member(gA, s2, "lid")
        add_member(gB, s3, "lead")

        # 6) Rubric
        rubric, _ = get_or_create(
            db,
            Rubric,
            school_id=school.id,
            title="Samenwerking (MVP)",
            defaults=dict(
                description="Basis rubric voor peer review",
                scale_min=1,
                scale_max=5,
                metadata_json={},
            ),
        )

        crit1, _ = get_or_create(
            db,
            RubricCriterion,
            school_id=school.id,
            rubric_id=rubric.id,
            name="Voorbereidheid",
            defaults=dict(
                weight=1.0,
                descriptors={
                    "1": "Zelden voorbereid",
                    "3": "Meestal",
                    "5": "Altijd en proactief",
                },
            ),
        )
        crit2, _ = get_or_create(
            db,
            RubricCriterion,
            school_id=school.id,
            rubric_id=rubric.id,
            name="Samenwerking",
            defaults=dict(
                weight=1.5,
                descriptors={
                    "1": "Blokkeert",
                    "3": "Neutraal",
                    "5": "Trekt team omhoog",
                },
            ),
        )
        crit3, _ = get_or_create(
            db,
            RubricCriterion,
            school_id=school.id,
            rubric_id=rubric.id,
            name="Verantwoordelijkheid",
            defaults=dict(
                weight=1.0,
                descriptors={
                    "1": "Komt afspraken niet na",
                    "3": "Meestal wel",
                    "5": "Altijd, neemt initiatief",
                },
            ),
        )

        # 7) Evaluation
        evaluation, _ = get_or_create(
            db,
            Evaluation,
            school_id=school.id,
            course_id=course.id,
            rubric_id=rubric.id,
            title="Tussenreview sprint 1",
            defaults=dict(
                settings={
                    "anonymity": "pseudonym",
                    "min_words": 50,
                    "min_cf": 0.6,
                    "max_cf": 1.4,
                    "smoothing": True,
                    "reviewer_rating": True,
                    "deadline_reviews": None,
                    "deadline_reflection": None,
                },
                status="open",
            ),
        )

        # 8) Allocations (Team A: s1 <-> s2; plus ieders zelfbeoordeling)
        def alloc(reviewer, reviewee, is_self=False):
            al, _ = get_or_create(
                db,
                Allocation,
                school_id=school.id,
                evaluation_id=evaluation.id,
                reviewer_id=reviewer.id,
                reviewee_id=reviewee.id,
                defaults=dict(is_self=is_self),
            )
            return al

        alloc(s1, s1, True)
        alloc(s2, s2, True)
        alloc(s1, s2, False)
        alloc(s2, s1, False)

        db.commit()
        print("✅ Seed klaar:")
        print(
            f"School id={school.id}, Course id={course.id}, Evaluation id={evaluation.id}"
        )
        print(f"Users: {s1.email}, {s2.email}, {s3.email}, {teacher.email}")
        print(f"Groups: {gA.name}, {gB.name}")
        print("Allocations toegevoegd voor Team A (incl. self).")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
