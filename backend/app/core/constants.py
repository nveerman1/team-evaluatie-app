"""
Application-wide constants for grading, scoring, and categorization.
"""

# ============ Grade Calculation Constants ============

# GCF (Group Correction Factor) typically ranges from 0.5 to 1.5 in normal cases
# We set the warning threshold higher (2.0) to allow for exceptional cases
# while still logging potentially incorrect values for review
MAX_REASONABLE_GCF = 2.0

# ============ Category Mappings ============

# Mapping from full Dutch category names to short abbreviations
# This ensures frontend compatibility with OMZA scoring
CATEGORY_NAME_TO_ABBREV = {
    "Organiseren": "O",
    "Meedoen": "M",
    "Zelfvertrouwen": "Z",
    "Autonomie": "A",
    # Fallback: first letter uppercase (handled in helper function)
}


def get_category_abbrev(category_name: str) -> str:
    """
    Convert full category name to abbreviation for frontend compatibility.
    
    Args:
        category_name: Full Dutch category name (e.g., "Organiseren")
        
    Returns:
        Single-letter abbreviation (e.g., "O")
    """
    return CATEGORY_NAME_TO_ABBREV.get(
        category_name, category_name[0].upper() if category_name else ""
    )
