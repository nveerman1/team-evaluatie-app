# 3de Blok Module - Data Seeding

This document describes how to seed test data for the 3de Blok RFID attendance module.

## Seed Script

The `seed_3de_blok.py` script creates test data for development and testing purposes.

### Location

```
backend/scripts/seed_3de_blok.py
```

### Usage

```bash
cd backend
python scripts/seed_3de_blok.py [school_id]
```

**Arguments:**
- `school_id` (optional): The ID of the school to add students to. Defaults to 1 if not specified.

**Examples:**
```bash
# Add students to school_id=1 (default)
python scripts/seed_3de_blok.py

# Add students to school_id=2
python scripts/seed_3de_blok.py 2
```

**Important:** The script will:
- Add students to the specified school
- Show which school the students are being added to
- List available schools if the specified school_id doesn't exist

### What Gets Created

The script creates the following test data:

#### 1. Students (5)

| Name           | Email                      | Class | Password |
|----------------|----------------------------|-------|----------|
| Lars van Dijk  | lars.vandijk@example.com   | V4A   | demo123  |
| Sophie Jansen  | sophie.jansen@example.com  | V4A   | demo123  |
| Daan Visser    | daan.visser@example.com    | V4A   | demo123  |
| Lisa de Vries  | lisa.devries@example.com   | V4A   | demo123  |
| Tim Mulder     | tim.mulder@example.com     | V4A   | demo123  |

#### 2. RFID Cards

Each student gets an RFID card assigned:

- Lars van Dijk: `RFID001`
- Sophie Jansen: `RFID002`
- Daan Visser: `RFID003`
- Lisa de Vries: `RFID004`
- Tim Mulder: `RFID005`

#### 3. Sample Attendance Events

The script also creates sample attendance events for testing:

1. **Lars van Dijk** - School attendance (yesterday, 2 hours, checked out)
2. **Sophie Jansen** - School attendance (currently checked in)
3. **Daan Visser** - External work (pending approval)
4. **Lars van Dijk** - External work (approved)
5. **Lisa de Vries** - School attendance (yesterday, 3 hours, checked out)
6. **Tim Mulder** - School attendance (currently checked in)

## Testing the Module

After seeding, you can test the 3de Blok module:

### 1. RFID Scanning

Simulate an RFID scan using the API:

```bash
curl -X POST http://localhost:8000/api/v1/attendance/scan \
  -H "Content-Type: application/json" \
  -d '{"uid": "RFID001", "device_id": "test-scanner"}'
```

This will:
- Check in Bram if he's not currently checked in
- Check out Bram if he's already checked in

### 2. View Presence

Check who's currently present:

```bash
curl http://localhost:8000/api/v1/attendance/presence \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Frontend Dashboard

Access the teacher dashboard:

```
http://localhost:3000/teacher/3de-blok
```

This shows:
- Currently present students
- Real-time duration
- Search and filtering
- Auto-refresh every 30 seconds

## Database Verification

To verify the data was created correctly:

```bash
cd backend
python -c "
from app.infra.db.session import SessionLocal
from app.infra.db.models import User, RFIDCard, AttendanceEvent

db = SessionLocal()

print('Students:', db.query(User).filter(User.role == 'student').count())
print('RFID Cards:', db.query(RFIDCard).count())
print('Attendance Events:', db.query(AttendanceEvent).count())

db.close()
"
```

## Re-running the Script

The script is idempotent. If you run it multiple times:
- Existing students/cards/events are not duplicated
- It will report that data already exists
- Safe to run multiple times

## Clean Up

To remove the test data:

```bash
cd backend
python -c "
from app.infra.db.session import SessionLocal
from app.infra.db.models import School

db = SessionLocal()
school = db.query(School).filter(School.name == 'Demo School').first()
if school:
    db.delete(school)  # Cascade will delete all related data
    db.commit()
    print('Demo data deleted')
else:
    print('No demo data found')
db.close()
"
```

## Additional Seed Scripts

Other available seed scripts:

- `seed_demo_data.py` - Creates basic demo school and admin
- `seed_external_work.py` - Creates external work test data

## Troubleshooting

### Database Not Running

If you get connection errors, start the database:

```bash
make up
# or
docker compose -f ops/docker/compose.dev.yml up -d
```

### Migrations Not Applied

If tables don't exist:

```bash
cd backend
alembic upgrade head
```

### Duplicate Key Errors

If you get unique constraint errors, the data already exists. Either:
- Skip re-seeding
- Clean up first (see Clean Up section)
- Check what exists in the database

## See Also

- [3de Blok Implementation Summary](../../3DE_BLOK_IMPLEMENTATION_SUMMARY.md)
- [3de Blok Rebuild Plan](./REBUILD_PLAN.md)
- [Main README](../../README.md)
