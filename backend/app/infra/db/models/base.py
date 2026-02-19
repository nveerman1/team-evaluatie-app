from __future__ import annotations
from sqlalchemy import Integer
from sqlalchemy.orm import mapped_column
from app.infra.db.base import Base

# Re-export Base for convenience
__all__ = ["Base", "id_pk", "tenant_fk"]


# ============ Helpers ============
def id_pk():
    return mapped_column(Integer, primary_key=True, index=True)


def tenant_fk():
    return mapped_column(Integer, index=True)
