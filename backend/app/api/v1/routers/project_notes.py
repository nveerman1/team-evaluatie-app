"""
PROJECT NOTES API ENDPOINTS
===========================

This module will provide endpoints for the Projectaantekeningen (Project Notes) feature.
Teachers can create notes on projects, teams, and individual students, linking observations
to OMZA categories and competencies.

TODO: Implement these endpoints once database models are created.

ENDPOINTS TO IMPLEMENT:
-----------------------

1. GET /api/v1/project-notes/contexts
   - List all project note contexts for the logged-in teacher
   - Query params: course_id (optional), class_name (optional), status (optional)
   - Returns: List of ProjectNotesContextOut

2. POST /api/v1/project-notes/contexts
   - Create a new project notes context
   - Body: ProjectNotesContextCreate
   - Returns: ProjectNotesContextOut

3. GET /api/v1/project-notes/contexts/{context_id}
   - Get details of a specific project notes context
   - Includes basic info about teams and students
   - Returns: ProjectNotesContextDetailOut

4. PUT /api/v1/project-notes/contexts/{context_id}
   - Update a project notes context (title, description, etc.)
   - Body: ProjectNotesContextUpdate
   - Returns: ProjectNotesContextOut

5. DELETE /api/v1/project-notes/contexts/{context_id}
   - Delete a project notes context and all its notes
   - Returns: 204 No Content

6. GET /api/v1/project-notes/contexts/{context_id}/notes
   - Get all notes for a specific context
   - Query params: note_type (project|team|student), team_id, student_id, 
                   omza_category, from_date, to_date
   - Returns: List of ProjectNoteOut

7. POST /api/v1/project-notes/contexts/{context_id}/notes
   - Create a new note (project-wide, team, or student)
   - Body: ProjectNoteCreate
   - Returns: ProjectNoteOut

8. GET /api/v1/project-notes/notes/{note_id}
   - Get a specific note by ID
   - Returns: ProjectNoteOut

9. PUT /api/v1/project-notes/notes/{note_id}
   - Update a note
   - Body: ProjectNoteUpdate
   - Returns: ProjectNoteOut

10. DELETE /api/v1/project-notes/notes/{note_id}
    - Delete a specific note
    - Returns: 204 No Content

11. GET /api/v1/project-notes/contexts/{context_id}/timeline
    - Get chronological timeline of all notes in a context
    - Returns: List of ProjectNoteOut sorted by created_at desc

12. GET /api/v1/project-notes/contexts/{context_id}/export
    - Export all notes as CSV or JSON
    - Query params: format (csv|json)
    - Returns: StreamingResponse

"""

# Example implementation structure (commented out until models are ready):

# from fastapi import APIRouter, Depends, HTTPException, Query
# from sqlalchemy.orm import Session
# from typing import List, Optional
# 
# from app.api.v1.deps import get_db, get_current_user
# from app.infra.db.models import User, ProjectNotesContext, ProjectNote
# from app.api.v1.schemas.project_notes import (
#     ProjectNotesContextOut,
#     ProjectNotesContextCreate,
#     ProjectNotesContextUpdate,
#     ProjectNotesContextDetailOut,
#     ProjectNoteOut,
#     ProjectNoteCreate,
#     ProjectNoteUpdate,
# )
# 
# router = APIRouter(prefix="/project-notes", tags=["project-notes"])
# 
# 
# @router.get("/contexts", response_model=List[ProjectNotesContextOut])
# async def list_contexts(
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user),
#     course_id: Optional[int] = Query(None),
#     class_name: Optional[str] = Query(None),
# ):
#     """List all project note contexts for the current teacher."""
#     # Implementation here
#     pass
# 
# 
# @router.post("/contexts", response_model=ProjectNotesContextOut)
# async def create_context(
#     data: ProjectNotesContextCreate,
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     """Create a new project notes context."""
#     # Implementation here
#     pass
# 
# 
# @router.get("/contexts/{context_id}", response_model=ProjectNotesContextDetailOut)
# async def get_context(
#     context_id: int,
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     """Get details of a specific project notes context."""
#     # Implementation here
#     pass
# 
# 
# @router.post("/contexts/{context_id}/notes", response_model=ProjectNoteOut)
# async def create_note(
#     context_id: int,
#     data: ProjectNoteCreate,
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     """Create a new note in the context."""
#     # Implementation here
#     pass
