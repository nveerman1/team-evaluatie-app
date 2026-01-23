# Student Dashboard Redesign

## Overview
This document describes the redesigned student dashboard that implements a tab-based layout with enhanced navigation and filtering capabilities.

## Wireframe Requirements
The student dashboard was redesigned based on the following requirements:

### Header Section
- Title: "Mijn Dashboard" with description
- Three clickable statistics tiles:
  - **Open Evaluaties** (📋) - Shows count of open evaluations
  - **Reflecties Open** (💭) - Shows count of pending reflections
  - **Voltooide Evaluaties** (✅) - Shows count of completed evaluations
- Tiles are clickable and act as filters for the content

### Tab Navigation
Three tabs provide organized access to different areas:
1. **Evaluaties** - Overview of evaluations and peer-feedback results
2. **Competentiescan** - Placeholder for future self-assessment scans
3. **Projectbeoordelingen** - Overview of project assessments from teachers

### Toolbar (Each Tab)
Each tab includes a consistent toolbar with:
- Search field with magnifying glass icon (🔍)
- Status filter dropdown (Alle, Open, Afgesloten)
- "Filters" button for future advanced filtering

### Content Layout
- Grid layout with cards (responsive: 1 column on mobile, 2-3 on desktop)
- Each card type shows relevant information with status badges

## Implementation

### New Components Created

#### 1. StatTile Component
**File:** `/frontend/src/components/StatTile.tsx`

```typescript
type StatTileProps = {
  icon: string;        // Emoji icon
  label: string;       // Tile label
  value: number;       // Numeric value to display
  bgColor?: string;    // Background color (Tailwind class)
  textColor?: string;  // Text color (Tailwind class)
  onClick?: () => void; // Optional click handler
};
```

**Features:**
- Displays icon, label, and numeric value
- Supports custom background and text colors
- Clickable with hover effects when onClick is provided
- Responsive sizing

**Usage Example:**
```tsx
<StatTile
  icon="📋"
  label="Open Evaluaties"
  value={5}
  bgColor="bg-blue-50"
  textColor="text-blue-700"
  onClick={() => filterByStatus("open")}
/>
```

#### 2. Tabs Component
**File:** `/frontend/src/components/Tabs.tsx`

```typescript
type Tab = {
  id: string;
  label: string;
  content: ReactNode;
};

type TabsProps = {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
};
```

**Features:**
- Tab navigation with visual active state
- Supports multiple tabs with individual content
- Accessible with ARIA attributes
- Smooth transitions

**Usage Example:**
```tsx
<Tabs
  tabs={[
    { id: "tab1", label: "Tab 1", content: <div>Content 1</div> },
    { id: "tab2", label: "Tab 2", content: <div>Content 2</div> }
  ]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>
```

#### 3. Toolbar Component
**File:** `/frontend/src/components/Toolbar.tsx`

```typescript
type ToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onFiltersClick?: () => void;
};
```

**Features:**
- Search input with icon
- Status filter dropdown
- Optional filters button
- Responsive layout (stacks on mobile)

**Usage Example:**
```tsx
<Toolbar
  searchValue={search}
  onSearchChange={setSearch}
  statusFilter={status}
  onStatusFilterChange={setStatus}
  onFiltersClick={() => console.log("Show filters")}
/>
```

### Updated Student Dashboard

#### File: `/frontend/src/app/student/page.tsx`

**Key Changes:**
1. Added state management for:
   - Active tab selection
   - Search and filter states per tab
   - Memoized filtered data

2. Replaced static statistics cards with clickable StatTile components

3. Implemented tab-based layout with three tabs:
   - **Evaluaties Tab:**
     - Toolbar for search and filtering
     - Evaluation cards with progress bars
     - Peer-feedback results section
   
   - **Competentiescan Tab:**
     - Toolbar (ready for future implementation)
     - Placeholder message
   
   - **Projectbeoordelingen Tab:**
     - Toolbar for search
     - Enhanced project assessment cards showing:
       - Title
       - Team name
       - Teacher name (if available)
       - Publication date
       - "Gepubliceerd" status badge

4. Added filtering logic:
   - Evaluations filtered by title and status
   - Project assessments filtered by title and team name
   - Stat tiles click to switch to Evaluaties tab with appropriate filter

5. Enhanced project assessment cards with more details

## Data Flow

### State Management
```
Dashboard State (from useStudentDashboard hook)
├── openEvaluations
├── completedEvaluations
├── pendingReflections
├── pendingReviews
├── hasAnyEvaluations
└── needsSelfAssessment

Project Assessments State (from useStudentProjectAssessments hook)
├── assessments
├── loading
└── error

Local Component State
├── activeTab (current tab selection)
├── evaluatiesSearch (search text for evaluations)
├── evaluatiesStatus (status filter for evaluations)
├── competentiescanSearch
├── competentiescanStatus
├── projectSearch
└── projectStatus
```

### Filtering Pipeline
1. Raw data fetched from hooks
2. Memoized filtering based on search and status
3. Filtered results displayed in cards
4. Updates automatically when filters change

## User Interactions

### Stat Tile Clicks
- Click "Open Evaluaties" → Switch to Evaluaties tab + filter by "open"
- Click "Reflecties Open" → Switch to Evaluaties tab
- Click "Voltooide Evaluaties" → Switch to Evaluaties tab + filter by "closed"

### Tab Navigation
- Click any tab to switch views
- Active tab highlighted with black underline
- Tab content updates immediately

### Search & Filters
- Type in search field → Real-time filtering
- Change status dropdown → Immediate filter update
- Clear search to show all items

## Responsive Design

### Mobile (< 768px)
- Toolbar items stack vertically
- Cards display in single column
- Tabs remain horizontal with adequate spacing

### Desktop (≥ 768px)
- Toolbar items in a row
- Cards in 2-3 column grid
- More spacious layout

## Future Enhancements

### Competentiescan Tab
Ready to implement:
- Scan cards with progress bars
- "Invullen" or "Bekijk" buttons
- Status tracking

### Advanced Filters
The "Filters" button is ready for:
- Date range filtering
- Multiple status selection
- Custom filter presets
- Filter persistence

### Stat Tile Features
Could add:
- Trend indicators (up/down arrows)
- Tooltips with more details
- Visual sparklines
- Color-coded urgency levels

## Testing Considerations

### Unit Tests
- Test filtering logic with various inputs
- Test stat tile click handlers
- Test tab switching
- Test search functionality

### Integration Tests
- Test with real API data
- Test loading and error states
- Test empty states
- Test with different user permissions

### E2E Tests
- Navigate between tabs
- Use search and filters
- Click stat tiles and verify filtering
- Verify responsive behavior

## Accessibility

- All interactive elements are keyboard accessible
- ARIA labels on tabs
- Proper focus management
- Color contrast meets WCAG standards
- Screen reader friendly structure

## Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Next.js 15.5.4
- React 19.1.0
- Tailwind CSS 4.1.14

## Performance Optimizations
- Memoized filter calculations
- Lazy evaluation of tab content
- Optimized re-renders with React hooks
- Efficient search algorithms

## Migration Notes
- Previous version had sections instead of tabs
- All existing functionality preserved
- Data fetching unchanged
- New components are reusable across the app

## Related Files
- `/frontend/src/components/StatTile.tsx`
- `/frontend/src/components/Tabs.tsx`
- `/frontend/src/components/Toolbar.tsx`
- `/frontend/src/components/index.ts`
- `/frontend/src/app/student/page.tsx`
- `/frontend/src/components/student/EvaluationCard.tsx` (unchanged)
- `/frontend/src/hooks/useStudentDashboard.ts` (unchanged)
- `/frontend/src/hooks/useStudentProjectAssessments.ts` (unchanged)
