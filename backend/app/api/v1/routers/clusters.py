from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user

router = APIRouter(prefix="/clusters", tags=["clusters (deprecated)"])


@router.get("")
def list_clusters(
    db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    if current_user is None or getattr(current_user, "school_id", None) is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Niet ingelogd"
        )
    # gebruik de bestaande /students/courses logica
    try:
        from app.infra.db.models import Course
    except Exception:
        return []
    rows = (
        db.query(Course)
        .filter(Course.school_id == current_user.school_id)
        .order_by(Course.name.asc())
        .all()
    )
    return [
        {
            "value": getattr(c, "name", f"Course {c.id}"),
            "label": getattr(c, "name", f"Course {c.id}"),
        }
        for c in rows
    ]
