# Styling Guide - Admin/Teacher Pages

This guide documents the unified design system for all admin and teacher pages in the Team Evaluatie App.

## Table of Contents
1. [Sidebar Navigation](#sidebar-navigation)
2. [Page Layout](#page-layout)
3. [Page Headers](#page-headers)
4. [Filters](#filters)
5. [Cards & Sections](#cards--sections)
6. [Buttons](#buttons)
7. [Typography](#typography)
8. [Spacing](#spacing)
9. [Colors](#colors)

---

## Sidebar Navigation

### Structure
The sidebar uses a dark slate design with organized navigation categories.

### Styling
```tsx
<aside className="w-64 bg-slate-700 border-r border-slate-600 text-slate-100">
```

### Navigation Categories
Three main categories with specific ordering:

#### 1. ALGEMEEN
- Dashboard
- Overzicht
- Analytics

#### 2. EVALUATIES & INZICHT
- Projectbeoordeling
- Evaluaties
- Competentiemonitor

#### 3. BEHEER
- Vakken beheren (Admin only)
- Docenten beheren (Admin only)
- Leerdoelen
- Rubrics

### Category Headers
```tsx
<div className="text-[10px] uppercase font-semibold tracking-[0.16em] text-slate-500 mb-1 mt-1 px-3">
  ALGEMEEN
</div>
```

### Navigation Items (NavItem Component)
```tsx
// Base classes
className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left w-full"

// Active state
className="bg-slate-600 text-slate-50 shadow-sm"

// Inactive state
className="text-slate-200 hover:bg-slate-600/80 hover:text-white"

// Active indicator dot
<div className="w-1.5 h-1.5 rounded-full bg-blue-400" />

// Inactive indicator dot
<div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
```

---

## Page Layout

### Main Layout Structure
```tsx
<div className="min-h-screen bg-gray-100 flex">
  <aside>...</aside>
  <main className="flex-1">{children}</main>
</div>
```

### Content Container
```tsx
<div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
  {/* Page content */}
</div>
```

---

## Page Headers

### Header Container
```tsx
<div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
  <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
    {/* Header content */}
  </header>
</div>
```

### Title
```tsx
<h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
  Page Title
</h1>
```

### Subtitle
```tsx
<p className="text-gray-600 mt-1 text-sm">
  Page description or subtitle
</p>
```

### Header Actions
Primary button (top-right):
```tsx
<button className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
  + Nieuwe Item
</button>
```

Secondary button:
```tsx
<button className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
  Secondary Action
</button>
```

---

## Filters

### Filter Container
```tsx
<div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
  {/* Filter elements */}
</div>
```

### Standard Filter Order
1. **Search field** (titel, vak)
2. **Course/Vak dropdown**
3. **Status dropdown**
4. **Reset button** (conditional)

### Filter Elements

#### Search Input
```tsx
<input
  type="text"
  placeholder="Zoek op titel, vak..."
  className="px-3 py-2 rounded-lg border w-64"
/>
```

#### Dropdown
```tsx
<select className="px-3 py-2 rounded-lg border">
  <option value="">Alle vakken</option>
  {/* options */}
</select>
```

#### Reset Button
```tsx
<button className="px-3 py-2 rounded-lg border hover:bg-gray-50">
  Reset
</button>
```

---

## Cards & Sections

### Standard Card
```tsx
<div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 hover:shadow-md transition-shadow">
  {/* Card content */}
</div>
```

### Section with Grouped Items

#### Section Header
```tsx
<h3 className="text-lg font-semibold text-gray-800 px-2">
  Section Title
</h3>
```

#### Card Grid/List
```tsx
<div className="space-y-3">
  {items.map(item => (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
      {/* Item content */}
    </div>
  ))}
</div>
```

### KPI/Stats Cards
```tsx
<div className="grid grid-cols-3 gap-6">
  <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
    <p className="text-sm font-medium text-gray-600">Label</p>
    <p className="mt-1 text-2xl font-bold text-gray-900">Value</p>
  </div>
</div>
```

---

## Buttons

### Primary Button
```tsx
<button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
  Primary Action
</button>
```

### Secondary Button (Outline)
```tsx
<button className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
  Secondary Action
</button>
```

### Small Action Button
```tsx
<button className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50">
  Action
</button>
```

### Danger Button
```tsx
<button className="px-3 py-1.5 text-sm rounded-lg border hover:bg-red-50 hover:text-red-600 hover:border-red-300">
  Delete
</button>
```

---

## Typography

### Headings
```tsx
// Page Title
<h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">

// Section Title
<h2 className="text-xl font-semibold text-gray-900">

// Subsection Title
<h3 className="text-lg font-semibold text-gray-800">

// Card Title
<h4 className="font-semibold text-gray-900">
```

### Body Text
```tsx
// Regular
<p className="text-sm text-gray-600">

// Small
<p className="text-xs text-gray-500">

// Medium weight
<span className="text-sm font-medium text-gray-700">
```

---

## Spacing

### Between Sections
```tsx
// Main content sections
<div className="space-y-6">

// Within a section
<div className="space-y-4">

// Card grid
<div className="space-y-3">

// Horizontal spacing
<div className="gap-6">  // For larger items
<div className="gap-4">  // For medium items
<div className="gap-3">  // For smaller items
```

### Page Content Spacing
```tsx
// Main container
className="max-w-6xl mx-auto px-4 sm:px-6 py-6"

// Left column spacing
className="flex-1 space-y-6"
```

---

## Colors

### Background Colors
- **Page background**: `bg-gray-100`
- **Card background**: `bg-white`
- **Sidebar**: `bg-slate-700`
- **Header**: `bg-white/80` (with backdrop blur)

### Border Colors
- **Standard border**: `border-gray-200/80`
- **Sidebar border**: `border-slate-600`
- **Header border**: `border-gray-200/70`

### Text Colors
- **Primary text**: `text-gray-900`
- **Secondary text**: `text-gray-600`
- **Muted text**: `text-gray-500`
- **Sidebar text**: `text-slate-100` / `text-slate-200`
- **Active sidebar**: `text-slate-50`

### Status Colors
- **Success/Active**: `text-green-600`, `bg-green-100`
- **Warning**: `text-yellow-600`, `bg-yellow-100`
- **Error/Danger**: `text-red-600`, `bg-red-100`
- **Info**: `text-blue-600`, `bg-blue-100`

### Button Colors
- **Primary**: `bg-blue-600`, `hover:bg-blue-700`
- **Secondary**: `border-gray-200`, `hover:bg-gray-50`
- **Danger**: `hover:bg-red-50`, `hover:text-red-600`

---

## Implementation Example

### Complete Page Structure
```tsx
export default function ExamplePage() {
  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              Page Title
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              Page description
            </p>
          </div>
          <button className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            + New Item
          </button>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
          <input
            type="text"
            placeholder="Zoek op titel, vak..."
            className="px-3 py-2 rounded-lg border w-64"
          />
          <select className="px-3 py-2 rounded-lg border">
            <option value="">Alle vakken</option>
          </select>
          <select className="px-3 py-2 rounded-lg border">
            <option value="">Alle statussen</option>
          </select>
        </div>

        {/* Content Sections */}
        {sections.map(section => (
          <section key={section.id} className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-800 px-2">
              {section.title}
            </h3>
            <div className="space-y-3">
              {section.items.map(item => (
                <div 
                  key={item.id}
                  className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 hover:shadow-md transition-shadow"
                >
                  {/* Item content */}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
```

---

## Best Practices

1. **Consistency**: Use the exact class names from this guide for consistent styling
2. **Spacing**: Always use `space-y-6` for main sections, `space-y-3` for card lists
3. **Cards**: All cards should use `rounded-xl border border-gray-200/80 shadow-sm`
4. **Hover States**: Add `hover:shadow-md transition-shadow` to interactive cards
5. **Buttons**: Always center text with `inline-flex items-center justify-center`
6. **Headers**: Always use `md:items-center gap-4` for proper alignment
7. **Groups**: Use section headers (`h3`) with `px-2` for grouped content
8. **Filters**: Always maintain order: Search → Course → Status
9. **Responsive**: Use `md:` breakpoint for desktop layouts
10. **Max Width**: Content should use `max-w-6xl mx-auto` for consistent width

---

## Component Library

### Shared NavItem Component
Location: `/frontend/src/components/admin/NavItem.tsx`

Usage:
```tsx
import { NavItem } from "@/components/admin/NavItem";

<NavItem href="/teacher/dashboard" label="Dashboard" />
```

---

## Migration Checklist

When updating a page to use this design system:

- [ ] Update page header with new structure
- [ ] Add proper button alignment (`md:items-center gap-4`)
- [ ] Update all cards to use `rounded-xl border border-gray-200/80 shadow-sm`
- [ ] Standardize filters (Search → Course → Status)
- [ ] Update spacing between sections (`space-y-6`)
- [ ] Change grouped items to individual cards with section headers
- [ ] Update button styles (primary and secondary)
- [ ] Ensure max-width is `max-w-6xl`
- [ ] Test responsive layout on mobile

---

**Last Updated**: November 2024
**Version**: 1.0
