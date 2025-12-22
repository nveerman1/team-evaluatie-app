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
python scripts/seed_3de_blok.py
```

### What Gets Created

The script creates the following test data:

#### 1. Students (3)

| Name           | Email                    | Class | Password |
|----------------|--------------------------|-------|----------|
| Bram de Boer   | bram.demo@example.com    | V4A   | demo123  |
| Emma Smit      | emma.smit@example.com    | V4A   | demo123  |
| Finn Bakker    | finn.bakker@example.com  | V4A   | demo123  |

#### 2. RFID Cards

Each student gets an RFID card assigned:

- Bram de Boer: `RFID001`
- Emma Smit: `RFID002`
- Finn Bakker: `RFID003`

#### 3. Sample Attendance Events

The script also creates sample attendance events for testing:

1. **Bram de Boer** - School attendance (yesterday, 2 hours, checked out)
2. **Emma Smit** - School attendance (currently checked in)
3. **Finn Bakker** - External work (pending approval)
4. **Bram de Boer** - External work (approved)

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
