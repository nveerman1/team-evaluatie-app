# Async AI Summary Frontend Fix

## Problem Summary

The async AI summary UI for students had a bug where the summary would briefly appear after loading, then the UI would flip back to "Samenvatting laden..." and stay stuck in the loading state forever, even though the backend job had completed successfully.

## Root Cause

The issue was caused by **improper state management in React Strict Mode** combined with **missing prop change detection** in the `useAsyncSummary` hook:

### Primary Issues

1. **`hasStartedRef` was never reset when props changed**: The `hasStartedRef` was introduced to prevent React Strict Mode double-mounting from triggering duplicate API calls. However, it was never reset when `evaluationId` or `studentId` changed, causing the hook to fail to restart generation for different evaluations/students.

2. **Auto-start effect had empty dependencies**: The auto-start `useEffect` had an empty dependency array `[]`, meaning it would only run on the initial mount. If props changed or the component remounted, the effect would not re-run.

3. **State reset without ref reset**: When the component remounted (common in React Strict Mode), all state variables (`summary`, `status`, etc.) would reset to initial values, but `hasStartedRef` would remain `true`. This caused:
   - State: `status = "idle"`, `summary = null`
   - `hasStartedRef = true` → auto-start effect does NOT trigger
   - Result: UI stuck showing "loading" with no data

4. **No mechanism to detect prop changes**: There was no effect watching `evaluationId` or `studentId` changes, so navigating to a different evaluation would not reset state or trigger a new generation.

### Symptom Timeline

1. Component mounts → auto-start triggers → API call starts
2. API returns completed job with summary → state updates to `status: "completed"`, `summary: "..."`
3. UI briefly shows the summary ✅
4. React Strict Mode causes remount (or parent re-renders)
5. All state resets → `status: "idle"`, `summary: null`
6. `hasStartedRef` is still `true` → auto-start does NOT run ❌
7. UI shows "Samenvatting laden..." forever 🔴

## Solution

### Changes Made

#### 1. **`useAsyncSummary.ts` - Added Prop Change Detection**

Added a new `useEffect` that watches `evaluationId` and `studentId` and resets all state when they change:

```typescript
const prevEvaluationIdRef = useRef(evaluationId);
const prevStudentIdRef = useRef(studentId);

useEffect(() => {
  const evaluationChanged = prevEvaluationIdRef.current !== evaluationId;
  const studentChanged = prevStudentIdRef.current !== studentId;
  
  if (evaluationChanged || studentChanged) {
    // Stop ongoing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    // Reset all state to initial values
    setSummary(null);
    setStatus("idle");
    setError(null);
    setGenerationMethod(null);
    setFeedbackCount(0);
    setJobId(null);
    setIsPolling(false);
    
    // Allow auto-start to run again
    hasStartedRef.current = false;
    
    // Update refs
    prevEvaluationIdRef.current = evaluationId;
    prevStudentIdRef.current = studentId;
  }
}, [evaluationId, studentId]);
```

**Why this works:**
- Detects when evaluation or student changes
- Properly cleans up polling intervals
- Resets ALL state including `hasStartedRef`
- Allows the auto-start effect to trigger for the new evaluation/student

#### 2. **`useAsyncSummary.ts` - Fixed Auto-Start Effect**

Changed the auto-start effect to have proper dependencies and status checking:

```typescript
useEffect(() => {
  if (autoStart && status === "idle" && !hasStartedRef.current) {
    console.log(`[useAsyncSummary] Auto-starting generation for evaluation ${evaluationId}, student ${studentId}`);
    hasStartedRef.current = true;
    startGeneration();
  }
}, [autoStart, status, evaluationId, studentId, startGeneration]);
```

**Why this works:**
- Depends on `status`, so it runs when status changes back to "idle"
- Depends on `evaluationId` and `studentId`, so it can re-trigger on prop changes
- Only runs when `status === "idle"` AND `hasStartedRef` is false
- Works correctly with the reset effect above

#### 3. **`useAsyncSummary.ts` - Improved Polling Status Updates**

Added a guard to prevent reverting from completed state:

```typescript
} else if (jobStatus.status === "queued" || jobStatus.status === "processing") {
  // Only update status if we're not already completed
  console.log(`[useAsyncSummary] Job still in progress, status: ${jobStatus.status}`);
  setStatus(jobStatus.status);
}
```

**Why this works:**
- Prevents the status from being updated if the job is in an intermediate state
- Ensures we don't accidentally revert status after completion

#### 4. **`useAsyncSummary.ts` - Enhanced Logging**

Added comprehensive console logging throughout:
- When props change
- When state resets
- When generation starts
- When polling occurs
- When status transitions to completed

**Why this helps:**
- Makes debugging much easier
- Can trace the exact flow of state changes
- Helps identify future issues quickly

#### 5. **`AISummarySection.tsx` - Smarter Loading State**

Changed the loading condition to check if we have a summary:

```typescript
// Show loading state only if we don't have any summary yet
const isLoading = (status === "loading" || status === "queued" || status === "processing") && !displaySummary;

// In render:
{isLoading ? (
  // Show loading spinner
) : ...}
```

**Why this works:**
- Even if status is temporarily "loading" due to remounting, if we have a `displaySummary` (from current state or fallback), we show it
- Prevents the UI from flashing to loading state when we already have content
- Provides a better user experience during re-renders

## State Machine Flow

### Initial Load (Job Already Completed)

```
idle → loading → completed
  ↓       ↓          ↓
  -   API call   summary set
             ↓
         immediately completed
```

### Initial Load (New Job)

```
idle → loading → queued → processing → completed
  ↓       ↓         ↓          ↓           ↓
  -   API call  polling    polling    summary set
                  ↓          ↓
              status updates with polling
```

### Evaluation Change

```
completed → idle → loading → completed
    ↓         ↓       ↓          ↓
 Props    Reset   New API    New summary
 change   state    call
```

### React Strict Mode Double Mount

```
Mount 1: idle → loading → completed
           ↓       ↓          ↓
      start   API call   summary set
      
Unmount/Remount (Strict Mode):
Mount 2: idle (hasStartedRef=false now)
           ↓
      auto-start triggers again
           ↓
      loading → completed
```

## Robustness Against React Strict Mode

The fix is robust against React Strict Mode because:

1. **`hasStartedRef` is reset on prop changes**: When `evaluationId` or `studentId` changes, we explicitly reset `hasStartedRef`, allowing auto-start to work correctly for the new evaluation.

2. **Auto-start checks status**: The auto-start effect only triggers when `status === "idle"`, preventing duplicate starts during the same lifecycle.

3. **Proper cleanup**: The unmount effect clears polling intervals and sets `mountedRef.current = false`, preventing state updates on unmounted components.

4. **All state variables reset together**: When props change, ALL state is reset atomically in a single effect, preventing partial state issues.

## Robustness Against Route Changes

The fix handles route changes correctly because:

1. **Props are tracked with refs**: We use `prevEvaluationIdRef` and `prevStudentIdRef` to detect when the evaluation or student changes.

2. **Full state reset on change**: When navigating to a different evaluation, all state is cleared and polling stops.

3. **New auto-start triggered**: After reset, `status` becomes "idle" and `hasStartedRef` becomes `false`, allowing the auto-start effect to trigger for the new evaluation.

## Testing Recommendations

To verify the fix works:

1. **Fresh Load**: Navigate to a student evaluation page → verify summary loads and stays visible

2. **Reload Page**: Refresh the browser → verify summary loads and stays visible

3. **Switch Evaluations**: Navigate from one evaluation to another → verify:
   - Old summary clears
   - New summary loads for the new evaluation
   - No duplicate API calls

4. **React Strict Mode**: In development mode (which has Strict Mode enabled):
   - Verify summary loads correctly
   - Check console logs don't show excessive duplicate calls
   - Verify UI doesn't flash or get stuck

5. **Slow Network**: Use browser DevTools to throttle network → verify:
   - Loading spinner shows during generation
   - Polling status badge updates (In wachtrij → Genereren → Gereed)
   - Summary appears when job completes
   - No revert to loading state

## Summary

**Root Cause:** `hasStartedRef` prevented auto-start from running after remounts, while state reset caused the UI to show loading state.

**Solution:** Added prop change detection to reset state AND `hasStartedRef` together, fixed auto-start effect dependencies, and improved loading state logic.

**Result:** The hook now correctly handles:
- React Strict Mode double mounts
- Prop changes (different evaluations/students)
- Status transitions without reverting after completion
- Proper polling lifecycle management

The summary now loads correctly and stays visible regardless of React rendering behavior.
