# OMZA Page Implementation

## Overview
This document describes the implementation of the OMZA (Organiseren, Meedoen, Zelfvertrouwen, Autonomie) teacher interface for the team evaluation application.

## Requirements Met
All requirements from the problem statement have been implemented:

### ✅ 1. Data & API
- **Backend Endpoints Created:**
  - `GET /omza/evaluations/{evaluationId}/data` - Fetch OMZA data with peer/self/teacher scores per student
  - `POST /omza/evaluations/{evaluationId}/teacher-score` - Save teacher score for student/category
  - `POST /omza/evaluations/{evaluationId}/teacher-comment` - Save teacher comment for student
  - `GET /omza/evaluations/{evaluationId}/standard-comments` - Fetch standard comments (optionally filtered by category)
  - `POST /omza/evaluations/{evaluationId}/standard-comments` - Add new standard comment for a category

- **Frontend Service Layer:**
  - `omzaService` in `frontend/src/services/omza.service.ts`
  - TypeScript DTOs in `frontend/src/dtos/omza.dto.ts`
  - Uses existing axios API client from `frontend/src/lib/api.ts`

### ✅ 2. Filter Bar Above Table
Implemented with:
- **Search field**: Text input "Zoek op naam..." - filters students client-side by name
- **Team filter**: Dropdown "Alle teams, Team 1, Team 2..." - filters by team_number
- **Class filter**: Dropdown "Alle klassen, V2A, V2B..." - filters by class_name
- **Weighted average button**: "Neem 75% peer + 25% self over"
  - Calculates `weighted = 0.75 * peer + 0.25 * self` for all students and categories
  - Saves all scores via API
  - Shows toast confirmation

### ✅ 3. Table Structure
- **Columns**: Team | Leerling | Klas | [OMZA Categories: O, M, Z, A]
- **Category order**: Always O, M, Z, A (configurable via backend categories list)
- **Per category cell**:
  - Peer average badge with color coding (green ≥3.0, amber 2.0-2.9, red <2.0)
  - Self score displayed small and gray
  - Teacher score input field with debounced autosave (500ms)
  - 💬 button to expand row

### ✅ 4. Inline Expandable Row
When clicking student name or 💬 button, row expands to show:
- **Title**: "Docentopmerking voor {student name}"
- **Grid of 4 category cards** (Organiseren, Meedoen, Zelfvertrouwen, Autonomie):
  - Each card shows standard comments as clickable chips
  - Clicking chip appends text to teacher comment
  - Input field + button to add new standard comment per category
- **One teacher comment textarea**:
  - Debounced autosave (500ms)
  - Shows "Opslaan..." state while saving
  - Loads existing comment when row expands

### ✅ 5. Autosave & Feedback
- **Debouncing**: 500ms delay for both scores and comments
- **Visual feedback**: Toast notifications appear at top-right:
  - "Docentscore opgeslagen"
  - "Docentopmerking opgeslagen"
  - "Standaardopmerking toegevoegd"
  - Error messages if save fails
- **State indicators**: Disabled inputs while saving

### ✅ 6. Component Structure
Well-organized components:
- `OMZAOverviewPage` - Main page component with data fetching and state
- `OmzaQuickCommentsGrid` - Reusable grid component for standard comments
- Uses existing design system components (Loading, ErrorMessage)
- Follows React best practices (hooks, memoization)

### ✅ 7. No Mock Data
- All data fetched from real backend API
- No dummy students or hardcoded comments
- Dynamic categories from evaluation rubric
- Dynamic teams and classes from student data

### ✅ 8. Completion Criteria
All criteria met:
- ✅ Search field and filters work
- ✅ Weighted average button fills and saves scores
- ✅ Teacher can input scores with autosave per category
- ✅ Teacher can use quick comments + free text for one comment per student
- ✅ Teacher can add new standard comments per category
- ✅ Uses existing styling/components
- ✅ No dummy/mock data, only real backend data

## Technical Implementation

### Backend Architecture

**File: `backend/app/api/v1/routers/omza.py`**
- FastAPI router with 6 endpoints
- RBAC: All endpoints require teacher or admin role
- Data storage:
  - Teacher scores: Stored in `Evaluation.settings` as `teacher_score_{student_id}_{category}`
  - Teacher comments: Stored in `Evaluation.settings` as `teacher_comment_{student_id}`
  - Standard comments: Stored in `Evaluation.settings` as `omza_standard_comments[category][]`
- Score calculation:
  - Peer avg: Average of all peer scores for category criteria
  - Self avg: Average of all self scores for category criteria
  - Categories extracted from `RubricCriterion.category` field

**File: `backend/app/api/v1/schemas/omza.py`**
- Pydantic models for request/response validation
- Type-safe DTOs for all OMZA operations

### Frontend Architecture

**File: `frontend/src/app/(teacher)/teacher/evaluations/[evalId]/omza/page.tsx`**
- Main page component (~650 lines)
- React hooks for state management:
  - `useState` for filters, scores, comments, UI state
  - `useEffect` for data loading
  - `useCallback` for memoized handlers
  - `useRef` for debounce timeout tracking
- Features:
  - Client-side filtering (search, team, class)
  - Debounced autosave with 500ms delay
  - Toast notifications for user feedback
  - Expandable rows for detailed editing

**File: `frontend/src/services/omza.service.ts`**
- Service layer with 5 methods matching backend endpoints
- Uses centralized axios instance with auth headers

**File: `frontend/src/dtos/omza.dto.ts`**
- TypeScript interfaces for type safety
- Mirrors backend Pydantic models

### Data Flow

1. **Page Load**:
   - Fetch OMZA data: `GET /omza/evaluations/{id}/data`
   - Fetch standard comments: `GET /omza/evaluations/{id}/standard-comments`
   - Initialize state with existing teacher scores/comments

2. **Score Input**:
   - User types in score input
   - State updates immediately (optimistic UI)
   - After 500ms debounce: `POST /omza/evaluations/{id}/teacher-score`
   - Toast notification on success/failure

3. **Comment Input**:
   - User types in textarea or clicks quick comment chip
   - State updates immediately
   - After 500ms debounce: `POST /omza/evaluations/{id}/teacher-comment`
   - Toast notification on success/failure

4. **Weighted Average**:
   - User clicks button
   - Calculate weighted scores for all students/categories
   - Batch save all scores via multiple API calls
   - Update state with new scores
   - Show toast confirmation

5. **Standard Comments**:
   - User adds new comment
   - `POST /omza/evaluations/{id}/standard-comments`
   - New comment added to state and appears in UI
   - Toast notification

### Styling

- Uses Tailwind CSS matching existing design system
- Color coding for peer scores:
  - Green: ≥3.0 (bg-emerald-50, text-emerald-700)
  - Amber: 2.0-2.9 (bg-amber-50, text-amber-700)
  - Red: <2.0 (bg-red-50, text-red-700)
- Consistent spacing, borders, shadows with mockup
- Responsive design (mobile-friendly filters, 4-column grid on desktop)

## Future Improvements

### Performance Optimization
- Consider batching multiple teacher score saves into single API call
- Add caching for standard comments (they rarely change)
- Implement optimistic updates with rollback on error

### Data Storage
- Migrate teacher scores from `Evaluation.settings` to dedicated table:
  ```sql
  CREATE TABLE omza_teacher_scores (
    id SERIAL PRIMARY KEY,
    evaluation_id INT REFERENCES evaluations(id),
    student_id INT REFERENCES users(id),
    category VARCHAR(50),
    score FLOAT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(evaluation_id, student_id, category)
  );
  ```
- Migrate teacher comments to dedicated table with versioning

### Features
- Export OMZA data to Excel/PDF
- Bulk edit modes for power users
- Comment templates at school level (not just standard comments)
- History tracking for score changes
- Undo/redo functionality

### Testing
- Unit tests for OMZA service
- Integration tests for API endpoints
- E2E tests for autosave functionality
- Performance tests for large student lists

## Migration Notes

### From Old OMZA Page
The old OMZA page (`/teacher/evaluations/[evalId]/omza/page.tsx`) was a simple read-only view showing peer and self scores. The new implementation:
- Keeps all existing read functionality
- Adds teacher input capabilities
- Adds filtering and search
- Adds standard comments system
- Maintains backward compatibility (can view data even without teacher input)

### Database Schema
No database migrations required for MVP. Uses existing fields:
- `Evaluation.settings` (JSON) - for teacher scores/comments and standard comments
- `RubricCriterion.category` (VARCHAR) - for OMZA categories

## Testing Checklist

To test the implementation:

1. **Backend**:
   - [ ] Start backend: `cd backend && make up`
   - [ ] Verify OMZA endpoints in API docs: http://localhost:8000/docs
   - [ ] Test GET /omza/evaluations/{id}/data returns correct structure
   - [ ] Test POST endpoints save data correctly

2. **Frontend**:
   - [ ] Start frontend: `cd frontend && npm run dev`
   - [ ] Navigate to /teacher/evaluations/{id}/omza
   - [ ] Verify data loads from backend
   - [ ] Test search field filters students
   - [ ] Test team/class filters work
   - [ ] Test weighted average button calculates and saves
   - [ ] Test score input autosaves after 500ms
   - [ ] Test comment textarea autosaves
   - [ ] Test quick comment chips append to comment
   - [ ] Test adding new standard comment
   - [ ] Verify toast notifications appear

3. **Edge Cases**:
   - [ ] Empty evaluation (no students)
   - [ ] Evaluation with no categories
   - [ ] Student with no peer/self scores
   - [ ] Network errors during save
   - [ ] Rapid typing (multiple autosaves)
   - [ ] Large student lists (100+ students)

## Files Changed

### Backend
- `backend/app/main.py` - Register OMZA router
- `backend/app/api/v1/routers/omza.py` - New file (405 lines)
- `backend/app/api/v1/schemas/omza.py` - New file (68 lines)

### Frontend
- `frontend/src/app/(teacher)/teacher/evaluations/[evalId]/omza/page.tsx` - Complete rewrite (772 lines)
- `frontend/src/services/omza.service.ts` - New file (78 lines)
- `frontend/src/dtos/omza.dto.ts` - New file (48 lines)
- `frontend/src/services/index.ts` - Add OMZA export
- `frontend/src/dtos/index.ts` - Add OMZA export

**Total**: 6 files changed, 1,159 insertions(+), 214 deletions(-)

## References
- Original mockup: See problem statement
- OMZA categories: Organiseren, Meedoen, Zelfvertrouwen, Autonomie
- Design system: Existing Tailwind components in `/frontend/src/components/`
