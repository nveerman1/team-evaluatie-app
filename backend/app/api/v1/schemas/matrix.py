from __future__ import annotations
from pydantic import BaseModel
from typing import List, Optional


class MatrixUser(BaseModel):
    id: int
    name: str


class MatrixCell(BaseModel):
    reviewer_id: int
    reviewee_id: int
    value: Optional[float]  # None als geen scores voor dit koppel
    count: int  # aantal onderliggende scores (criteria of 1 criterium)


class MatrixResponse(BaseModel):
    evaluation_id: int
    criterion_id: Optional[int] = None
    reviewers: List[MatrixUser]  # rij-headers
    reviewees: List[MatrixUser]  # kolom-headers
    cells: List[MatrixCell]
