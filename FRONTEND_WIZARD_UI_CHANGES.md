# Frontend Wizard UI Changes - Visual Guide

## Overview

The wizard form has been significantly enhanced to support the new backend API structure with deadlines, rubrics, and competency selection.

## Step 2: Evaluations - New UI

### Before
- Simple checkboxes for each evaluation type
- No additional configuration options
- Boolean flags only

### After - Enhanced Configuration

#### Peerevaluatie Tussentijds
```
☑️ Peerevaluatie tussentijds
   Studenten beoordelen elkaar halverwege het project
   
   ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ (expandable section) ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
   
   Deadline: [datetime picker] 2025-06-30T23:59
   
   Rubric (optioneel): [dropdown]
   └── Gebruik standaard peer rubric
   └── Peer Rubric v1
   └── Peer Rubric v2
```

#### Peerevaluatie Eind
```
☑️ Peerevaluatie eind
   Studenten beoordelen elkaar aan het einde van het project
   
   ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ (expandable section) ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
   
   Deadline: [datetime picker] 2025-12-31T23:59
   
   Rubric (optioneel): [dropdown]
   └── Gebruik standaard peer rubric
   └── Peer Rubric v1
```

#### Projectbeoordeling
```
☑️ Projectbeoordeling
   Docent beoordeelt het projectresultaat per team
   
   ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ (expandable section) ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
   
   Rubric *: [dropdown - REQUIRED]
   └── Selecteer project rubric...
   └── Project Rubric v1
   └── Project Rubric v2
   
   ℹ️ Er wordt één beoordeling per team aangemaakt
   
   Deadline (optioneel): [datetime picker]
   
   Versie (optioneel): [text input] bijv. tussentijds, eind
```

#### Competentiescan
```
☑️ Competentiescan
   Studenten vullen een competentiescan in voor dit project
   
   ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ (expandable section) ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
   
   Titel (optioneel): [text input] bijv. Q1 Competentiescan
   
   Startdatum: [datetime picker]  Einddatum: [datetime picker]
   
   Deadline (optioneel): [datetime picker]
   
   Competenties: [scrollable checklist]
   ┌──────────────────────────────────┐
   │ ☑️ Samenwerken                   │
   │ ☑️ Communiceren                  │
   │ ☑️ Probleemoplossend vermogen    │
   │ ☐ Creativiteit                   │
   │ ☐ Zelfstandigheid                │
   │ ☐ Plannen & Organiseren          │
   └──────────────────────────────────┘
```

## Step 4: Bevestigen - Enhanced Summary

### Before
```
Evaluaties
✓ Peerevaluatie tussentijds
✓ Peerevaluatie eind
✓ Projectbeoordeling
```

### After
```
Evaluaties

✓ Peerevaluatie tussentijds
  Deadline: 30-06-2025 23:59

✓ Peerevaluatie eind
  Deadline: 31-12-2025 23:59

✓ Projectbeoordeling
  Rubric: Project Rubric v1
  Deadline: 30-06-2025 23:59

✓ Competentiescan
  3 competenties geselecteerd
  Periode: 01-01-2025 - 30-06-2025
```

## Success Screen - Enhanced

### Before
```
✅
Project aangemaakt!
Het project "Klimaatonderzoek 5V1" is succesvol aangemaakt met alle geselecteerde evaluaties.

[Ga naar Projectbeoordelingen] [Ga naar Peerevaluaties] [Terug naar Dashboard]
```

### After
```
✅
Project aangemaakt!
Het project "Klimaatonderzoek 5V1" is succesvol aangemaakt.

⚠️ Waarschuwingen (if any)
• Course 1 has no groups. Please create groups before creating project assessments...

Aangemaakt:
✓ 2 Peerevaluaties
✓ 4 Projectbeoordelingen (one per group)
✓ 1 Competentiescan

[Ga naar Projectbeoordelingen] [Ga naar Peerevaluaties] [Ga naar Competentiescans] [Terug naar Dashboard]
```

## Key UI Improvements

### 1. Expandable Configuration Sections
- Sections only show when the checkbox is enabled
- Reduces visual clutter
- Progressive disclosure pattern

### 2. Visual Hierarchy
- Colored left borders for each evaluation type:
  - Blue for Peer evaluations
  - Green for Project assessments
  - Purple for Competency scans

### 3. Field Indicators
- Required fields marked with red asterisk (*)
- Optional fields clearly labeled
- Helper text for complex fields

### 4. Loading States
- Shows loading spinner while fetching rubrics/competencies
- Prevents user from proceeding until data is loaded
- Error handling with retry option

### 5. Smart Navigation
- Success screen buttons adapt to created entity types
- Only shows relevant navigation options
- Prioritizes the most important actions

### 6. Warning Display
- Yellow alert box for warnings
- Bullet list format for multiple warnings
- Clear, actionable messages

## Technical Implementation Details

### State Management
- Individual state variables for each configuration option
- Cleaner than nested object updates
- Easier to validate and debug

### Data Loading
- Rubrics loaded when Step 2 is reached
- Competencies loaded when Step 2 is reached
- Clients loaded when Step 3 is reached (unchanged)

### Validation
- Project assessment requires rubric selection
- Visual feedback for required fields
- Cannot submit without required data

### Response Handling
```typescript
// Count entities by type
const peerCount = createdEntities.filter(e => e.type === "peer").length;
const projectAssessmentCount = createdEntities.filter(e => e.type === "project_assessment").length;
const competencyScanCount = createdEntities.filter(e => e.type === "competency_scan").length;

// Show warnings
if (wizardWarnings.length > 0) {
  // Display yellow alert box
}

// Show appropriate navigation buttons
{projectAssessmentCount > 0 && (
  <button>Ga naar Projectbeoordelingen</button>
)}
```

## Accessibility Features

- Semantic HTML labels
- Keyboard navigation support (native browser controls)
- Clear focus indicators
- Screen reader friendly
- Color contrast compliant

## Browser Compatibility

- Native datetime-local inputs (HTML5)
- Fallback to text input on older browsers
- Progressive enhancement approach

## Future Enhancements

Potential future improvements:
1. Date validation (deadline after start date)
2. Rubric preview on hover
3. Competency description tooltips
4. Save draft functionality
5. Template/preset configurations
6. Bulk deadline setting
7. Calendar view for deadlines

## Migration Notes

### Breaking Changes
None for users - the UI is enhanced, not replaced.

### Backend Compatibility
- New structure is sent to backend
- Legacy boolean flags removed from UI
- Backend handles both old and new format (backward compatible DTOs)

### Data Flow
```
Frontend Form
    ↓
Build nested config object
    ↓
Send to backend /wizard-create
    ↓
Backend creates appropriate entity types
    ↓
Return mixed entity list with warnings
    ↓
Frontend displays success + warnings
    ↓
Route user to appropriate management page
```

## Testing Checklist

- [ ] All evaluation types can be enabled/disabled
- [ ] Datetime pickers work correctly
- [ ] Rubric dropdowns populate correctly
- [ ] Competency checkboxes work
- [ ] Required validation works for project assessment rubric
- [ ] Summary shows all configured details
- [ ] Success screen shows correct entity counts
- [ ] Warnings display properly
- [ ] Navigation buttons work
- [ ] Loading states display
- [ ] Error handling works
- [ ] Mobile responsive (not yet tested)
