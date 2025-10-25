from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    User,
)  # school_id, name, email, (archived), (class_name), (role)
from app.api.v1.schemas.common import ClusterOption

router = APIRouter(prefix="/clusters", tags=["clusters"])


@router.get("", response_model=list[ClusterOption])
def list_clusters(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user is None or getattr(current_user, "school_id", None) is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Niet ingelogd"
        )

    # Alle unieke clusters met tenminste één niet-gearchiveerde student
    rows = (
        db.query(User.cluster)
        .filter(
            User.school_id == current_user.school_id,
            User.role == "student",
            User.archived.is_(False),
            User.cluster.isnot(None),
            User.cluster != "",
        )
        .distinct()
        .order_by(User.cluster.asc())
        .all()
    )
    clusters = [r[0] for r in rows]
    return [ClusterOption(value=c, label=c) for c in clusters]
