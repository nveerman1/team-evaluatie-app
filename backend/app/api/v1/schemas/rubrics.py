from __future__ import annotations
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


# ---------- Helpers ----------

# We werken met 5 niveaus.
LEVEL_KEYS = ("level1", "level2", "level3", "level4", "level5")


def _normalize_descriptors(v: Any) -> Dict[str, str]:
    """
    Normaliseer 'descriptors' naar exact 5 sleutels: level1..level5 (strings).

    Accepteert o.a.:
    - dict met keys level1..level5 (preferred)
    - dict met keys "1","2","3","4","5" (numeriek als string)
    - list/tuple met 4 of 5 strings (4 → level5 = "")

    Returned altijd:
    { "level1": str, "level2": str, "level3": str, "level4": str, "level5": str }
    """
    # Volledige lege set
    empty = {k: "" for k in LEVEL_KEYS}

    if v is None:
        return empty

    # Lijsten/tuples
    if isinstance(v, (list, tuple)):
        # Vul zoveel mogelijk in, rest leeg
        out = empty.copy()
        for i, val in enumerate(v[:5]):  # neem max 5
            out[LEVEL_KEYS[i]] = str(val or "")
        return out

    # Dictionaries
    if isinstance(v, dict):
        # Exacte keys aanwezig?
        if all(k in v for k in LEVEL_KEYS):
            return {k: str(v[k] or "") for k in LEVEL_KEYS}

        # Numerieke sleutels "1".."5"
        if all(str(i) in v for i in range(1, 6)):
            return {k: str(v[str(i)] or "") for i, k in enumerate(LEVEL_KEYS, start=1)}

        # Gemengde/partiële dict → map bekend + vul rest aan
        out = empty.copy()
        for i, k in enumerate(LEVEL_KEYS, start=1):
            out[k] = str(v.get(k) or v.get(str(i)) or "")
        return out

    # Onbekend type → leeg schema
    return empty


# ---------- Rubric ----------


class RubricCreate(BaseModel):
    title: str
    description: Optional[str] = None
    scale_min: int = 1
    scale_max: int = 5
    scope: str = "peer"  # "peer" | "project"
    metadata_json: Dict[str, Any] = Field(default_factory=dict)


class RubricUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    scale_min: Optional[int] = None
    scale_max: Optional[int] = None
    scope: Optional[str] = None  # "peer" | "project"
    metadata_json: Optional[Dict[str, Any]] = None


class RubricOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    scale_min: int
    scale_max: int
    scope: str
    metadata_json: Dict[str, Any]

    class Config:
        from_attributes = True


# ---------- Criterion ----------


class CriterionCreate(BaseModel):
    name: str
    weight: float = 1.0
    descriptors: Dict[str, str] = Field(
        default_factory=lambda: {k: "" for k in LEVEL_KEYS}
    )
    order: Optional[int] = None  # wordt alleen gebruikt als je model dit veld heeft

    @field_validator("descriptors")
    @classmethod
    def _fix_desc(cls, v: Any) -> Dict[str, str]:
        return _normalize_descriptors(v)


class CriterionUpdate(BaseModel):
    name: Optional[str] = None
    weight: Optional[float] = None
    descriptors: Optional[Dict[str, str]] = None
    order: Optional[int] = None

    @field_validator("descriptors")
    @classmethod
    def _fix_desc(cls, v: Any) -> Optional[Dict[str, str]]:
        if v is None:
            return None
        return _normalize_descriptors(v)


class CriterionOut(BaseModel):
    id: int
    rubric_id: int
    name: str
    weight: float
    descriptors: Dict[str, str]  # level1..level5
    order: Optional[int] = None

    class Config:
        from_attributes = True


# ---------- Batch upsert ----------


class CriterionUpsertItem(BaseModel):
    # id is optioneel; als meegegeven → update, anders create
    id: Optional[int] = None
    name: str
    weight: float = 1.0
    descriptors: Dict[str, str] = Field(
        default_factory=lambda: {k: "" for k in LEVEL_KEYS}
    )
    order: Optional[int] = None

    @field_validator("descriptors")
    @classmethod
    def _fix_desc(cls, v: Any) -> Dict[str, str]:
        return _normalize_descriptors(v)


class CriterionBatchUpsertRequest(BaseModel):
    items: List[CriterionUpsertItem]


class CriterionBatchUpsertResponse(BaseModel):
    items: List[CriterionOut]


# ---------- List response with pagination ----------


class RubricListItem(RubricOut):
    criteria_count: int = 0


class RubricListResponse(BaseModel):
    items: List[RubricListItem]
    page: int
    limit: int
    total: int
