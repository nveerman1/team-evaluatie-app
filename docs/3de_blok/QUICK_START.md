# Quick Start Guide: 3de Blok Rebuild

## Voor Developers

### 1. Lees de Documentatie (in volgorde)

1. **REBUILD_SUMMARY.md** (5 min) - Executive overview
2. **ARCHITECTURE_DIAGRAM.md** (10 min) - Visual architecture + dataflows
3. **REBUILD_PLAN.md** (30-60 min) - Complete technical specification

### 2. Verify Assumptions (Day 1)

Checklist van te verifiëren zaken:

```bash
# Clone Team Evaluatie App
git clone <team-app-repo>
cd team-app

# Inspect database schema
psql -h localhost -U postgres -d team_app -c "\dt"
psql -h localhost -U postgres -d team_app -c "\d users"
psql -h localhost -U postgres -d team_app -c "\d courses"
psql -h localhost -U postgres -d team_app -c "\d projects"

# Check authentication system
grep -r "JWT\|jwt\|auth\|Auth" backend/
grep -r "middleware" backend/

# Check component library
cat frontend/package.json | grep -E "react|antd|material|tailwind"

# List existing routes
grep -r "Route\|router" frontend/src/

# Check existing API structure
find backend/ -name "*routes*" -o -name "*controllers*"
```

**Document findings:**
- Users tabel kolommen: ____________
- Courses/classes structuur: ____________
- Auth systeem: JWT / Sessions / Other: ____________
- Component library: ____________
- Backend framework: Express / NestJS / Other: ____________

### 3. Setup Development Environment (Day 1)

```bash
# Install Postgres (als nog niet installed)
brew install postgresql@15  # macOS
# of
sudo apt install postgresql-15  # Linux

# Create development database
createdb team_app_dev
psql team_app_dev < team_app_schema_backup.sql

# Add 3de Blok schema (nieuwe tabellen)
psql team_app_dev < attendance_schema.sql
```

**attendance_schema.sql** (copy from REBUILD_PLAN.md section 3.1):
```sql
-- rfid_cards
CREATE TABLE rfid_cards (...);

-- attendance_events  
CREATE TABLE attendance_events (...);

-- attendance_aggregates
CREATE TABLE attendance_aggregates (...);

-- Views & functions
CREATE VIEW open_sessions AS ...;
CREATE FUNCTION compute_user_attendance_totals(...);
```

### 4. Prototype Scan Endpoint (Day 2-3)

**Standalone test (zonder Team App):**

```javascript
// backend/routes/attendance.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Your Postgres connection

router.post('/api/v1/attendance/scan', async (req, res) => {
    const { uid } = req.body;
    
    if (!uid) {
        return res.status(400).json({
            status: 'error',
            error: 'uid_missing',
            message: 'Body moet JSON bevatten met sleutel "uid"'
        });
    }
    
    try {
        // 1. Lookup user via RFID
        const rfidCard = await db.query(
            'SELECT user_id FROM rfid_cards WHERE uid = $1 AND is_active = true',
            [uid]
        );
        
        if (rfidCard.rows.length === 0) {
            return res.status(404).json({
                status: 'not_found',
                error: 'uid_not_found',
                message: 'Geen gebruiker gevonden met deze RFID kaart',
                uid
            });
        }
        
        const userId = rfidCard.rows[0].user_id;
        
        // 2. Get user info
        const user = await db.query(
            'SELECT id, username, full_name FROM users WHERE id = $1',
            [userId]
        );
        
        // 3. Check laatste event
        const lastEvent = await db.query(`
            SELECT id, check_in, check_out
            FROM attendance_events
            WHERE user_id = $1 AND is_external = false
            ORDER BY check_in DESC
            LIMIT 1
        `, [userId]);
        
        const now = new Date();
        
        // 4. Toggle check-in/out
        if (lastEvent.rows.length > 0 && lastEvent.rows[0].check_out === null) {
            // CHECK-OUT
            const eventId = lastEvent.rows[0].id;
            await db.query(
                'UPDATE attendance_events SET check_out = $1 WHERE id = $2',
                [now, eventId]
            );
            
            const duration = Math.floor((now - lastEvent.rows[0].check_in) / 1000);
            
            return res.json({
                status: 'ok',
                action: 'check_out',
                user: {
                    id: user.rows[0].id,
                    username: user.rows[0].username,
                    full_name: user.rows[0].full_name
                },
                event: {
                    id: eventId,
                    check_in: lastEvent.rows[0].check_in,
                    check_out: now,
                    duration_seconds: duration
                }
            });
        } else {
            // CHECK-IN
            const result = await db.query(`
                INSERT INTO attendance_events 
                (user_id, check_in, is_external, source)
                VALUES ($1, $2, false, 'rfid')
                RETURNING id
            `, [userId, now]);
            
            return res.json({
                status: 'ok',
                action: 'check_in',
                user: {
                    id: user.rows[0].id,
                    username: user.rows[0].username,
                    full_name: user.rows[0].full_name
                },
                event: {
                    id: result.rows[0].id,
                    check_in: now,
                    check_out: null
                }
            });
        }
    } catch (error) {
        console.error('Scan endpoint error:', error);
        return res.status(500).json({
            status: 'error',
            error: 'server_error',
            message: 'Onverwachte fout aan serverzijde'
        });
    }
});

module.exports = router;
```

**Test met curl:**
```bash
# Test scan (check-in)
curl -X POST http://localhost:3000/api/v1/attendance/scan \
  -H "Content-Type: application/json" \
  -d '{"uid": "ABC123"}'

# Test scan again (check-out)
curl -X POST http://localhost:3000/api/v1/attendance/scan \
  -H "Content-Type: application/json" \
  -d '{"uid": "ABC123"}'
```

### 5. Test met Raspberry Pi (Day 3)

**Update Raspberry Pi script:**

```python
# /home/pi/rfid_scan.py
import RPi.GPIO as GPIO
import MFRC522
import requests
import json
import time

# NEW endpoint
API_URL = "https://team-app.example.com/api/v1/attendance/scan"
# or for testing: "http://192.168.1.100:3000/api/v1/attendance/scan"

def scan_and_post():
    reader = MFRC522.MFRC522()
    
    while True:
        (status, TagType) = reader.MFRC522_Request(reader.PICC_REQIDL)
        
        if status == reader.MI_OK:
            (status, uid) = reader.MFRC522_Anticoll()
            
            if status == reader.MI_OK:
                uid_string = ''.join([str(x) for x in uid])
                
                print(f"Kaart gescand: {uid_string}")
                
                try:
                    response = requests.post(API_URL, 
                        json={"uid": uid_string},
                        timeout=5
                    )
                    
                    data = response.json()
                    
                    if data['status'] == 'ok':
                        action = data['action']
                        name = data['user']['full_name']
                        print(f"✓ {action.upper()}: {name}")
                        # LED feedback, beep, etc.
                    else:
                        print(f"✗ Error: {data.get('message', 'Unknown')}")
                        
                except requests.exceptions.RequestException as e:
                    print(f"✗ API call failed: {e}")
                
                time.sleep(2)  # Debounce

if __name__ == '__main__':
    scan_and_post()
```

### 6. Frontend Prototype (Day 4-5)

**Create basic dashboard page:**

```typescript
// frontend/src/pages/ThirdBlok/AttendanceDashboard.tsx
import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { Table, Button, DatePicker, Input } from 'antd'; // of jouw component library

interface AttendanceEvent {
    id: number;
    user: {
        id: number;
        full_name: string;
        username: string;
    };
    check_in: string;
    check_out: string | null;
    duration_seconds: number | null;
}

export const AttendanceDashboard: React.FC = () => {
    const [filters, setFilters] = useState({
        name: '',
        date: null as Date | null
    });
    
    const { data, isLoading, error } = useQuery(
        ['attendance-events', filters],
        () => fetchAttendanceEvents(filters),
        { keepPreviousData: true }
    );
    
    const columns = [
        {
            title: 'Naam',
            dataIndex: ['user', 'full_name'],
            key: 'name'
        },
        {
            title: 'Check-in',
            dataIndex: 'check_in',
            key: 'check_in',
            render: (date: string) => new Date(date).toLocaleString('nl-NL')
        },
        {
            title: 'Check-out',
            dataIndex: 'check_out',
            key: 'check_out',
            render: (date: string | null) => 
                date ? new Date(date).toLocaleString('nl-NL') : 'Open'
        },
        {
            title: 'Duur',
            dataIndex: 'duration_seconds',
            key: 'duration',
            render: (seconds: number | null) => 
                seconds ? formatDuration(seconds) : '-'
        }
    ];
    
    return (
        <div>
            <h1>Aanwezigheid Dashboard</h1>
            
            <div style={{ marginBottom: 16 }}>
                <Input
                    placeholder="Zoek op naam..."
                    value={filters.name}
                    onChange={e => setFilters({ ...filters, name: e.target.value })}
                    style={{ width: 200, marginRight: 8 }}
                />
                <DatePicker
                    placeholder="Datum"
                    onChange={date => setFilters({ ...filters, date })}
                />
            </div>
            
            <Table
                columns={columns}
                dataSource={data?.events || []}
                loading={isLoading}
                rowKey="id"
                pagination={{
                    total: data?.pagination?.total,
                    pageSize: 50
                }}
            />
        </div>
    );
};

function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

async function fetchAttendanceEvents(filters: any) {
    const params = new URLSearchParams();
    if (filters.name) params.append('name', filters.name);
    if (filters.date) params.append('date', filters.date.toISOString().split('T')[0]);
    
    const response = await fetch(`/api/v1/attendance/events?${params}`);
    return response.json();
}
```

**Add route:**
```typescript
// frontend/src/App.tsx (of routes.tsx)
import { AttendanceDashboard } from './pages/ThirdBlok/AttendanceDashboard';

// In je routes:
<Route path="/app/3de-blok/dashboard" element={<AttendanceDashboard />} />
```

### 7. Migration Dry-Run (Week 2)

**Export legacy data:**
```bash
cd /path/to/3de_blok_app

# Export to CSV
mysql -u rfid_user -p attendance -e "
  SELECT uid, username, name, \`class\`
  INTO OUTFILE '/tmp/students_export.csv'
  FIELDS TERMINATED BY ',' ENCLOSED BY '\"'
  FROM students
  WHERE is_active = 1;"

mysql -u rfid_user -p attendance -e "
  SELECT id, uid, check_in, check_out
  INTO OUTFILE '/tmp/logs_export.csv'
  FIELDS TERMINATED BY ',' ENCLOSED BY '\"'
  FROM logs;"
```

**Run mapping script:**
```python
# scripts/migrate_students.py
import csv
import psycopg2

# Connect to Team App DB
conn = psycopg2.connect("postgresql://user:pass@localhost/team_app_dev")
cur = conn.cursor()

matched = 0
unmatched = 0

with open('/tmp/students_export.csv', 'r') as f:
    reader = csv.reader(f)
    for row in reader:
        uid, username, name, klas = row
        
        # Match op username
        cur.execute("SELECT id FROM users WHERE username = %s", (username,))
        user = cur.fetchone()
        
        if user:
            user_id = user[0]
            
            # Insert RFID card
            cur.execute("""
                INSERT INTO rfid_cards (user_id, uid, is_active)
                VALUES (%s, %s, true)
                ON CONFLICT (uid) DO NOTHING
            """, (user_id, uid))
            
            matched += 1
            print(f"✓ Matched: {username} → user_id {user_id}")
        else:
            # Add to quarantine
            cur.execute("""
                INSERT INTO migration_quarantine 
                (entity_type, legacy_uid, legacy_username, legacy_name, legacy_class, status)
                VALUES ('student', %s, %s, %s, %s, 'pending')
            """, (uid, username, name, klas))
            
            unmatched += 1
            print(f"✗ Unmatched: {username} (added to quarantine)")

conn.commit()
print(f"\nMatched: {matched}, Unmatched: {unmatched}")
print(f"Success rate: {matched/(matched+unmatched)*100:.1f}%")
```

### 8. Checklist Milestone 1 (Week 1-2)

- [ ] Team App schema inspected & documented
- [ ] Assumptions verified
- [ ] Development environment setup (Postgres + Team App clone)
- [ ] attendance_schema.sql created & tested
- [ ] Scan endpoint implemented & tested (unit tests)
- [ ] Scan endpoint tested with curl
- [ ] Scan endpoint tested with Raspberry Pi
- [ ] Basic AttendanceDashboard page created
- [ ] Route added to Team App nav
- [ ] Migration scripts written (dry-run mode)
- [ ] Dry-run executed, results documented
- [ ] Quarantine entries reviewed
- [ ] Code review completed
- [ ] Merged to main/develop branch

---

## Voor Product Owners / Stakeholders

### Week 1-2 Demo
**Verwachte deliverables:**
- Working scan endpoint (Raspberry Pi → check-in/out)
- Basic dashboard (lijst logs met filters)
- Dry-run migration results (X% matched, Y unmatched)

**Demo script:**
1. Open dashboard → leeg
2. Scan RFID kaart → check-in event verschijnt in dashboard
3. Scan again → check-out, duration berekend
4. Filter op naam/datum → werkt
5. Toon migration results (matched vs unmatched)

### Week 3-4 Demo
**Verwachte deliverables:**
- Complete teacher dashboard (edit, delete, bulk actions, export)
- External work workflow (student register → teacher approve)
- Admin panel (students + RFID management)

### Week 5-6 Demo
**Verwachte deliverables:**
- Stats page met charts
- Real-time presence view
- Student portal (eigen overzicht + extern registreren)

### Week 7-8
**Milestone: Migration complete**
- All legacy data migrated
- Validation passed
- UAT conducted

### Week 9
**Milestone: Production deployment**
- Live in production
- Raspberry Pi configured
- Users trained

---

## Troubleshooting

### Scan endpoint returns 404
- Check rfid_cards tabel: `SELECT * FROM rfid_cards WHERE uid = 'ABC123';`
- Check is_active flag
- Check user exists: `SELECT * FROM users WHERE id = X;`

### Slow queries
- Check indexes: `\d attendance_events`
- Run EXPLAIN ANALYZE
- Consider adding pagination

### Migration: Low match rate (<90%)
- Check username formatting (lowercase, trim)
- Try email fallback matching
- Check sample of unmatched entries
- Review Team App users: any deleted/inactive accounts?

### Raspberry Pi connection failed
- Check network connectivity: `ping team-app.example.com`
- Check SSL cert: `curl -v https://team-app.example.com/api/v1/attendance/scan`
- Check firewall rules
- Check API key (if using auth)

---

**Questions?**  
- Check REBUILD_PLAN.md section 10 (Volgende Stappen)
- Review assumptions (section 9)
- Consult architecture diagrams

**Ready to start?**  
→ Begin met "Verify Assumptions" checklist above
