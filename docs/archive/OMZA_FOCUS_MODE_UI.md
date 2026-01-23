# OMZA Focus Mode - UI Description

## Layout Structure

### Before Focus Mode (Normal View)
```
┌─────────────────────────────────────────────────────────┐
│  [Sidebar]  │  OMZA Page Header                        │
│             │  ─────────────────────────────────────   │
│   Nav       │  Filter Bar:                             │
│   Links     │  [Search] [Team Filter] [Class Filter]   │
│             │  [📝 Toon aantekeningen] [Neem peer]     │
│             │                                           │
│             │  ┌───────────────────────────────────┐   │
│             │  │ OMZA Scores Table                 │   │
│             │  │ Team | Name | Class | O | M | Z  │   │
│             │  │ ──────────────────────────────────│   │
│             │  │  1   | John |  5A  | ⚪⚪⚪⚪    │   │
│             │  │  1   | Mary |  5A  | ⚪⚪⚪⚪    │   │
│             │  └───────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### After Focus Mode (With Project Notes)
```
┌──────────────────────────────────────────────────────────────────┐
│  OMZA Page Header                                                │
│  ──────────────────────────────────────────────────────────────  │
│  Filter Bar:                                                     │
│  [Search] [Team Filter] [Class Filter]                          │
│  [📝 Verberg aantekeningen] [Neem peer]                         │
│  ──────────────────────────────────────────────────────────────  │
│  ┌──────────────────┐│┌────────────────────────────────────┐   │
│  │ Project Notes    │││ OMZA Scores Table                  │   │
│  │ ──────────────── │││                                     │   │
│  │ [Search student] │││ Team | Name | O | M | Z | A        │   │
│  │ [Category ▼]     │││ ─────────────────────────────────── │   │
│  │                  │││  1   | John | ⚪⚪⚪⚪              │   │
│  │ ┌──────────────┐ │││  1   | Mary | ⚪⚪⚪⚪              │   │
│  │ │ Team 1       │ │││                                     │   │
│  │ │ John         │ │││                                     │   │
│  │ │ [Meedoen]    │ │││                                     │   │
│  │ │ Helpt actief │ │││                                     │   │
│  │ │ 14:32        │ │││                                     │   │
│  │ └──────────────┘ │││                                     │   │
│  │                  │││                                     │   │
│  │ ┌──────────────┐ │││                                     │   │
│  │ │ Team 1       │ │││                                     │   │
│  │ │ Mary         │ │││                                     │   │
│  │ │ [Organiseren]│ │││                                     │   │
│  │ │ Goed gepland │ │││                                     │   │
│  │ │ 14:35        │ │││                                     │   │
│  │ └──────────────┘ │││                                     │   │
│  │ [X] Close        │││                                     │   │
│  └──────────────────┘│└────────────────────────────────────┘   │
│                      ↔ Resize Handle                            │
└──────────────────────────────────────────────────────────────────┘
```

## UI Components

### 1. Focus Mode Toggle Button
**Location**: Filter bar, next to "Neem peer score over" button
**States**:
- **Inactive**: White background, slate border, text "📝 Toon aantekeningen"
- **Active**: Emerald background, emerald border, text "📝 Verberg aantekeningen"
**Behavior**: 
- Only visible when evaluation has a linked project
- Toggles focus mode on/off

### 2. Project Notes Panel
**Location**: Left side of screen when focus mode is active
**Width**: Default 400px, resizable from 300px to 600px
**Layout**:

#### Header
- Title: "Projectaantekeningen"
- Close button (X) on the right

#### Filters Section
- **Student Search**: Text input
  - Placeholder: "Zoek leerling..."
  - Full width
  - Filters notes by student or team name
  
- **Category Filter**: Dropdown
  - Options: "Alle categorieën", "Organiseren", "Meedoen", "Zelfvertrouwen", "Autonomie"
  - Full width
  - Filters notes by OMZA category

#### Notes List (Scrollable)
Each note card displays:
- **Header Row**:
  - Team name (if applicable) - Gray text
  - Student name (if applicable) - Dark text
  - Category badge (if applicable) - Indigo pill on right
  
- **Note Text**: 
  - Full text, multi-line
  - Pre-wrapped formatting
  
- **Footer**:
  - Timestamp: "DD/MM/YYYY HH:MM" format
  - Gray, small text

#### Empty States
1. **No project linked**: "Deze evaluatie is niet gekoppeld aan een project."
2. **No notes context**: "Geen aantekeningen gevonden voor dit project."
3. **No matching notes**: Shows different message if notes exist but filters don't match

#### Resize Handle
- **Position**: Right edge of panel
- **Appearance**: 
  - Default: Light gray (slate-200)
  - Hover: Indigo (indigo-400)
  - Width: 1px, but has larger hit area
- **Cursor**: col-resize
- **Accessibility**: 
  - Role: separator
  - ARIA orientation: vertical
  - ARIA label: "Versleep om paneel grootte aan te passen"
  - Tab focusable

### 3. Layout Changes

#### When Focus Mode Inactive
- Normal max-width container (max-w-6xl)
- Centered content
- Sidebar visible

#### When Focus Mode Active
- Sidebar automatically collapses
- Full width content
- Flex container with notes panel on left
- Table takes remaining space (flex-1)
- Fixed height for panel: calc(100vh - 300px)

## Color Scheme

### Buttons
- **Inactive focus button**: bg-white, border-slate-200, text-slate-700
- **Active focus button**: bg-emerald-50, border-emerald-300, text-emerald-700

### Notes Panel
- **Background**: bg-slate-50
- **Border**: border-slate-200
- **Header background**: bg-white
- **Input fields**: bg-white, border-slate-200
- **Focus states**: ring-indigo-500, border-indigo-500

### Note Cards
- **Background**: bg-white
- **Border**: border-slate-200
- **Shadow**: shadow-sm
- **Team name**: text-slate-500
- **Student name**: text-slate-700
- **Note text**: text-slate-700
- **Timestamp**: text-slate-400
- **Category badge**: bg-indigo-100, text-indigo-700

### Resize Handle
- **Default**: bg-slate-200
- **Hover**: bg-indigo-400

## Responsive Behavior

- On mobile/tablet, focus mode may not be ideal due to limited horizontal space
- The notes panel has a minimum width of 300px
- The table has min-w-0 to allow it to shrink
- Filters wrap on smaller screens (flex-wrap)

## Animation/Transitions

- Button hover states: Smooth color transitions
- Resize handle: Color transition on hover
- Panel appears/disappears: No animation (instant)
- Sidebar collapse: Inherits animation from layout context

## User Flow

1. **Enable Focus Mode**:
   - Teacher clicks "📝 Toon aantekeningen"
   - Sidebar collapses
   - Notes panel slides in from left
   - Button changes to "Verberg aantekeningen"

2. **Filter Notes**:
   - Type in search box → Instant filter
   - Select category → Instant filter
   - Both filters work together (AND logic)

3. **Resize Panel**:
   - Mouse over resize handle → Cursor changes
   - Click and drag → Panel width changes
   - Release → Panel stays at new width

4. **View Notes While Scoring**:
   - Notes visible on left
   - OMZA table visible on right
   - Teacher can reference notes while selecting OMZA icons
   - Can expand rows for detailed comments

5. **Disable Focus Mode**:
   - Click "Verberg aantekeningen" OR
   - Click X in notes panel
   - Notes panel disappears
   - Sidebar expands
   - Button changes to "Toon aantekeningen"

## Accessibility Features

- Keyboard navigation supported
- ARIA labels on interactive elements
- Proper heading hierarchy
- Focus indicators on all interactive elements
- Resize handle is keyboard focusable
- Screen reader friendly descriptions
