# OMZA Focus Mode Implementation

## Overview
This document describes the implementation of the focus mode feature for the OMZA (Organiseren, Meedoen, Zelfvertrouwen, Autonomie) peer evaluations page. This feature allows teachers to view project notes alongside OMZA scores while filling them in.

## Problem Statement
The requirement was to add a focus mode to the peer evaluations OMZA tab, similar to the focus mode that exists for "docent projectbeoordeling rubrics". In this focus mode:
- **Left panel**: Display project notes from teams in that project (read-only)
- **Filter**: Category filter and search field for student names
- **Purpose**: To have notes visible next to the teacher while filling in OMZA scores

## Implementation

### 1. Created ProjectNotesPanel Component
**File**: `frontend/src/components/teacher/omza/ProjectNotesPanel.tsx`

This is a reusable component that displays project notes in a sidebar panel with:
- **Read-only view**: Notes cannot be edited or created from this panel
- **Filters**:
  - Search field for filtering by student/team name
  - Dropdown for filtering by OMZA category (Organiseren, Meedoen, Zelfvertrouwen, Autonomie)
- **Resizable**: The panel width can be adjusted by dragging the resize handle
- **Features**:
  - Loads project notes based on the evaluation's project_id
  - Displays notes with team name, student name, category tags
  - Shows timestamps for each note
  - Empty states for different scenarios (no project, no notes, no matches)

### 2. Modified OMZA Page
**File**: `frontend/src/app/(teacher)/teacher/evaluations/[evalId]/omza/page.tsx`

Added the following features:
- **Focus mode state**: Boolean state to track whether focus mode is active
- **Project ID loading**: Fetches the evaluation details to get the associated project_id
- **Sidebar collapse**: When focus mode is active, the main sidebar is collapsed to provide more space
- **Toggle button**: Added a button in the filter bar to toggle focus mode on/off
  - Only visible when the evaluation has an associated project
  - Shows different text based on focus mode state
- **Layout changes**: 
  - Wrapped the main content in a flex container
  - Added the ProjectNotesPanel on the left side when focus mode is active
  - Made the table responsive to accommodate the notes panel

### 3. Key Features

#### Focus Mode Toggle
```typescript
const [focusMode, setFocusMode] = useState(false);
const [notesWidth, setNotesWidth] = useState(400);
const { setSidebarCollapsed } = useTeacherLayout();
```

The toggle button appears in the filter bar:
```tsx
{projectId && (
  <button
    type="button"
    className={...}
    onClick={() => setFocusMode(!focusMode)}
  >
    📝 {focusMode ? "Verberg aantekeningen" : "Toon aantekeningen"}
  </button>
)}
```

#### Sidebar Collapse
When focus mode is active, the main application sidebar is collapsed to provide more horizontal space:
```typescript
useEffect(() => {
  setSidebarCollapsed(focusMode);
  return () => {
    setSidebarCollapsed(false);
  };
}, [focusMode, setSidebarCollapsed]);
```

#### Layout Structure
The layout uses CSS Flexbox to create a responsive two-column layout:
```tsx
<div className={`flex gap-4 ${focusMode ? 'h-[calc(100vh-300px)]' : ''}`}>
  {/* Notes panel (left side in focus mode) */}
  {focusMode && projectId && (
    <div className="flex-shrink-0" style={{ width: notesWidth }}>
      <ProjectNotesPanel ... />
    </div>
  )}
  
  {/* Table container */}
  <div className="flex-1 min-w-0">
    {/* OMZA table */}
  </div>
</div>
```

### 4. Data Flow

1. **Load Evaluation**: When the page loads, it fetches the evaluation details to get the `project_id`
2. **Load Project Notes**: The `ProjectNotesPanel` component:
   - Finds the project notes context for the given project_id
   - Loads all notes from that context using the timeline endpoint
   - Filters notes based on user input (search and category)
3. **Display**: Notes are displayed with proper formatting, showing:
   - Team name (if applicable)
   - Student name (if applicable)
   - OMZA category tag
   - Note text
   - Timestamp

### 5. User Experience

#### Enabling Focus Mode
1. Teacher navigates to the OMZA page for an evaluation
2. If the evaluation is linked to a project (has project notes), a toggle button appears
3. Clicking "Toon aantekeningen" activates focus mode:
   - Main sidebar collapses
   - Project notes panel appears on the left
   - Notes panel can be resized by dragging the border

#### Using Focus Mode
1. Teacher can filter notes by:
   - Typing in the search field (filters by student/team name)
   - Selecting an OMZA category from the dropdown
2. While viewing notes, teacher can:
   - See all project-related observations
   - Filter to specific students or categories
   - Reference notes while filling in OMZA scores

#### Exiting Focus Mode
1. Click "Verberg aantekeningen" button, OR
2. Click the X button in the notes panel header
3. The sidebar expands back and notes panel disappears

## Technical Details

### Dependencies
- **React hooks**: useState, useEffect, useCallback
- **Services**: 
  - `evaluationService`: To fetch evaluation details
  - `projectNotesService`: To fetch project notes
- **Layout context**: `useTeacherLayout` to control sidebar collapse

### Styling
- Uses Tailwind CSS for responsive design
- Focus mode button changes color based on state (emerald when active)
- Notes panel has a resize handle with hover effects
- Maintains consistent design with the rest of the application

### Performance
- Notes are loaded once when the panel opens
- Filtering is done client-side for instant results
- Proper cleanup with AbortController to prevent memory leaks

## Future Enhancements

Potential improvements could include:
1. **Keyboard shortcuts**: Add keyboard shortcuts to toggle focus mode
2. **Persistent state**: Remember focus mode preference per evaluation
3. **Direct note editing**: Allow teachers to edit notes from the focus mode panel
4. **Note highlighting**: Highlight notes that match the current student being scored
5. **Note creation**: Quick add note button while in focus mode

## Testing Notes

To test this feature:
1. Create an evaluation linked to a project
2. Add some project notes (teams and students)
3. Tag notes with OMZA categories
4. Navigate to the OMZA tab for that evaluation
5. Click "Toon aantekeningen" to enter focus mode
6. Verify filtering works correctly
7. Try resizing the panel
8. Test with evaluations that don't have project notes

## Related Files
- `frontend/src/components/teacher/omza/ProjectNotesPanel.tsx` - Notes panel component
- `frontend/src/app/(teacher)/teacher/evaluations/[evalId]/omza/page.tsx` - Main OMZA page
- `frontend/src/services/project-notes.service.ts` - API service for notes
- `frontend/src/app/(teacher)/layout.tsx` - Layout context for sidebar control
