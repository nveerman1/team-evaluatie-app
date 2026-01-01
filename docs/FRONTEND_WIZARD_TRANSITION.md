# Academic Year Transition - Frontend Integration Guide

## Overview
The bulk year transition feature allows admins to safely transition students and classes from one academic year to the next without losing historical data.

## API Endpoint

### POST `/api/v1/admin/academic-years/{source_year_id}/transition`

**Authentication:** Admin role required

**Path Parameters:**
- `source_year_id` (integer): ID of the academic year to transition from

**Request Body:**
```json
{
  "target_academic_year_id": 2,
  "class_mapping": {
    "G2a": "G3a",
    "G2b": "G3b",
    "A2a": "A3a"
  },
  "copy_course_enrollments": true
}
```

**Response:**
```json
{
  "classes_created": 8,
  "students_moved": 124,
  "courses_created": 12,
  "enrollments_copied": 287,
  "skipped_students": 3
}
```

## Frontend Wizard Flow

### Step 1: Select Source Academic Year
- Display list of academic years using `GET /api/v1/admin/academic-years`
- Allow admin to select the source year

### Step 2: Select Target Academic Year
- Display list of academic years (excluding source)
- Allow admin to select the target year
- Validate that target is different from source

### Step 3: Map Classes
- Fetch classes from source year: `GET /api/v1/admin/classes?academic_year_id={source_year_id}`
- For each class, show input field for new name (pre-fill with suggested name)
- Example suggestions:
  - G2a → G3a (increment year number)
  - G2b → G3b
  - etc.
- Allow admin to edit the target names
- Validate that no duplicate target names exist

### Step 4: Configure Options
- Checkbox: "Copy course enrollments to new academic year"
- Explanation text: "If enabled, courses will be copied to the new year and student enrollments will be maintained for students who transition."

### Step 5: Preview & Confirm
Display summary:
```
Source Year: 2024-2025
Target Year: 2025-2026

Class Transitions:
  G2a → G3a (23 students)
  G2b → G3b (25 students)
  A2a → A3a (22 students)
  
Total: 3 classes, 70 students

Course Enrollments: Will be copied
```

Add warning:
> ⚠️ This operation cannot be undone. Historical data will be preserved, but new classes and memberships will be created in the target year.

### Step 6: Execute & Show Results
- Call the transition endpoint
- Show loading state with progress message
- On success, display results:
  ```
  ✅ Transition Complete!
  
  Created: 3 classes
  Moved: 70 students
  Created: 12 courses
  Copied: 287 enrollments
  Skipped: 0 students
  ```
- Provide link to view the new academic year's classes

## Error Handling

### Validation Errors (400)
- Source year not found
- Target year not found
- Source and target are the same
- Source class doesn't exist
- Target class already exists

Display user-friendly error messages and allow correction.

### Server Errors (500)
- Database transaction failed
- Unexpected error

Display error message and option to retry or contact support.

## Best Practices

1. **Always validate** class mappings before submission
2. **Show preview** before executing the transition
3. **Use confirmation dialog** before final execution
4. **Provide clear feedback** during and after the operation
5. **Link to documentation** for users who need more help
6. **Test with small datasets** before production use

## Example Implementation Notes

```typescript
// Suggested type definitions
interface ClassMapping {
  [sourceClassName: string]: string; // target class name
}

interface TransitionRequest {
  target_academic_year_id: number;
  class_mapping: ClassMapping;
  copy_course_enrollments: boolean;
}

interface TransitionResult {
  classes_created: number;
  students_moved: number;
  courses_created: number;
  enrollments_copied: number;
  skipped_students: number;
}

// Example API call
async function executeTransition(
  sourceYearId: number,
  request: TransitionRequest
): Promise<TransitionResult> {
  const response = await fetch(
    `/api/v1/admin/academic-years/${sourceYearId}/transition`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }
  );
  
  if (!response.ok) {
    throw new Error(`Transition failed: ${await response.text()}`);
  }
  
  return await response.json();
}
```

## Security Notes

- Only users with `admin` role can execute transitions
- All operations are performed in a single database transaction
- If any error occurs, the entire transition is rolled back
- No data is deleted or modified in the source academic year
- Student privacy is maintained (no PII in logs)

## Support

For questions or issues, contact the development team.
