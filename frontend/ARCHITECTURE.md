# Frontend Architecture

This document describes the organized frontend architecture of the team evaluation application.

## Directory Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (teacher)/         # Teacher route group
│   ├── student/           # Student pages
│   └── ...
├── dtos/                   # Data Transfer Objects (Type Definitions)
│   ├── allocation.dto.ts  # Allocation types
│   ├── course.dto.ts      # Course types
│   ├── dashboard.dto.ts   # Dashboard types
│   ├── evaluation.dto.ts  # Evaluation types
│   ├── rubric.dto.ts      # Rubric types
│   └── index.ts           # Barrel export
├── services/              # API Service Layer
│   ├── allocation.service.ts
│   ├── course.service.ts
│   ├── dashboard.service.ts
│   ├── evaluation.service.ts
│   ├── rubric.service.ts
│   └── index.ts           # Barrel export
├── hooks/                 # Custom React Hooks
│   ├── useCourses.ts
│   ├── useDashboardData.ts
│   ├── useEvaluations.ts
│   ├── useUrlState.ts
│   └── index.ts           # Barrel export
├── components/            # Reusable UI Components
│   ├── ErrorMessage.tsx
│   ├── Loading.tsx
│   ├── StatusBadge.tsx
│   ├── Tile.tsx
│   ├── Toast.tsx
│   └── index.ts           # Barrel export
├── utils/                 # Helper/Utility Functions
│   ├── array.utils.ts     # Array manipulation helpers
│   ├── id.utils.ts        # ID validation utilities
│   └── index.ts           # Barrel export
└── lib/                   # Legacy folder (now re-exports from new structure)
    ├── api.ts             # Axios instance configuration
    ├── id.ts              # Re-exports from utils
    ├── types.ts           # Re-exports from dtos
    └── rubric-types.ts    # Re-exports from dtos
```

## Architecture Layers

### 1. DTOs (Data Transfer Objects)
- **Purpose**: Define TypeScript types and interfaces for API data
- **Location**: `src/dtos/`
- **Files**:
  - `allocation.dto.ts` - MyAllocation, Criterion, ScoreItem
  - `course.dto.ts` - CourseLite
  - `dashboard.dto.ts` - DashboardRow, DashboardResponse, FlagsResponse, GradePreviewResponse
  - `evaluation.dto.ts` - Evaluation, EvalStatus, EvaluationListResponse
  - `rubric.dto.ts` - RubricListItem, RubricOut, CriterionOut, etc.

### 2. Services
- **Purpose**: Handle all API communication and business logic
- **Location**: `src/services/`
- **Pattern**: Each service exports an object with methods for related API calls
- **Example**:
  ```typescript
  import { evaluationService } from '@/services';
  
  const evals = await evaluationService.getEvaluations({ status: 'open' });
  await evaluationService.updateStatus(id, 'closed');
  ```

### 3. Hooks
- **Purpose**: Encapsulate reusable stateful logic
- **Location**: `src/hooks/`
- **Types**:
  - Data fetching hooks (useEvaluations, useCourses, useDashboardData)
  - State management hooks (useUrlState)
- **Example**:
  ```typescript
  import { useEvaluations } from '@/hooks';
  
  const { evaluations, loading, error } = useEvaluations({ status: 'open' });
  ```

### 4. Components
- **Purpose**: Reusable UI components
- **Location**: `src/components/`
- **Components**:
  - `StatusBadge` - Display evaluation status with color coding
  - `Tile` - KPI display tile
  - `Loading` - Loading state indicator
  - `ErrorMessage` - Error display component
  - `Toast` - Notification toast
- **Example**:
  ```typescript
  import { StatusBadge, Loading } from '@/components';
  
  {loading ? <Loading /> : <StatusBadge status="open" />}
  ```

### 5. Utils
- **Purpose**: Pure utility functions with no side effects
- **Location**: `src/utils/`
- **Functions**:
  - `isValidNumericId(x)` - Validate numeric IDs
  - `useNumericEvalId()` - Extract evaluation ID from route params
  - `toArray(x)` - Convert various formats to arrays
  - `formatDate(dateString)` - Format dates consistently
- **Example**:
  ```typescript
  import { formatDate, toArray } from '@/utils';
  
  const date = formatDate(evaluation.deadline);
  const items = toArray(response.data);
  ```

## Page Structure

### Simple Pages
For simple pages, all logic can remain in `page.tsx`:
```typescript
// page.tsx
import { useEvaluations } from '@/hooks';
import { Loading, ErrorMessage } from '@/components';

export default function MyPage() {
  const { evaluations, loading, error } = useEvaluations();
  
  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  
  return <div>{/* render evaluations */}</div>;
}
```

### Complex Pages
For complex pages with lots of logic, use the `page.tsx` + `_inner.tsx` pattern:

```typescript
// page.tsx (minimal wrapper)
import MyPageInner from './_inner';

export default function MyPage() {
  return <MyPageInner />;
}
```

```typescript
// _inner.tsx (contains all logic)
"use client";
import { useState } from 'react';
import { useEvaluations } from '@/hooks';
// ... all complex logic here
```

## Import Patterns

### Barrel Exports
All organized folders use barrel exports (index.ts) for clean imports:

```typescript
// ✅ Good - using barrel exports
import { Evaluation, EvalStatus } from '@/dtos';
import { evaluationService } from '@/services';
import { useEvaluations, useCourses } from '@/hooks';
import { Loading, ErrorMessage } from '@/components';
import { formatDate, toArray } from '@/utils';

// ❌ Avoid - direct file imports
import { Evaluation } from '@/dtos/evaluation.dto';
```

### Path Aliases
Use TypeScript path aliases for clean imports:
- `@/dtos` → `src/dtos`
- `@/services` → `src/services`
- `@/hooks` → `src/hooks`
- `@/components` → `src/components`
- `@/utils` → `src/utils`
- `@/lib` → `src/lib`

## Migration Guide

### Updating Existing Pages

1. **Replace direct API calls with services**:
   ```typescript
   // Before
   const res = await api.get('/evaluations');
   const data = res.data;
   
   // After
   const data = await evaluationService.getEvaluations();
   ```

2. **Use DTOs instead of inline types**:
   ```typescript
   // Before
   type Evaluation = { id: number; title: string; ... };
   
   // After
   import { Evaluation } from '@/dtos';
   ```

3. **Extract repeated logic to hooks**:
   ```typescript
   // Before
   const [evals, setEvals] = useState([]);
   useEffect(() => {
     api.get('/evaluations').then(r => setEvals(r.data));
   }, []);
   
   // After
   const { evaluations } = useEvaluations();
   ```

4. **Use shared components**:
   ```typescript
   // Before
   {loading && <div className="text-gray-500">Loading...</div>}
   
   // After
   {loading && <Loading />}
   ```

## Best Practices

1. **Keep page.tsx minimal** - Move complex logic to _inner.tsx or custom hooks
2. **Use services for all API calls** - Never call api.* directly from pages
3. **Define types in DTOs** - Don't define types inline in pages
4. **Extract reusable logic to hooks** - DRY principle
5. **Create components for repeated UI** - Consistent UX
6. **Use utils for pure functions** - No side effects
7. **Leverage barrel exports** - Clean imports

## Benefits

- ✅ **Separation of Concerns** - Clear boundaries between layers
- ✅ **Reusability** - Services, hooks, and components can be shared
- ✅ **Maintainability** - Easy to find and update code
- ✅ **Testability** - Each layer can be tested independently
- ✅ **Type Safety** - Centralized type definitions
- ✅ **Consistency** - Standardized patterns across the codebase
- ✅ **Scalability** - Easy to add new features following the same patterns
