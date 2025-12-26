"""
Shared service for calculating weighted OMZA scores consistently across all endpoints.

This ensures that:
1. Criterion weights from rubrics are properly applied
2. Peer vs self scores are distinguished correctly (reviewer_id != reviewee_id)
3. Submitted status filtering is consistent
4. The same calculation logic is used everywhere
"""

from typing import Dict, Optional
from sqlalchemy.orm import Session
from app.infra.db.models import Evaluation, RubricCriterion, Score, Allocation


def compute_weighted_omza_scores(
    db: Session,
    evaluation_id: int,
    reviewee_id: int
) -> Dict[str, Dict[str, Optional[float]]]:
    """
    Compute weighted OMZA scores for a specific evaluation and student.
    
    Args:
        db: Database session
        evaluation_id: ID of the evaluation
        reviewee_id: ID of the student being evaluated
        
    Returns:
        Dictionary with structure:
        {
            "O": {"peer": float|None, "self": float|None},
            "M": {"peer": float|None, "self": float|None},
            "Z": {"peer": float|None, "self": float|None},
            "A": {"peer": float|None, "self": float|None}
        }
    """
    # Initialize result structure
    result = {
        "O": {"peer": None, "self": None},
        "M": {"peer": None, "self": None},
        "Z": {"peer": None, "self": None},
        "A": {"peer": None, "self": None}
    }
    
    # Get evaluation to access rubric_id
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
    if not evaluation or not evaluation.rubric_id:
        return result
    
    # Get all criteria for this rubric, grouped by category
    criteria = db.query(RubricCriterion).filter(
        RubricCriterion.rubric_id == evaluation.rubric_id,
        RubricCriterion.category.isnot(None)
    ).all()
    
    # Group criteria by category with their weights
    category_criteria = {}
    for criterion in criteria:
        cat = criterion.category
        if cat not in category_criteria:
            category_criteria[cat] = []
        category_criteria[cat].append({
            "id": criterion.id,
            "weight": criterion.weight if criterion.weight else 1.0
        })
    
    # For each category, calculate weighted peer and self averages
    for cat_name, cat_criteria in category_criteria.items():
        criterion_ids = [c["id"] for c in cat_criteria]
        weight_map = {c["id"]: c["weight"] for c in cat_criteria}
        
        # Get all scores for this category
        scores_query = db.query(Score.score, Score.criterion_id, Allocation.reviewer_id).join(
            Allocation, Allocation.id == Score.allocation_id
        ).filter(
            Allocation.evaluation_id == evaluation_id,
            Allocation.reviewee_id == reviewee_id,
            Score.criterion_id.in_(criterion_ids),
            Score.status == "submitted"
        ).all()
        
        # Separate peer and self scores
        peer_scores_data = []
        self_scores_data = []
        
        for score, criterion_id, reviewer_id in scores_query:
            if reviewer_id != reviewee_id:
                # Peer score
                peer_scores_data.append((score, criterion_id))
            else:
                # Self score
                self_scores_data.append((score, criterion_id))
        
        # Calculate weighted peer average
        if peer_scores_data:
            weighted_sum = sum(score * weight_map.get(crit_id, 1.0) for score, crit_id in peer_scores_data)
            weight_sum = sum(weight_map.get(crit_id, 1.0) for _, crit_id in peer_scores_data)
            if weight_sum > 0:
                result[cat_name]["peer"] = weighted_sum / weight_sum
        
        # Calculate weighted self average
        if self_scores_data:
            weighted_sum = sum(score * weight_map.get(crit_id, 1.0) for score, crit_id in self_scores_data)
            weight_sum = sum(weight_map.get(crit_id, 1.0) for _, crit_id in self_scores_data)
            if weight_sum > 0:
                result[cat_name]["self"] = weighted_sum / weight_sum
    
    return result


def compute_weighted_omza_scores_batch(
    db: Session,
    evaluation_id: int,
    reviewee_ids: list[int]
) -> Dict[int, Dict[str, Dict[str, Optional[float]]]]:
    """
    Compute weighted OMZA scores for multiple students in a single evaluation.
    Optimized to avoid N+1 queries.
    
    Args:
        db: Database session
        evaluation_id: ID of the evaluation
        reviewee_ids: List of student IDs
        
    Returns:
        Dictionary mapping student_id to their OMZA scores:
        {
            student_id: {
                "O": {"peer": float|None, "self": float|None},
                "M": {...}, "Z": {...}, "A": {...}
            }
        }
    """
    # Get evaluation to access rubric_id
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
    if not evaluation or not evaluation.rubric_id:
        # Return empty results with default structure
        results = {}
        for reviewee_id in reviewee_ids:
            results[reviewee_id] = {
                "O": {"peer": None, "self": None},
                "M": {"peer": None, "self": None},
                "Z": {"peer": None, "self": None},
                "A": {"peer": None, "self": None}
            }
        return results
    
    # Get all criteria for this rubric
    criteria = db.query(RubricCriterion).filter(
        RubricCriterion.rubric_id == evaluation.rubric_id,
        RubricCriterion.category.isnot(None)
    ).all()
    
    # Group criteria by category with their weights
    category_criteria = {}
    for criterion in criteria:
        cat = criterion.category
        if cat not in category_criteria:
            category_criteria[cat] = []
        category_criteria[cat].append({
            "id": criterion.id,
            "weight": criterion.weight if criterion.weight else 1.0
        })
    
    # Initialize results for all students with actual categories from rubric
    results = {}
    for reviewee_id in reviewee_ids:
        results[reviewee_id] = {}
        for cat_name in category_criteria.keys():
            results[reviewee_id][cat_name] = {"peer": None, "self": None}
    
    # Get all scores for all students in one query
    all_criterion_ids = [c.id for c in criteria]
    scores_query = db.query(
        Score.score,
        Score.criterion_id,
        Allocation.reviewer_id,
        Allocation.reviewee_id
    ).join(
        Allocation, Allocation.id == Score.allocation_id
    ).filter(
        Allocation.evaluation_id == evaluation_id,
        Allocation.reviewee_id.in_(reviewee_ids),
        Score.criterion_id.in_(all_criterion_ids),
        Score.status == "submitted"
    ).all()
    
    # Group scores by student and category
    student_scores = {}
    for score, criterion_id, reviewer_id, reviewee_id in scores_query:
        if reviewee_id not in student_scores:
            student_scores[reviewee_id] = {}
        
        # Find which category this criterion belongs to
        for cat_name, cat_criteria in category_criteria.items():
            if any(c["id"] == criterion_id for c in cat_criteria):
                if cat_name not in student_scores[reviewee_id]:
                    student_scores[reviewee_id][cat_name] = {"peer": [], "self": []}
                
                score_type = "self" if reviewer_id == reviewee_id else "peer"
                student_scores[reviewee_id][cat_name][score_type].append((score, criterion_id))
                break
    
    # Calculate weighted averages for each student and category
    for reviewee_id in reviewee_ids:
        if reviewee_id not in student_scores:
            continue
            
        for cat_name, cat_criteria in category_criteria.items():
            if cat_name not in student_scores[reviewee_id]:
                continue
            
            weight_map = {c["id"]: c["weight"] for c in cat_criteria}
            
            # Calculate peer weighted average
            peer_data = student_scores[reviewee_id][cat_name]["peer"]
            if peer_data:
                weighted_sum = sum(score * weight_map.get(crit_id, 1.0) for score, crit_id in peer_data)
                weight_sum = sum(weight_map.get(crit_id, 1.0) for _, crit_id in peer_data)
                if weight_sum > 0:
                    results[reviewee_id][cat_name]["peer"] = weighted_sum / weight_sum
            
            # Calculate self weighted average
            self_data = student_scores[reviewee_id][cat_name]["self"]
            if self_data:
                weighted_sum = sum(score * weight_map.get(crit_id, 1.0) for score, crit_id in self_data)
                weight_sum = sum(weight_map.get(crit_id, 1.0) for _, crit_id in self_data)
                if weight_sum > 0:
                    results[reviewee_id][cat_name]["self"] = weighted_sum / weight_sum
    
    return results
