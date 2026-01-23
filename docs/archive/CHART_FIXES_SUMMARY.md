# Chart Display Fixes - Teacher Overview Page

## Issue Description
On the teacher overview page at `/teacher/overview?tab=leerlingoverzicht&subjectId={id}`, two charts were not displaying correctly:

1. **OMZA Trend Chart**: No data was being displayed
2. **Competency Profile (Radar Chart)**: Lines were extending from the center beyond the scale and not properly connected

## Root Cause Analysis

### Issue 1: OMZA Trend - No Data
**Problem**: The OMZATrendSection component was fetching data for ALL students in the course instead of the specific selected student.

**Root Cause**:
- Frontend component called `peerEvaluationOverviewService.getDashboard({ courseId })` without passing `studentId`
- Backend endpoint did not support filtering trend data by student
- Backend aggregated all students' scores in lines 1991-1998 of `overview.py`
- Result: Trend showed course-wide averages instead of individual student data

### Issue 2: Competency Profile - Lines Beyond Scale
**Problem**: The radar chart displayed lines extending from the center that appeared to go beyond the scale.

**Root Cause**:
- Categories with `null` or `undefined` scores were being mapped to `0` (line 133 in CompetencyProfileSection.tsx)
- This created data points at the center of the radar chart (radius = 0)
- Chart.js drew lines from these center points to other valid data points
- Visual effect: Lines appearing to extend beyond the scale, not properly connected

## Solutions Implemented

### Fix 1: OMZA Trend Student Filtering

**Backend Changes** (`/backend/app/api/v1/routers/overview.py`):
```python
# Added optional student_id parameter
@router.get("/peer-evaluations/dashboard")
def get_peer_evaluation_dashboard(
    course_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
    period: str = Query("6months"),
    student_name: Optional[str] = Query(None),
    student_id: Optional[int] = Query(None),  # NEW
    ...
)

# Modified trend data aggregation loop
for stud_id in eval_all_scores:
    if student_id is not None and stud_id != student_id:
        continue  # Skip if filtering and this isn't the target student
    
    student_omza = eval_all_scores[stud_id]
    # ... aggregate scores
```

**Frontend Changes**:
- Added `studentId` to `PeerOverviewFilters` type
- Updated service to pass `student_id` parameter
- Modified `OMZATrendSection` to include `studentId` in API call

### Fix 2: Competency Profile Null Handling

**Frontend Changes** (`CompetencyProfileSection.tsx`):
```typescript
// Filter out categories with no scores BEFORE rendering
const validCategoryScores = categoryScores.filter(
  c => c.avg_score !== null && c.avg_score !== undefined
);

const chartData = {
  labels: validCategoryScores.map((c) => c.category_name),
  datasets: [{
    data: validCategoryScores.map((c) => c.avg_score!),  // Non-null assertion
    // ... other properties
  }],
};

// Updated empty state check
validCategoryScores.length === 0 ? (
  <p>Geen data beschikbaar voor deze scan</p>
) : (
  <Radar data={chartData} options={chartOptions} />
)
```

## Backward Compatibility

All changes are **fully backward compatible**:

1. The `student_id` parameter is **optional** - existing API calls without it continue to work
2. When `student_id` is not provided, backend behaves exactly as before (aggregates all students)
3. Other components using the same endpoint (e.g., `EvaluationHeatmapSection`) are unaffected
4. The `usePeerOverview` hook and other existing consumers continue to function normally

## Testing Performed

- ✅ Code review completed and addressed
- ✅ Security scan (CodeQL) - No vulnerabilities found
- ✅ Python syntax validation - Passed
- ✅ Backward compatibility verified by reviewing all usages of `getDashboard`
- ⏳ Manual testing pending (requires running application)
- ⏳ Visual verification with screenshots pending

## Files Changed

1. `backend/app/api/v1/routers/overview.py` - Added student_id filtering
2. `frontend/src/services/peer-evaluation-overview.service.ts` - Added studentId parameter
3. `frontend/src/app/(teacher)/teacher/overview/components/student-overview/OMZATrendSection.tsx` - Pass studentId to API
4. `frontend/src/app/(teacher)/teacher/overview/components/student-overview/CompetencyProfileSection.tsx` - Filter null scores

## Expected Behavior After Fix

### OMZA Trend Chart
- Should display the individual student's OMZA scores over time
- Each data point represents the student's average score per category for that month
- Trends show how the specific student's scores change over the selected time period

### Competency Profile Chart
- Should display only categories that have actual score data
- Radar chart should properly connect all data points in a closed polygon
- No lines extending from the center or beyond the scale
- Categories without data are excluded from the visualization

## Notes

- The fix maintains the original behavior for the teacher's general peer evaluation overview (without student filtering)
- Student-specific views now correctly show individual data
- The implementation is minimal and surgical, changing only what's necessary to fix the issues
