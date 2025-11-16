# Form Components

This directory contains reusable form components for the application.

## MultiSelect

A dropdown component that allows selecting multiple items from a list with search functionality.

### Features
- Multi-selection with checkboxes
- Search/filter functionality
- Selected items displayed as removable chips
- "Deselect all" option
- Click outside to close
- Event propagation handling for use within forms/labels

### Usage

```tsx
import { MultiSelect } from "@/components/form/MultiSelect";

const [selectedIds, setSelectedIds] = useState<number[]>([]);

<MultiSelect
  options={[
    { id: 1, label: "Option 1" },
    { id: 2, label: "Option 2" },
    { id: 3, label: "Option 3" },
  ]}
  value={selectedIds}
  onChange={setSelectedIds}
  placeholder="Select options..."
  disabled={false}
/>
```

### Props
- `options`: Array of `{ id: number, label: string }` objects
- `value`: Array of selected IDs
- `onChange`: Callback function when selection changes
- `placeholder`: Placeholder text (default: "Selecteer...")
- `className`: Additional CSS classes
- `disabled`: Disable the component (default: false)

## SearchableMultiSelect

An autocomplete/searchable dropdown that allows inline search and multiple selection.

### Features
- Inline search input
- Multi-selection with checkboxes
- Selected items displayed as removable chips
- Subtitle support for additional information
- Click outside to close
- Loading state

### Usage

```tsx
import { SearchableMultiSelect } from "@/components/form/SearchableMultiSelect";

const [selectedClientIds, setSelectedClientIds] = useState<number[]>([]);

<SearchableMultiSelect
  options={[
    { id: 1, label: "Client A", subtitle: "Contact: John Doe" },
    { id: 2, label: "Client B", subtitle: "Contact: Jane Smith" },
  ]}
  value={selectedClientIds}
  onChange={setSelectedClientIds}
  placeholder="Search and select clients..."
  loading={false}
/>
```

### Props
- `options`: Array of `{ id: number, label: string, subtitle?: string }` objects
- `value`: Array of selected IDs
- `onChange`: Callback function when selection changes
- `placeholder`: Placeholder text (default: "Zoek en selecteer...")
- `className`: Additional CSS classes
- `disabled`: Disable the component (default: false)
- `loading`: Show loading state (default: false)

## Implementation Examples

### Wizard - Step 2 (Competency Selection)
```tsx
<MultiSelect
  options={competencies.map(comp => ({
    id: comp.id,
    label: comp.name
  }))}
  value={competencyScanCompetencyIds}
  onChange={setCompetencyScanCompetencyIds}
  placeholder="Selecteer competenties..."
/>
```

### Wizard - Step 3 (Client Selection)
```tsx
<SearchableMultiSelect
  options={clients.map(client => ({
    id: client.id,
    label: client.organization,
    subtitle: client.contact_name
  }))}
  value={selectedClientIds}
  onChange={setSelectedClientIds}
  placeholder="Zoek en selecteer opdrachtgevers..."
  loading={loadingClients}
/>
```
