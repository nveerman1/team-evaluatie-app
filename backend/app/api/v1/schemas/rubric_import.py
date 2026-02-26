from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel


class CsvCriterionRow(BaseModel):
    """Één rij uit het CSV-bestand, vertegenwoordigt één criterium."""

    criterion_name: str
    category: Optional[str] = None
    weight: float = 1.0
    level1: str = ""
    level2: str = ""
    level3: str = ""
    level4: str = ""
    level5: str = ""
    learning_objective_orders: List[int] = []


class CsvRubricGroup(BaseModel):
    """Één rubric gegroepeerd op rubric_title."""

    rubric_title: str
    rubric_description: Optional[str] = None
    scope: str  # "peer" | "project"
    target_level: Optional[str] = None
    scale_min: int = 1
    scale_max: int = 5
    criteria: List[CsvCriterionRow] = []


class ResolvedLearningObjective(BaseModel):
    """Een opgelost leerdoel-nummer met status."""

    order: int
    found: bool
    title: Optional[str] = None
    domain: Optional[str] = None


class PreviewCriterion(BaseModel):
    name: str
    category: Optional[str] = None
    weight: float
    has_descriptors: bool
    learning_objectives: List[ResolvedLearningObjective] = []


class PreviewRubric(BaseModel):
    title: str
    scope: str
    criteria_count: int
    criteria: List[PreviewCriterion] = []


class CsvPreviewResult(BaseModel):
    """Resultaat van de preview (geen opslag in database)."""

    rubrics: List[PreviewRubric] = []
    errors: List[str] = []
    warnings: List[str] = []
    valid: bool = True


class CsvImportResult(BaseModel):
    """Resultaat van de import (opgeslagen in database)."""

    created_rubrics: int = 0
    created_criteria: int = 0
    linked_objectives: int = 0
    errors: List[str] = []
    warnings: List[str] = []
    rubric_ids: List[int] = []
