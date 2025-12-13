# Student Dashboard Design System

Complete styling guide for consistent UI/UX across all student pages in the Team Evaluatie App.

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Layout System](#layout-system)
4. [Components](#components)
5. [Color Palette](#color-palette)
6. [Typography](#typography)
7. [Usage Examples](#usage-examples)
8. [Migration Guide](#migration-guide)

---

## Overview

The Student Dashboard Design System provides a centralized set of styling utilities and patterns to ensure consistency across all student-facing pages. It is based on the redesigned student dashboard mockup and uses:

- **shadcn/ui** components built on Radix UI
- **Tailwind CSS** utility classes
- **Slate color palette** for neutral tones
- **Indigo accent** for interactive elements

### Design Principles

1. **Consistency**: Same spacing, typography, and colors across all pages
2. **Hierarchy**: Clear visual distinction between info cards and content cards
3. **Accessibility**: Proper contrast ratios and hover states
4. **Responsiveness**: Mobile-first design with tablet/desktop breakpoints

---

## Getting Started

### Installation

The design system is available as a TypeScript module at:

```
frontend/src/styles/student-dashboard.styles.ts
```

### Import in Your Component

```typescript
import { studentStyles } from '@/styles/student-dashboard.styles';

// Or import specific sections
import { studentLayout, studentCards, studentButtons } from '@/styles/student-dashboard.styles';
```

### Basic Page Structure

```tsx
import { studentStyles } from '@/styles/student-dashboard.styles';

export default function StudentPage() {
  return (
    <div className={studentStyles.layout.pageContainer}>
      {/* Header */}
      <div className={studentStyles.header.container}>
        <div className={studentStyles.header.wrapper}>
          {/* Header content */}
        </div>
      </div>

      {/* Content */}
      <div className={studentStyles.layout.contentWrapper}>
        {/* Page content */}
      </div>
    </div>
  );
}
```

---

## Layout System

### Page Container

Full-height container with slate-100 background:

```tsx
<div className={studentStyles.layout.pageContainer}>
  {/* Content */}
</div>
```

**Output**: `min-h-screen bg-slate-100`

### Content Wrapper

Centered container with max-width and responsive padding:

```tsx
<div className={studentStyles.layout.contentWrapper}>
  {/* Content */}
</div>
```

**Output**: `mx-auto w-full max-w-6xl px-4 py-6 sm:px-6`

### Tab Content

Standard spacing for tabbed content:

```tsx
<TabsContent value="tab1" className={studentStyles.layout.tabContent}>
  {/* Tab content */}
</TabsContent>
```

**Output**: `mt-6 space-y-4`

---

## Components

### Header

Dark header with title, subtitle, and user information:

```tsx
import { studentStyles } from '@/styles/student-dashboard.styles';

function StudentHeader({ userName, userClass }: Props) {
  return (
    <div className={studentStyles.header.container}>
      <div className={studentStyles.header.wrapper}>
        <div className={studentStyles.header.flexContainer}>
          {/* Left: Title */}
          <div className={studentStyles.header.titleSection}>
            <h1 className={studentStyles.header.title}>Mijn Dashboard</h1>
            <p className={studentStyles.header.subtitle}>
              Overzicht van je evaluaties, ontwikkeling en projectresultaten.
            </p>
          </div>

          {/* Right: User info */}
          <div className={studentStyles.header.userSection}>
            <div className={studentStyles.header.userInfo}>
              <div className={studentStyles.header.userName}>{userName}</div>
              <div className={studentStyles.header.userClass}>{userClass}</div>
            </div>
            <div className={studentStyles.header.userAvatar}>
              {userName.charAt(0)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Key Features**:
- Full-width dark background (`bg-slate-800`)
- Max-width content wrapper
- Responsive flex layout (stack on mobile, side-by-side on desktop)
- User avatar with initials

---

### Cards

Two types of cards: **Info Cards** and **List Cards**.

#### Info Cards

Used for introductory/explanatory content at the top of tabs. Distinguished by slate-50 background and no shadow:

```tsx
import { Card, CardContent } from '@/components/ui/card';
import { studentStyles } from '@/styles/student-dashboard.styles';
import { Sparkles } from 'lucide-react';

function InfoCard() {
  return (
    <Card className={studentStyles.cards.infoCard.container}>
      <CardContent className={studentStyles.cards.infoCard.content}>
        <div className={studentStyles.cards.infoCard.flexContainer}>
          <div className={studentStyles.cards.infoCard.leftSection}>
            <div className={studentStyles.cards.infoCard.titleRow}>
              <Sparkles className={studentStyles.cards.infoCard.icon} />
              <p className={studentStyles.cards.infoCard.title}>
                Wat moet ik nu doen?
              </p>
            </div>
            <p className={studentStyles.cards.infoCard.subtitle}>
              Open evaluaties staan bovenaan. Afgeronde evaluaties kun je teruglezen.
            </p>
          </div>
          <div className={studentStyles.cards.infoCard.rightSection}>
            {/* Badges or actions */}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Key Features**:
- Background: `bg-slate-50` (no shadow)
- Icon size: `h-4 w-4`
- Title: `text-sm font-semibold`
- Two-column responsive layout

#### List Cards

Used for individual items (evaluations, scans, assessments). Distinguished by white background with hover effect:

```tsx
import { Card, CardContent } from '@/components/ui/card';
import { studentStyles } from '@/styles/student-dashboard.styles';

function ListCard({ item }: Props) {
  return (
    <Card className={studentStyles.cards.listCard.container}>
      <CardContent className={studentStyles.cards.listCard.content}>
        <div className={studentStyles.cards.listCard.flexContainer}>
          <div className={studentStyles.cards.listCard.leftSection}>
            {/* Item content */}
          </div>
          <div className={studentStyles.cards.listCard.rightSection}>
            {/* Action buttons */}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Key Features**:
- Background: `bg-white` with `shadow-sm`
- Hover effect: `hover:shadow-md transition-shadow`
- Two-column responsive layout with alignment

---

### Badges

Various badge styles for status indicators:

```tsx
import { Badge } from '@/components/ui/badge';
import { studentStyles } from '@/styles/student-dashboard.styles';

// Status badges (Open/Gesloten)
<Badge className={studentStyles.badges.statusOpen}>Open</Badge>
<Badge className={studentStyles.badges.statusClosed}>Gesloten</Badge>

// Info pills
<Badge variant="secondary" className={studentStyles.badges.infoPill}>
  Open: 3
</Badge>

// Grade badges
<span className={studentStyles.badges.gradeBadge}>8.0</span>

// Learning goal status
<Badge className={studentStyles.badges.activeGoal}>Actief</Badge>
<Badge className={studentStyles.badges.completedGoal}>Afgerond</Badge>
```

**Utility Function**:

```tsx
const badgeClass = studentStyles.utils.getStatusBadge(isOpen);
const statusText = studentStyles.utils.getStatusText(isOpen);
```

---

### Buttons

Consistent button styling with three variants:

```tsx
import { Button } from '@/components/ui/button';
import { studentStyles } from '@/styles/student-dashboard.styles';

// Primary button (dark)
<Button className={studentStyles.buttons.primary} size="sm">
  Verder
</Button>

// Secondary button (light)
<Button variant="secondary" className={studentStyles.buttons.secondary} size="sm">
  Leerdoel
</Button>

// Ghost button (transparent)
<Button variant="ghost" className={studentStyles.buttons.ghost} size="sm">
  Feedback
</Button>
```

**Key Features**:
- All buttons: `rounded-xl` corners
- Primary: `bg-slate-900 hover:bg-slate-800`
- Consistent sizing with `size="sm"`

---

### Progress Bars

Two sizes: standard and compact:

```tsx
import { Progress } from '@/components/ui/progress';
import { studentStyles } from '@/styles/student-dashboard.styles';

// Standard progress bar
<div className={studentStyles.progress.container}>
  <Progress 
    className={studentStyles.progress.bar}
    value={75}
  />
</div>

// Compact progress bar
<div className={studentStyles.progress.compactContainer}>
  <Progress 
    className={studentStyles.progress.compactBar}
    value={50}
  />
</div>
```

**Key Features**:
- Standard: `h-3`, max-width `max-w-md`
- Compact: `h-2`, max-width `max-w-sm`
- Color: indigo-500 fill

---

### Action Chips

Status indicators with icons (checkmark for done, clock for pending):

```tsx
import { CheckCircle2, Clock } from 'lucide-react';
import { studentStyles } from '@/styles/student-dashboard.styles';

function ActionChip({ done, label }: { done: boolean; label: string }) {
  return (
    <div className={studentStyles.actionChips.chip}>
      {done ? (
        <CheckCircle2 className={studentStyles.actionChips.iconDone} />
      ) : (
        <Clock className={studentStyles.actionChips.iconPending} />
      )}
      <span className={done ? studentStyles.actionChips.textDone : studentStyles.actionChips.textPending}>
        {label}
      </span>
    </div>
  );
}

// Container for 3 action chips
<div className={studentStyles.actionChips.container}>
  <ActionChip done={true} label="Zelfbeoordeling" />
  <ActionChip done={false} label="Peer-evaluaties (0/2)" />
  <ActionChip done={false} label="Reflectie" />
</div>
```

**Key Features**:
- Flex layout with minimal spacing (`gap-2` on desktop)
- Green checkmark for completed items
- Gray clock for pending items

---

### Navigation (Tabs)

Tab navigation with search functionality:

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { studentStyles } from '@/styles/student-dashboard.styles';

function StudentNavigation() {
  return (
    <div className={studentStyles.navigation.container}>
      <TabsList className={studentStyles.navigation.tabsList}>
        <TabsTrigger value="evaluaties" className={studentStyles.navigation.tabTrigger}>
          Evaluaties
        </TabsTrigger>
        <TabsTrigger value="scans" className={studentStyles.navigation.tabTrigger}>
          Competentiescan
        </TabsTrigger>
      </TabsList>

      <div className={studentStyles.navigation.searchContainer}>
        <Search className={studentStyles.navigation.searchIcon} />
        <Input
          placeholder="Zoek…"
          className={studentStyles.navigation.searchInput}
        />
      </div>
    </div>
  );
}
```

**Key Features**:
- Active tab: dark pill (`bg-slate-800`)
- Inactive tab: transparent with hover effect
- Search bar: always visible, right-aligned on desktop

---

### Tables

Data tables with consistent styling:

```tsx
import { studentStyles } from '@/styles/student-dashboard.styles';

function ProjectResultsTable({ data }: Props) {
  return (
    <div className={studentStyles.tables.container}>
      <table className={studentStyles.tables.table}>
        <thead className={studentStyles.tables.thead}>
          <tr className={studentStyles.tables.theadRow}>
            <th className={studentStyles.tables.th}>Project</th>
            <th className={studentStyles.tables.th}>Periode</th>
            <th className={studentStyles.tables.thRight}>Acties</th>
          </tr>
        </thead>
        <tbody className={studentStyles.tables.tbody}>
          {data.map((row) => (
            <tr key={row.id} className={studentStyles.tables.tr}>
              <td className={studentStyles.tables.td}>{row.project}</td>
              <td className={studentStyles.tables.td}>{row.periode}</td>
              <td className={studentStyles.tables.tdRight}>
                <Button size="sm">Bekijk</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Key Features**:
- Rounded borders with overflow handling
- Light gray header background (`bg-slate-50`)
- Border between rows
- Right-aligned columns for actions

---

## Color Palette

### Primary Colors

- **Background**: `bg-slate-100` (light gray page background)
- **Cards**: `bg-white` (list items) or `bg-slate-50` (info cards)
- **Header**: `bg-slate-800` (dark header)
- **Primary Action**: `bg-slate-900` (dark buttons)
- **Accent**: `bg-indigo-500` (progress bars, active states)

### Status Colors

- **Success/Done**: `emerald-600` (icons), `emerald-700` (text), `emerald-50` (backgrounds)
- **Warning/Active**: `amber-800` (text), `amber-50` (backgrounds)
- **Pending**: `slate-400` (icons), `slate-600` (text)
- **Error/Urgent**: `rose-700` (text), `rose-50` (backgrounds)

### Text Colors

- **Primary**: `text-slate-900` (headings, important text)
- **Secondary**: `text-slate-700` (body text)
- **Tertiary**: `text-slate-600` (metadata, labels)
- **Muted**: `text-slate-500` (placeholders, disabled)

---

## Typography

### Hierarchy

```tsx
import { studentStyles } from '@/styles/student-dashboard.styles';

// Page title (H1)
<h1 className={studentStyles.typography.pageTitle}>Title</h1>
// Output: text-3xl font-bold tracking-tight text-slate-900

// Page subtitle
<p className={studentStyles.typography.pageSubtitle}>Subtitle</p>
// Output: mt-1 text-sm text-slate-600

// Section title (H2)
<h2 className={studentStyles.typography.sectionTitle}>Section</h2>
// Output: text-lg font-semibold text-slate-900

// Card title (H3)
<h3 className={studentStyles.typography.cardTitle}>Card Title</h3>
// Output: text-base font-semibold text-slate-900

// Body text
<p className={studentStyles.typography.infoText}>Body text</p>
// Output: text-sm text-slate-600

// Metadata
<span className={studentStyles.typography.metaTextSmall}>Metadata</span>
// Output: text-xs text-slate-600
```

### Font Sizes

- **3xl**: Page titles (header)
- **lg**: Section headings
- **base**: Card titles
- **sm**: Body text, subtitles
- **xs**: Metadata, labels

---

## Usage Examples

### Complete Evaluation Card

```tsx
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { studentStyles } from '@/styles/student-dashboard.styles';
import { ChevronRight, Clock, CheckCircle2 } from 'lucide-react';

function EvaluationCard({ evaluation }: Props) {
  const isOpen = evaluation.status === 'open';

  return (
    <Card className={studentStyles.cards.listCard.container}>
      <CardContent className={studentStyles.cards.listCard.content}>
        <div className={studentStyles.cards.listCard.flexContainer}>
          {/* Left section */}
          <div className={studentStyles.cards.listCard.leftSection}>
            {/* Title + Badge */}
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={studentStyles.typography.cardTitle}>
                {evaluation.title}
              </h3>
              <Badge className={studentStyles.utils.getStatusBadge(isOpen)}>
                {studentStyles.utils.getStatusText(isOpen)}
              </Badge>
            </div>

            {/* Deadline */}
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Clock className="h-4 w-4" />
              Deadline: {evaluation.deadline}
            </div>

            {/* Action chips */}
            <div className={studentStyles.actionChips.container}>
              <ActionChip done={evaluation.selfDone} label="Zelfbeoordeling" />
              <ActionChip done={evaluation.peersDone} label="Peer-evaluaties (2/2)" />
              <ActionChip done={evaluation.reflectionDone} label="Reflectie" />
            </div>

            {/* Progress bar */}
            <div className={studentStyles.progress.container}>
              <Progress 
                className={studentStyles.progress.bar}
                value={evaluation.progress}
              />
            </div>
          </div>

          {/* Right section - buttons */}
          <div className={studentStyles.cards.listCard.rightSection}>
            <Button className={studentStyles.buttons.primary} size="sm">
              Verder <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
            <Button variant="ghost" className={studentStyles.buttons.ghost} size="sm">
              Feedback
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Migration Guide

### Step 1: Import the Design System

```typescript
import { studentStyles } from '@/styles/student-dashboard.styles';
```

### Step 2: Replace Hardcoded Classes

**Before**:
```tsx
<div className="min-h-screen bg-slate-100">
  <div className="mx-auto w-full max-w-6xl px-4 py-6">
    {/* Content */}
  </div>
</div>
```

**After**:
```tsx
<div className={studentStyles.layout.pageContainer}>
  <div className={studentStyles.layout.contentWrapper}>
    {/* Content */}
  </div>
</div>
```

### Step 3: Update Card Components

**Before**:
```tsx
<Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
  <CardContent className="p-5">
    {/* Content */}
  </CardContent>
</Card>
```

**After**:
```tsx
<Card className={studentStyles.cards.listCard.container}>
  <CardContent className={studentStyles.cards.listCard.content}>
    {/* Content */}
  </CardContent>
</Card>
```

### Step 4: Standardize Buttons

**Before**:
```tsx
<Button className="rounded-xl" size="sm">Action</Button>
```

**After**:
```tsx
<Button className={studentStyles.buttons.primary} size="sm">Action</Button>
```

### Step 5: Test Responsiveness

Ensure your page works on:
- Mobile (< 640px)
- Tablet (640px - 1024px)
- Desktop (> 1024px)

---

## Best Practices

1. **Always use the design system** for new student pages
2. **Maintain visual hierarchy**: Info cards vs List cards
3. **Keep spacing consistent**: Use predefined gaps and margins
4. **Use utility functions**: `getStatusBadge()`, `getStatusText()`
5. **Test hover states**: All interactive elements should have hover effects
6. **Mobile-first**: Design for mobile, enhance for desktop

---

## Support

For questions or suggestions about the design system:

1. Check this documentation first
2. Review the student dashboard implementation (`/app/student/page.tsx`)
3. Look at component examples in `/components/student/dashboard/`
4. Contact the design team for mockup clarifications

---

## Changelog

### Version 1.0.0 (December 2025)

- Initial design system based on student dashboard redesign
- Centralized styling utilities
- Complete component library
- Documentation and examples

---

**Last Updated**: December 13, 2025
