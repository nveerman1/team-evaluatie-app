# Timezone Fix for Project Notes

## Issue
When creating notes on the `/teacher/project-notes/[id]` page, the timestamp displayed in the note was 1 hour behind the actual creation time.

## Root Cause
The database models were using `datetime.utcnow()` to set default values for `created_at` and `updated_at` fields. This function creates **timezone-naive** datetime objects, which means they don't include timezone information (no `+00:00` or `Z` suffix).

When these naive datetimes are serialized to JSON and sent to the frontend:
- Old format: `"2026-01-04T22:00:00"` (no timezone info)
- JavaScript's `new Date()` interprets this as **local time** instead of UTC
- This causes a 1-hour offset in timezones like CET (UTC+1)

## Solution

### Part 1: Fix for New Records
Changed the database models to use `datetime.now(timezone.utc)` instead, which creates **timezone-aware** datetime objects:
- New format: `"2026-01-04T22:00:00+00:00"` (includes timezone info)
- JavaScript correctly interprets this as UTC time
- The browser automatically converts it to the user's local time for display

### Part 2: Fix for Existing Records
Added serialization helpers to ensure **existing** records with timezone-naive datetimes are converted to timezone-aware datetimes when returned by the API:
- `_ensure_timezone_aware()`: Converts individual datetime objects
- `_ensure_context_timezone_aware()`: Ensures all datetime fields in context dictionaries are timezone-aware

This means **all** notes (both old and new) will now display with correct timestamps.

## Changes Made

### File: `backend/app/infra/db/models.py`

1. **Import timezone:**
   ```python
   from datetime import datetime, timezone
   ```

2. **Updated ProjectNotesContext model:**
   ```python
   created_at: Mapped[datetime] = mapped_column(
       default=lambda: datetime.now(timezone.utc),
       nullable=False,
   )
   updated_at: Mapped[datetime] = mapped_column(
       default=lambda: datetime.now(timezone.utc),
       onupdate=lambda: datetime.now(timezone.utc),
       nullable=False,
   )
   ```

3. **Updated ProjectNote model:**
   ```python
   created_at: Mapped[datetime] = mapped_column(
       default=lambda: datetime.now(timezone.utc),
       nullable=False,
   )
   updated_at: Mapped[datetime] = mapped_column(
       default=lambda: datetime.now(timezone.utc),
       onupdate=lambda: datetime.now(timezone.utc),
       nullable=False,
   )
   ```

### File: `backend/app/api/v1/routers/project_notes.py`

1. **Added import:**
   ```python
   from datetime import datetime, timezone
   ```

2. **Added helper functions:**
   ```python
   def _ensure_timezone_aware(dt: datetime) -> datetime:
       """Ensure a datetime is timezone-aware, converting to UTC if naive."""
       if dt.tzinfo is None:
           return dt.replace(tzinfo=timezone.utc)
       return dt

   def _ensure_context_timezone_aware(context_dict: dict) -> dict:
       """Ensure context timestamps are timezone-aware."""
       # Converts created_at, updated_at, and closed_at if they exist
       ...
   ```

3. **Updated `serialize_note()` function:**
   ```python
   "created_at": _ensure_timezone_aware(note.created_at),
   "updated_at": _ensure_timezone_aware(note.updated_at),
   ```

4. **Updated all context serialization points:**
   - `list_contexts()` - List all contexts
   - `create_context()` - Create new context
   - `get_context()` - Get context details
   - `update_context()` - Update context
   - `close_project_notes_context()` - Close context

## Technical Details

### Why Lambda Functions?
SQLAlchemy's `default` parameter can accept:
- A static value (evaluated once at model definition time)
- A callable (evaluated each time a record is created)

We use lambda functions to ensure a fresh timestamp is generated for each record:
```python
default=lambda: datetime.now(timezone.utc)
```

### Serialization
When Pydantic serializes these timezone-aware datetimes to JSON, they will include the timezone offset:
```json
{
  "created_at": "2026-01-04T22:00:00+00:00",
  "updated_at": "2026-01-04T22:00:00+00:00"
}
```

### Frontend Display
The existing frontend code already uses `toLocaleDateString()` with proper options:
```javascript
new Date(note.created_at).toLocaleDateString('nl-NL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})
```

This will now work correctly because JavaScript can properly parse the timezone-aware ISO string.

## Impact

### Affected Models
- `ProjectNotesContext`
- `ProjectNote`

### Frontend Components
No changes needed! The frontend components already handle dates correctly:
- `TimelineCard.tsx`
- `ProjectNotesCard.tsx`
- `TeamNotesCard.tsx`
- `StudentNotesCard.tsx`

### Database Migration
No migration needed. The changes work for both:
- **New records**: Created with timezone-aware datetimes from the model defaults
- **Existing records**: Converted to timezone-aware during API serialization

## Testing
The fix was verified to:
1. Produce timezone-aware datetimes for new records
2. Convert existing timezone-naive datetimes to timezone-aware during serialization
3. Serialize correctly to JSON with the `+00:00` suffix
4. Allow JavaScript to interpret timestamps as UTC and display in local time

## Best Practices
Going forward, always use `datetime.now(timezone.utc)` instead of `datetime.utcnow()` to create timezone-aware datetimes. Python 3.9+ even deprecates `datetime.utcnow()` in favor of timezone-aware alternatives.
