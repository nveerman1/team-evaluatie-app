# backend/seed_feedback_reflections.py
# Run:  export PYTHONPATH=$PWD ; source venv/bin/activate ; python seed_feedback_reflections.py
import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.infra.db.session import engine
from app.infra.db.models import (
    Evaluation,
    Allocation,
    Score,
    Reflection,
    RubricCriterion,
)

EVAL_ID = 1


def main():
    with Session(engine) as db:
        ev = db.get(Evaluation, EVAL_ID)
        if not ev:
            raise SystemExit(f"Evaluation {EVAL_ID} niet gevonden")

        crit = db.execute(
            select(RubricCriterion)
            .where(RubricCriterion.rubric_id == ev.rubric_id)
            .order_by(RubricCriterion.id)
            .limit(1)
        ).scalar_one_or_none()
        if not crit:
            raise SystemExit(
                f"Geen rubric criterion gevonden voor rubric_id={ev.rubric_id}"
            )

        allocs = (
            db.execute(
                select(Allocation)
                .where(Allocation.evaluation_id == EVAL_ID)
                .order_by(Allocation.id)
                .limit(2)
            )
            .scalars()
            .all()
        )
        if not allocs:
            raise SystemExit(f"Geen allocations gevonden voor evaluation_id={EVAL_ID}")

        texts = [
            "Sterk samengewerkt en helder gecommuniceerd. Goed tempo 👍",
            "Volgende keer iets concreter bij voorbeelden noemen.",
        ]
        scores_values = [4.0, 3.0]  # voorbeeldcijfers binnen schaal

        for i, al in enumerate(allocs):
            sc = db.execute(
                select(Score).where(
                    Score.allocation_id == al.id, Score.criterion_id == crit.id
                )
            ).scalar_one_or_none()
            if sc is None:
                sc = Score(
                    school_id=al.school_id,
                    allocation_id=al.id,
                    criterion_id=crit.id,
                    score=scores_values[i % len(scores_values)],  # <-- score zetten
                    comment=texts[i % len(texts)],
                    status="submitted",
                )
                db.add(sc)
            else:
                # Zorg dat verplichte velden gevuld zijn
                if sc.score is None:
                    sc.score = scores_values[i % len(scores_values)]
                sc.comment = texts[i % len(texts)]
                if not sc.status:
                    sc.status = "submitted"

        # 1 reflectie voor de reviewee van de eerste allocation
        al0 = allocs[0]
        db.add(
            Reflection(
                school_id=al0.school_id,
                evaluation_id=EVAL_ID,
                user_id=al0.reviewee_id,
                text="Ik heb goed geluisterd naar feedback en mijn taakplanning aangepast. Volgende sprint wil ik proactiever vragen om review.",
                word_count=24,
                submitted_at=datetime.datetime.now(datetime.timezone.utc),
            )
        )

        db.commit()
        print(f"Seeded feedback & reflection for evaluation {EVAL_ID}")


if __name__ == "__main__":
    main()
