# OMZA Trends Chart Fix Summary

## Issue
The "OMZA Trends over tijd" (OMZA Trends over time) graph on the `/teacher/overview?tab=peerevaluaties` page was not displaying any data, while the table below it was showing data correctly.

## Root Cause
The backend endpoint `/overview/peer-evaluations/dashboard` had inconsistent logic between:
- **Trend data generation** (lines 1990-2002): Only aggregated peer scores, no fallback to self scores
- **Heatmap data generation** (line 1847): Used peer scores with fallback to self scores

When evaluations contained only self-evaluations or had missing peer scores, the trend data would be empty while the heatmap table would still display data using the self scores.

## Solution
Modified `backend/app/api/v1/routers/overview.py` to add fallback logic to the trend data generation:

**Before:**
```python
# Only used peer scores
peer_score = student_omza.get(cat_name, {}).get("peer")
if peer_score is not None:
    monthly_data[month_key][cat_name].append(float(peer_score))
```

**After:**
```python
# Use peer score if available, otherwise fall back to self score
peer_score = student_omza.get(cat_name, {}).get("peer")
self_score = student_omza.get(cat_name, {}).get("self")
score = peer_score if peer_score is not None else self_score
if score is not None:
    monthly_data[month_key][cat_name].append(float(score))
```

## Impact
- The OMZA Trends chart will now display data consistently with the heatmap table
- Charts will show trends even when only self-evaluations are available
- Maintains data consistency across the peer evaluations overview page

## Testing
- ✅ Python syntax validation passed
- ✅ Code review completed with no issues
- ✅ Security scan (CodeQL) found no vulnerabilities
- ✅ Logic aligns with existing heatmap behavior

## Files Changed
- `backend/app/api/v1/routers/overview.py` (lines 1990-2002)
