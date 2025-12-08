"""
Templates API endpoints for admin template management
"""

from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    User,
    PeerEvaluationCriterionTemplate,
    ProjectAssessmentCriterionTemplate,
    ProjectRubricTemplate,
    ProjectRubricCriterionTemplate,
    CompetencyTemplate,
    CompetencyLevelDescriptorTemplate,
    CompetencyReflectionQuestionTemplate,
    MailTemplate,
    StandardRemark,
    TemplateTag,
    TemplateTagLink,
)
from app.api.v1.schemas.templates import (
    # Peer Evaluation
    PeerEvaluationCriterionTemplateCreate,
    PeerEvaluationCriterionTemplateUpdate,
    PeerEvaluationCriterionTemplateOut,
    PeerEvaluationCriterionTemplateListOut,
    # Project Assessment Criteria
    ProjectAssessmentCriterionTemplateCreate,
    ProjectAssessmentCriterionTemplateUpdate,
    ProjectAssessmentCriterionTemplateOut,
    ProjectAssessmentCriterionTemplateListOut,
    # Project Rubric
    ProjectRubricTemplateCreate,
    ProjectRubricTemplateUpdate,
    ProjectRubricTemplateOut,
    ProjectRubricTemplateListOut,
    # Competency
    CompetencyTemplateCreate,
    CompetencyTemplateUpdate,
    CompetencyTemplateOut,
    CompetencyTemplateListOut,
    MailTemplateCreate,
    MailTemplateUpdate,
    MailTemplateOut,
    MailTemplateListOut,
    # Standard Remark
    StandardRemarkCreate,
    StandardRemarkUpdate,
    StandardRemarkOut,
    StandardRemarkListOut,
    # Template Tag
    TemplateTagCreate,
    TemplateTagUpdate,
    TemplateTagOut,
    TemplateTagListOut,
    TemplateTagLinkCreate,
    TemplateTagLinkOut,
    TemplateTagLinkListOut,
)
from app.core.rbac import require_role
from app.core.audit import log_create, log_update, log_delete

router = APIRouter(prefix="/templates", tags=["templates"])


# ============ Peer Evaluation Criterion Templates ============


@router.get("/peer-criteria", response_model=PeerEvaluationCriterionTemplateListOut)
def list_peer_criteria_templates(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    subject_id: Optional[int] = None,
    omza_category: Optional[str] = None,
    target_level: Optional[str] = None,
):
    """List peer evaluation criterion templates"""
    require_role(user, ["admin", "teacher"])

    query = db.query(PeerEvaluationCriterionTemplate).filter(
        PeerEvaluationCriterionTemplate.school_id == user.school_id
    )

    if subject_id:
        query = query.filter(PeerEvaluationCriterionTemplate.subject_id == subject_id)
    if omza_category:
        query = query.filter(
            PeerEvaluationCriterionTemplate.omza_category == omza_category
        )
    if target_level:
        # Show criteria with target_level = NULL OR target_level = specified level
        query = query.filter(
            or_(
                PeerEvaluationCriterionTemplate.target_level.is_(None),
                PeerEvaluationCriterionTemplate.target_level == target_level
            )
        )

    total = query.count()
    offset = (page - 1) * per_page
    templates = (
        query.order_by(PeerEvaluationCriterionTemplate.title)
        .offset(offset)
        .limit(per_page)
        .all()
    )

    return PeerEvaluationCriterionTemplateListOut(
        templates=[
            PeerEvaluationCriterionTemplateOut.model_validate(t) for t in templates
        ],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post(
    "/peer-criteria",
    response_model=PeerEvaluationCriterionTemplateOut,
    status_code=status.HTTP_201_CREATED,
)
def create_peer_criterion_template(
    payload: PeerEvaluationCriterionTemplateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Create a new peer evaluation criterion template"""
    require_role(user, ["admin", "teacher"])

    template = PeerEvaluationCriterionTemplate(
        school_id=user.school_id,
        subject_id=payload.subject_id,
        omza_category=payload.omza_category,
        title=payload.title,
        description=payload.description,
        target_level=payload.target_level,
        level_descriptors=payload.level_descriptors,
        learning_objective_ids=payload.learning_objective_ids or [],
    )

    db.add(template)
    db.commit()
    db.refresh(template)

    log_create(
        db=db,
        user=user,
        entity_type="peer_criterion_template",
        entity_id=template.id,
        details={"title": template.title},
        request=request,
    )

    return PeerEvaluationCriterionTemplateOut.model_validate(template)


@router.get(
    "/peer-criteria/{template_id}", response_model=PeerEvaluationCriterionTemplateOut
)
def get_peer_criterion_template(
    template_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a specific peer evaluation criterion template"""
    require_role(user, ["admin", "teacher"])

    template = (
        db.query(PeerEvaluationCriterionTemplate)
        .filter(
            PeerEvaluationCriterionTemplate.id == template_id,
            PeerEvaluationCriterionTemplate.school_id == user.school_id,
        )
        .first()
    )

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    return PeerEvaluationCriterionTemplateOut.model_validate(template)


@router.patch(
    "/peer-criteria/{template_id}", response_model=PeerEvaluationCriterionTemplateOut
)
def update_peer_criterion_template(
    template_id: int,
    payload: PeerEvaluationCriterionTemplateUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Update a peer evaluation criterion template"""
    require_role(user, ["admin", "teacher"])

    template = (
        db.query(PeerEvaluationCriterionTemplate)
        .filter(
            PeerEvaluationCriterionTemplate.id == template_id,
            PeerEvaluationCriterionTemplate.school_id == user.school_id,
        )
        .first()
    )

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(template, key, value)

    db.commit()
    db.refresh(template)

    log_update(
        db=db,
        user=user,
        entity_type="peer_criterion_template",
        entity_id=template.id,
        details=update_data,
        request=request,
    )

    return PeerEvaluationCriterionTemplateOut.model_validate(template)


@router.delete("/peer-criteria/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_peer_criterion_template(
    template_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Delete a peer evaluation criterion template"""
    require_role(user, ["admin"])

    template = (
        db.query(PeerEvaluationCriterionTemplate)
        .filter(
            PeerEvaluationCriterionTemplate.id == template_id,
            PeerEvaluationCriterionTemplate.school_id == user.school_id,
        )
        .first()
    )

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    log_delete(
        db=db,
        user=user,
        entity_type="peer_criterion_template",
        entity_id=template.id,
        details={"title": template.title},
        request=request,
    )

    db.delete(template)
    db.commit()


# ============ Project Assessment Criterion Templates ============


@router.get("/project-rubric-criteria", response_model=ProjectAssessmentCriterionTemplateListOut)
def list_project_assessment_criteria_templates(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    subject_id: Optional[int] = None,
    category: Optional[str] = None,
    target_level: Optional[str] = None,
):
    """List project assessment criterion templates"""
    require_role(user, ["admin", "teacher"])

    query = db.query(ProjectAssessmentCriterionTemplate).filter(
        ProjectAssessmentCriterionTemplate.school_id == user.school_id
    )

    if subject_id:
        query = query.filter(ProjectAssessmentCriterionTemplate.subject_id == subject_id)
    if category:
        query = query.filter(
            ProjectAssessmentCriterionTemplate.category == category
        )
    if target_level:
        # Show criteria with target_level = NULL OR target_level = specified level
        query = query.filter(
            or_(
                ProjectAssessmentCriterionTemplate.target_level.is_(None),
                ProjectAssessmentCriterionTemplate.target_level == target_level
            )
        )

    total = query.count()
    offset = (page - 1) * per_page
    templates = (
        query.order_by(ProjectAssessmentCriterionTemplate.title)
        .offset(offset)
        .limit(per_page)
        .all()
    )

    return ProjectAssessmentCriterionTemplateListOut(
        templates=[
            ProjectAssessmentCriterionTemplateOut.model_validate(t) for t in templates
        ],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post(
    "/project-rubric-criteria",
    response_model=ProjectAssessmentCriterionTemplateOut,
    status_code=status.HTTP_201_CREATED,
)
def create_project_assessment_criterion_template(
    payload: ProjectAssessmentCriterionTemplateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Create a new project assessment criterion template"""
    require_role(user, ["admin", "teacher"])

    template = ProjectAssessmentCriterionTemplate(
        school_id=user.school_id,
        subject_id=payload.subject_id,
        category=payload.category,
        title=payload.title,
        description=payload.description,
        target_level=payload.target_level,
        level_descriptors=payload.level_descriptors,
        learning_objective_ids=payload.learning_objective_ids or [],
    )

    db.add(template)
    db.commit()
    db.refresh(template)

    log_create(
        db=db,
        user=user,
        entity_type="project_assessment_criterion_template",
        entity_id=template.id,
        details={"title": template.title},
        request=request,
    )

    return ProjectAssessmentCriterionTemplateOut.model_validate(template)


@router.get(
    "/project-rubric-criteria/{template_id}", response_model=ProjectAssessmentCriterionTemplateOut
)
def get_project_assessment_criterion_template(
    template_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a specific project assessment criterion template"""
    require_role(user, ["admin", "teacher"])

    template = (
        db.query(ProjectAssessmentCriterionTemplate)
        .filter(
            ProjectAssessmentCriterionTemplate.id == template_id,
            ProjectAssessmentCriterionTemplate.school_id == user.school_id,
        )
        .first()
    )

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    return ProjectAssessmentCriterionTemplateOut.model_validate(template)


@router.patch(
    "/project-rubric-criteria/{template_id}", response_model=ProjectAssessmentCriterionTemplateOut
)
def update_project_assessment_criterion_template(
    template_id: int,
    payload: ProjectAssessmentCriterionTemplateUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Update a project assessment criterion template"""
    require_role(user, ["admin", "teacher"])

    template = (
        db.query(ProjectAssessmentCriterionTemplate)
        .filter(
            ProjectAssessmentCriterionTemplate.id == template_id,
            ProjectAssessmentCriterionTemplate.school_id == user.school_id,
        )
        .first()
    )

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(template, key, value)

    db.commit()
    db.refresh(template)

    log_update(
        db=db,
        user=user,
        entity_type="project_assessment_criterion_template",
        entity_id=template.id,
        details=update_data,
        request=request,
    )

    return ProjectAssessmentCriterionTemplateOut.model_validate(template)


@router.delete("/project-rubric-criteria/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_assessment_criterion_template(
    template_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Delete a project assessment criterion template"""
    require_role(user, ["admin", "teacher"])

    template = (
        db.query(ProjectAssessmentCriterionTemplate)
        .filter(
            ProjectAssessmentCriterionTemplate.id == template_id,
            ProjectAssessmentCriterionTemplate.school_id == user.school_id,
        )
        .first()
    )

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    log_delete(
        db=db,
        user=user,
        entity_type="project_assessment_criterion_template",
        entity_id=template.id,
        details={"title": template.title},
        request=request,
    )

    db.delete(template)
    db.commit()


# ============ Project Rubric Templates ============


@router.get("/project-rubrics", response_model=ProjectRubricTemplateListOut)
def list_project_rubric_templates(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    subject_id: Optional[int] = None,
    level: Optional[str] = None,
):
    """List project rubric templates"""
    require_role(user, ["admin", "teacher"])

    query = db.query(ProjectRubricTemplate).filter(
        ProjectRubricTemplate.school_id == user.school_id
    )

    if subject_id:
        query = query.filter(ProjectRubricTemplate.subject_id == subject_id)
    if level:
        query = query.filter(ProjectRubricTemplate.level == level)

    total = query.count()
    offset = (page - 1) * per_page
    templates = (
        query.order_by(ProjectRubricTemplate.name).offset(offset).limit(per_page).all()
    )

    return ProjectRubricTemplateListOut(
        templates=[ProjectRubricTemplateOut.model_validate(t) for t in templates],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post(
    "/project-rubrics",
    response_model=ProjectRubricTemplateOut,
    status_code=status.HTTP_201_CREATED,
)
def create_project_rubric_template(
    payload: ProjectRubricTemplateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Create a new project rubric template"""
    require_role(user, ["admin", "teacher"])

    template = ProjectRubricTemplate(
        school_id=user.school_id,
        subject_id=payload.subject_id,
        name=payload.name,
        level=payload.level,
    )

    db.add(template)
    db.flush()

    # Create criteria
    for criterion_data in payload.criteria:
        criterion = ProjectRubricCriterionTemplate(
            school_id=user.school_id,
            rubric_template_id=template.id,
            category=criterion_data.category,
            title=criterion_data.title,
            description=criterion_data.description,
            weight=criterion_data.weight,
            level_descriptors=criterion_data.level_descriptors,
        )
        db.add(criterion)

    db.commit()
    db.refresh(template)

    log_create(
        db=db,
        user=user,
        entity_type="project_rubric_template",
        entity_id=template.id,
        details={"name": template.name},
        request=request,
    )

    return ProjectRubricTemplateOut.model_validate(template)


@router.get("/project-rubrics/{template_id}", response_model=ProjectRubricTemplateOut)
def get_project_rubric_template(
    template_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a specific project rubric template"""
    require_role(user, ["admin", "teacher"])

    template = (
        db.query(ProjectRubricTemplate)
        .filter(
            ProjectRubricTemplate.id == template_id,
            ProjectRubricTemplate.school_id == user.school_id,
        )
        .first()
    )

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    return ProjectRubricTemplateOut.model_validate(template)


@router.patch("/project-rubrics/{template_id}", response_model=ProjectRubricTemplateOut)
def update_project_rubric_template(
    template_id: int,
    payload: ProjectRubricTemplateUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Update a project rubric template"""
    require_role(user, ["admin", "teacher"])

    template = (
        db.query(ProjectRubricTemplate)
        .filter(
            ProjectRubricTemplate.id == template_id,
            ProjectRubricTemplate.school_id == user.school_id,
        )
        .first()
    )

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(template, key, value)

    db.commit()
    db.refresh(template)

    log_update(
        db=db,
        user=user,
        entity_type="project_rubric_template",
        entity_id=template.id,
        details=update_data,
        request=request,
    )

    return ProjectRubricTemplateOut.model_validate(template)


@router.delete("/project-rubrics/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_rubric_template(
    template_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Delete a project rubric template"""
    require_role(user, ["admin"])

    template = (
        db.query(ProjectRubricTemplate)
        .filter(
            ProjectRubricTemplate.id == template_id,
            ProjectRubricTemplate.school_id == user.school_id,
        )
        .first()
    )

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    log_delete(
        db=db,
        user=user,
        entity_type="project_rubric_template",
        entity_id=template.id,
        details={"name": template.name},
        request=request,
    )

    db.delete(template)
    db.commit()


@router.post(
    "/project-rubrics/{template_id}/duplicate", response_model=ProjectRubricTemplateOut
)
def duplicate_project_rubric_template(
    template_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Duplicate a project rubric template (deep copy with criteria)"""
    require_role(user, ["admin", "teacher"])

    original = (
        db.query(ProjectRubricTemplate)
        .filter(
            ProjectRubricTemplate.id == template_id,
            ProjectRubricTemplate.school_id == user.school_id,
        )
        .first()
    )

    if not original:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    # Create duplicate
    duplicate = ProjectRubricTemplate(
        school_id=user.school_id,
        subject_id=original.subject_id,
        name=f"{original.name} (copy)",
        level=original.level,
    )

    db.add(duplicate)
    db.flush()

    # Duplicate criteria
    for criterion in original.criteria:
        new_criterion = ProjectRubricCriterionTemplate(
            school_id=user.school_id,
            rubric_template_id=duplicate.id,
            category=criterion.category,
            title=criterion.title,
            description=criterion.description,
            weight=criterion.weight,
            level_descriptors=criterion.level_descriptors,
        )
        db.add(new_criterion)

    db.commit()
    db.refresh(duplicate)

    log_create(
        db=db,
        user=user,
        entity_type="project_rubric_template",
        entity_id=duplicate.id,
        details={"name": duplicate.name, "duplicated_from": template_id},
        request=request,
    )

    return ProjectRubricTemplateOut.model_validate(duplicate)


# ============ Competency Templates ============


@router.get("/competencies", response_model=CompetencyTemplateListOut)
def list_competency_templates(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    subject_id: Optional[int] = None,
):
    """List competency templates"""
    require_role(user, ["admin", "teacher"])

    query = db.query(CompetencyTemplate).filter(
        CompetencyTemplate.school_id == user.school_id
    )

    if subject_id is not None:
        query = query.filter(CompetencyTemplate.subject_id == subject_id)

    total = query.count()
    offset = (page - 1) * per_page
    templates = (
        query.order_by(CompetencyTemplate.name).offset(offset).limit(per_page).all()
    )

    return CompetencyTemplateListOut(
        templates=[CompetencyTemplateOut.model_validate(t) for t in templates],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post(
    "/competencies",
    response_model=CompetencyTemplateOut,
    status_code=status.HTTP_201_CREATED,
)
def create_competency_template(
    payload: CompetencyTemplateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Create a new competency template"""
    require_role(user, ["admin", "teacher"])

    template = CompetencyTemplate(
        school_id=user.school_id,
        subject_id=payload.subject_id,
        name=payload.name,
        description=payload.description,
    )

    db.add(template)
    db.flush()

    # Create level descriptors
    for descriptor_data in payload.level_descriptors:
        descriptor = CompetencyLevelDescriptorTemplate(
            school_id=user.school_id,
            competency_template_id=template.id,
            level=descriptor_data.level,
            behavior_description=descriptor_data.behavior_description,
        )
        db.add(descriptor)

    # Create reflection questions
    for question_data in payload.reflection_questions:
        question = CompetencyReflectionQuestionTemplate(
            school_id=user.school_id,
            competency_template_id=template.id,
            question_text=question_data.question_text,
        )
        db.add(question)

    db.commit()
    db.refresh(template)

    log_create(
        db=db,
        user=user,
        entity_type="competency_template",
        entity_id=template.id,
        details={"name": template.name},
        request=request,
    )

    return CompetencyTemplateOut.model_validate(template)


@router.get("/competencies/{template_id}", response_model=CompetencyTemplateOut)
def get_competency_template(
    template_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a specific competency template"""
    require_role(user, ["admin", "teacher"])

    template = (
        db.query(CompetencyTemplate)
        .filter(
            CompetencyTemplate.id == template_id,
            CompetencyTemplate.school_id == user.school_id,
        )
        .first()
    )

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    return CompetencyTemplateOut.model_validate(template)


@router.patch("/competencies/{template_id}", response_model=CompetencyTemplateOut)
def update_competency_template(
    template_id: int,
    payload: CompetencyTemplateUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Update a competency template"""
    require_role(user, ["admin", "teacher"])

    template = (
        db.query(CompetencyTemplate)
        .filter(
            CompetencyTemplate.id == template_id,
            CompetencyTemplate.school_id == user.school_id,
        )
        .first()
    )

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(template, key, value)

    db.commit()
    db.refresh(template)

    log_update(
        db=db,
        user=user,
        entity_type="competency_template",
        entity_id=template.id,
        details=update_data,
        request=request,
    )

    return CompetencyTemplateOut.model_validate(template)


@router.delete("/competencies/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_competency_template(
    template_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Delete a competency template"""
    require_role(user, ["admin"])

    template = (
        db.query(CompetencyTemplate)
        .filter(
            CompetencyTemplate.id == template_id,
            CompetencyTemplate.school_id == user.school_id,
        )
        .first()
    )

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    log_delete(
        db=db,
        user=user,
        entity_type="competency_template",
        entity_id=template.id,
        details={"name": template.name},
        request=request,
    )

    db.delete(template)
    db.commit()


# ============ Mail Templates ============


@router.get("/mail-templates", response_model=MailTemplateListOut)
def list_mail_templates(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    subject_id: Optional[int] = None,
    type: Optional[str] = None,
    is_active: Optional[bool] = None,
):
    """List mail templates"""
    require_role(user, ["admin", "teacher"])

    query = db.query(MailTemplate).filter(MailTemplate.school_id == user.school_id)

    if subject_id is not None:
        query = query.filter(MailTemplate.subject_id == subject_id)
    if type:
        query = query.filter(MailTemplate.type == type)
    if is_active is not None:
        query = query.filter(MailTemplate.is_active == is_active)

    total = query.count()
    offset = (page - 1) * per_page
    templates = query.order_by(MailTemplate.name).offset(offset).limit(per_page).all()

    return MailTemplateListOut(
        templates=[MailTemplateOut.model_validate(t) for t in templates],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post(
    "/mail-templates",
    response_model=MailTemplateOut,
    status_code=status.HTTP_201_CREATED,
)
def create_mail_template(
    payload: MailTemplateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Create a new mail template"""
    require_role(user, ["admin", "teacher"])

    template = MailTemplate(
        school_id=user.school_id,
        subject_id=payload.subject_id,
        name=payload.name,
        type=payload.type,
        subject=payload.subject,
        body=payload.body,
        variables_allowed=payload.variables_allowed,
        is_active=payload.is_active,
    )

    db.add(template)
    db.commit()
    db.refresh(template)

    log_create(
        db=db,
        user=user,
        entity_type="mail_template",
        entity_id=template.id,
        details={"name": template.name},
        request=request,
    )

    return MailTemplateOut.model_validate(template)


@router.get("/mail-templates/{template_id}", response_model=MailTemplateOut)
def get_mail_template(
    template_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a specific mail template"""
    require_role(user, ["admin", "teacher"])

    template = (
        db.query(MailTemplate)
        .filter(
            MailTemplate.id == template_id,
            MailTemplate.school_id == user.school_id,
        )
        .first()
    )

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    return MailTemplateOut.model_validate(template)


@router.patch("/mail-templates/{template_id}", response_model=MailTemplateOut)
def update_mail_template(
    template_id: int,
    payload: MailTemplateUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Update a mail template"""
    require_role(user, ["admin", "teacher"])

    template = (
        db.query(MailTemplate)
        .filter(
            MailTemplate.id == template_id,
            MailTemplate.school_id == user.school_id,
        )
        .first()
    )

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(template, key, value)

    db.commit()
    db.refresh(template)

    log_update(
        db=db,
        user=user,
        entity_type="mail_template",
        entity_id=template.id,
        details=update_data,
        request=request,
    )

    return MailTemplateOut.model_validate(template)


@router.delete("/mail-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mail_template(
    template_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Delete a mail template"""
    require_role(user, ["admin"])

    template = (
        db.query(MailTemplate)
        .filter(
            MailTemplate.id == template_id,
            MailTemplate.school_id == user.school_id,
        )
        .first()
    )

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    log_delete(
        db=db,
        user=user,
        entity_type="mail_template",
        entity_id=template.id,
        details={"name": template.name},
        request=request,
    )

    db.delete(template)
    db.commit()


# ============ Standard Remarks ============


@router.get("/standard-remarks", response_model=StandardRemarkListOut)
def list_standard_remarks(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    subject_id: Optional[int] = None,
    type: Optional[str] = None,
    category: Optional[str] = None,
):
    """List standard remarks"""
    require_role(user, ["admin", "teacher"])

    query = db.query(StandardRemark).filter(StandardRemark.school_id == user.school_id)

    if subject_id is not None:
        query = query.filter(StandardRemark.subject_id == subject_id)
    if type:
        query = query.filter(StandardRemark.type == type)
    if category:
        query = query.filter(StandardRemark.category == category)

    total = query.count()
    offset = (page - 1) * per_page
    remarks = (
        query.order_by(StandardRemark.order, StandardRemark.text)
        .offset(offset)
        .limit(per_page)
        .all()
    )

    return StandardRemarkListOut(
        remarks=[StandardRemarkOut.model_validate(r) for r in remarks],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post(
    "/standard-remarks",
    response_model=StandardRemarkOut,
    status_code=status.HTTP_201_CREATED,
)
def create_standard_remark(
    payload: StandardRemarkCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Create a new standard remark"""
    require_role(user, ["admin", "teacher"])

    remark = StandardRemark(
        school_id=user.school_id,
        subject_id=payload.subject_id,
        type=payload.type,
        category=payload.category,
        text=payload.text,
        order=payload.order,
    )

    db.add(remark)
    db.commit()
    db.refresh(remark)

    log_create(
        db=db,
        user=user,
        entity_type="standard_remark",
        entity_id=remark.id,
        details={"text": remark.text[:50]},
        request=request,
    )

    return StandardRemarkOut.model_validate(remark)


@router.get("/standard-remarks/{remark_id}", response_model=StandardRemarkOut)
def get_standard_remark(
    remark_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a specific standard remark"""
    require_role(user, ["admin", "teacher"])

    remark = (
        db.query(StandardRemark)
        .filter(
            StandardRemark.id == remark_id,
            StandardRemark.school_id == user.school_id,
        )
        .first()
    )

    if not remark:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Remark not found"
        )

    return StandardRemarkOut.model_validate(remark)


@router.patch("/standard-remarks/{remark_id}", response_model=StandardRemarkOut)
def update_standard_remark(
    remark_id: int,
    payload: StandardRemarkUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Update a standard remark"""
    require_role(user, ["admin", "teacher"])

    remark = (
        db.query(StandardRemark)
        .filter(
            StandardRemark.id == remark_id,
            StandardRemark.school_id == user.school_id,
        )
        .first()
    )

    if not remark:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Remark not found"
        )

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(remark, key, value)

    db.commit()
    db.refresh(remark)

    log_update(
        db=db,
        user=user,
        entity_type="standard_remark",
        entity_id=remark.id,
        details=update_data,
        request=request,
    )

    return StandardRemarkOut.model_validate(remark)


@router.delete("/standard-remarks/{remark_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_standard_remark(
    remark_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Delete a standard remark"""
    require_role(user, ["admin"])

    remark = (
        db.query(StandardRemark)
        .filter(
            StandardRemark.id == remark_id,
            StandardRemark.school_id == user.school_id,
        )
        .first()
    )

    if not remark:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Remark not found"
        )

    log_delete(
        db=db,
        user=user,
        entity_type="standard_remark",
        entity_id=remark.id,
        details={"text": remark.text[:50]},
        request=request,
    )

    db.delete(remark)
    db.commit()


# ============ Template Tags ============


@router.get("/tags", response_model=TemplateTagListOut)
def list_template_tags(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    subject_id: Optional[int] = None,
):
    """List template tags"""
    require_role(user, ["admin", "teacher"])

    query = db.query(TemplateTag).filter(TemplateTag.school_id == user.school_id)

    if subject_id is not None:
        query = query.filter(TemplateTag.subject_id == subject_id)

    total = query.count()
    offset = (page - 1) * per_page
    tags = query.order_by(TemplateTag.name).offset(offset).limit(per_page).all()

    return TemplateTagListOut(
        tags=[TemplateTagOut.model_validate(t) for t in tags],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post(
    "/tags",
    response_model=TemplateTagOut,
    status_code=status.HTTP_201_CREATED,
)
def create_template_tag(
    payload: TemplateTagCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Create a new template tag"""
    require_role(user, ["admin", "teacher"])

    # Check for duplicate name
    existing = (
        db.query(TemplateTag)
        .filter(
            TemplateTag.school_id == user.school_id,
            TemplateTag.name == payload.name,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tag with name '{payload.name}' already exists",
        )

    tag = TemplateTag(
        school_id=user.school_id,
        subject_id=payload.subject_id,
        name=payload.name,
        description=payload.description,
        color=payload.color,
    )

    db.add(tag)
    db.commit()
    db.refresh(tag)

    log_create(
        db=db,
        user=user,
        entity_type="template_tag",
        entity_id=tag.id,
        details={"name": tag.name},
        request=request,
    )

    return TemplateTagOut.model_validate(tag)


@router.get("/tags/{tag_id}", response_model=TemplateTagOut)
def get_template_tag(
    tag_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a specific template tag"""
    require_role(user, ["admin", "teacher"])

    tag = (
        db.query(TemplateTag)
        .filter(
            TemplateTag.id == tag_id,
            TemplateTag.school_id == user.school_id,
        )
        .first()
    )

    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found"
        )

    return TemplateTagOut.model_validate(tag)


@router.patch("/tags/{tag_id}", response_model=TemplateTagOut)
def update_template_tag(
    tag_id: int,
    payload: TemplateTagUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Update a template tag"""
    require_role(user, ["admin", "teacher"])

    tag = (
        db.query(TemplateTag)
        .filter(
            TemplateTag.id == tag_id,
            TemplateTag.school_id == user.school_id,
        )
        .first()
    )

    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found"
        )

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(tag, key, value)

    db.commit()
    db.refresh(tag)

    log_update(
        db=db,
        user=user,
        entity_type="template_tag",
        entity_id=tag.id,
        details=update_data,
        request=request,
    )

    return TemplateTagOut.model_validate(tag)


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template_tag(
    tag_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Delete a template tag"""
    require_role(user, ["admin"])

    tag = (
        db.query(TemplateTag)
        .filter(
            TemplateTag.id == tag_id,
            TemplateTag.school_id == user.school_id,
        )
        .first()
    )

    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found"
        )

    log_delete(
        db=db,
        user=user,
        entity_type="template_tag",
        entity_id=tag.id,
        details={"name": tag.name},
        request=request,
    )

    db.delete(tag)
    db.commit()


# ============ Template Tag Links ============


@router.get("/tag-links", response_model=TemplateTagLinkListOut)
def list_template_tag_links(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    tag_id: Optional[int] = None,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
):
    """List template tag links"""
    require_role(user, ["admin", "teacher"])

    query = db.query(TemplateTagLink).filter(
        TemplateTagLink.school_id == user.school_id
    )

    if tag_id:
        query = query.filter(TemplateTagLink.tag_id == tag_id)
    if target_type:
        query = query.filter(TemplateTagLink.target_type == target_type)
    if target_id:
        query = query.filter(TemplateTagLink.target_id == target_id)

    total = query.count()
    offset = (page - 1) * per_page
    links = query.offset(offset).limit(per_page).all()

    return TemplateTagLinkListOut(
        links=[TemplateTagLinkOut.model_validate(link) for link in links],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post(
    "/tag-links",
    response_model=TemplateTagLinkOut,
    status_code=status.HTTP_201_CREATED,
)
def create_template_tag_link(
    payload: TemplateTagLinkCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Create a new template tag link"""
    require_role(user, ["admin", "teacher"])

    # Check if link already exists
    existing = (
        db.query(TemplateTagLink)
        .filter(
            TemplateTagLink.school_id == user.school_id,
            TemplateTagLink.tag_id == payload.tag_id,
            TemplateTagLink.target_type == payload.target_type,
            TemplateTagLink.target_id == payload.target_id,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This tag link already exists",
        )

    link = TemplateTagLink(
        school_id=user.school_id,
        tag_id=payload.tag_id,
        target_type=payload.target_type,
        target_id=payload.target_id,
    )

    db.add(link)
    db.commit()
    db.refresh(link)

    log_create(
        db=db,
        user=user,
        entity_type="template_tag_link",
        entity_id=link.id,
        details={"tag_id": link.tag_id, "target_type": link.target_type},
        request=request,
    )

    return TemplateTagLinkOut.model_validate(link)


@router.delete("/tag-links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template_tag_link(
    link_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """Delete a template tag link"""
    require_role(user, ["admin", "teacher"])

    link = (
        db.query(TemplateTagLink)
        .filter(
            TemplateTagLink.id == link_id,
            TemplateTagLink.school_id == user.school_id,
        )
        .first()
    )

    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Link not found"
        )

    log_delete(
        db=db,
        user=user,
        entity_type="template_tag_link",
        entity_id=link.id,
        details={"tag_id": link.tag_id, "target_type": link.target_type},
        request=request,
    )

    db.delete(link)
    db.commit()
