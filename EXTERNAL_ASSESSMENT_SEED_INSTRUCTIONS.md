# External Assessment Seed Data - Test Instructions

Dit document beschrijft de seed data die is aangemaakt voor het testen van de externe beoordelings functionaliteit.

## Overzicht

De seed script `seed_external_assessment_test.py` maakt een complete test omgeving aan voor de route:
**`/teacher/project-assessments/1/external`**

## Aangemaakt Test Data

### School & Gebruikers
- **School ID**: 1 ("Test School")
- **Admin**: admin@test.school / test123
- **Docent**: teacher@test.school / test123
- **Studenten**: 5 studenten met email adressen student1@test.school tot student5@test.school (IDs worden automatisch toegekend door de database)

### Vak & Project Structuur
- **Subject**: "Onderzoek & Ontwerpen" (O&O)
- **Academic Year**: 2025-2026
- **Course ID**: 1 ("O&O G2")
- **Project ID**: 1 ("Test Project - Arcade Kast")

### Teams
Twee teams zijn aangemaakt:
- **Team 1**: 2 studenten (Student One, Student Two)
- **Team 2**: 3 studenten (Student Three, Student Four, Student Five)

### Rubric
**Rubric ID 3** met scope `project`:
- **Titel**: "Project Rubric - Externe Beoordeling"
- **Schaal**: 1-5
- **Criteria**:
  1. Creativiteit (zichtbaar voor externe beoordelaars) ✓
  2. Technische uitvoering (zichtbaar voor externe beoordelaars) ✓
  3. Presentatie (zichtbaar voor externe beoordelaars) ✓
  4. Samenwerking (NIET zichtbaar voor externe beoordelaars) ✗

### Project Assessment
**ProjectAssessment ID 1** (Docent beoordeling):
- Titel: "Tussentijdse Beoordeling - Test Project"
- Status: open
- Gekoppeld aan Project 1 en Rubric 3

### Externe Beoordelaars en Assessments
Twee externe beoordelaars zijn aangemaakt met complete beoordelingen:

1. **Jan de Vries** (jan.devries@extern.nl) - Team 1
   - Status: SUBMITTED (voltooid)
   - Scores: Creativiteit (5), Technische uitvoering (3), Presentatie (5)
   - Inclusief Nederlandse feedback bij elke score

2. **Maria Jansen** (maria.jansen@bedrijf.nl) - Team 2
   - Status: SUBMITTED (voltooid)
   - Scores: Creativiteit (3), Technische uitvoering (3), Presentatie (4)
   - Inclusief Nederlandse feedback bij elke score

Elke externe beoordelaar heeft:
- Een unieke uitnodiging token via ProjectTeamExternal
- Een voltooid extern assessment (ProjectAssessment met role=EXTERNAL)
- Scores voor alle criteria die zichtbaar zijn voor externe beoordelaars
- Nederlandse opmerkingen per score (bijv. "Uitstekend! Professioneel niveau.")

## Hoe Te Testen

### 1. Database Setup
```bash
# Start Docker services (Postgres & Redis)
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app
make up

# Of handmatig:
docker compose -f ops/docker/compose.dev.yml up -d
```

### 2. Backend Setup
```bash
cd backend

# Maak virtual environment aan (als nog niet gedaan)
python3 -m venv venv
source venv/bin/activate

# Installeer dependencies
pip install -r requirements.txt

# Kopieer environment file
cp .env.example .env

# Run migrations
alembic upgrade head

# Run seed script
python scripts/seed_external_assessment_test.py
```

### 3. Start Backend Server
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### 4. Start Frontend (in een nieuwe terminal)
```bash
cd frontend
npm install  # of pnpm install
npm run dev  # of pnpm dev
```

### 5. Test de Functionaliteit

1. Open browser naar: `http://localhost:3000`

2. Log in als docent:
   - Email: `teacher@test.school`
   - Wachtwoord: `test123`

3. Navigeer naar: `http://localhost:3000/teacher/project-assessments/1/external`

4. Verwachte resultaat:
   - Je ziet de externe beoordelings pagina
   - Team 1 en Team 2 zijn zichtbaar
   - Elke team heeft een gekoppelde externe beoordelaar
   - Status: SUBMITTED (voltooid) voor beide teams
   - Externe beoordelingen met scores zijn ingevuld en zichtbaar

## Database Query voor Verificatie

Als je de data wilt verifiëren in de database:

```sql
-- Check school en users
SELECT id, name, role, email FROM users WHERE school_id = 1;

-- Check course
SELECT id, name, code FROM courses WHERE id = 1;

-- Check project
SELECT id, title, status FROM projects WHERE id = 1;

-- Check rubric
SELECT id, title, scope FROM rubrics WHERE id = 3;

-- Check rubric criteria
SELECT id, name, visible_to_external FROM rubric_criteria WHERE rubric_id = 3;

-- Check project assessment
SELECT id, title, status, rubric_id, project_id FROM project_assessments WHERE id = 1;

-- Check teams
SELECT g.id, g.name, g.team_number, COUNT(gm.id) as member_count
FROM groups g
LEFT JOIN group_members gm ON g.id = gm.group_id
WHERE g.course_id = 1
GROUP BY g.id, g.name, g.team_number;

-- Check external evaluators
SELECT id, name, email, organisation FROM external_evaluators WHERE school_id = 1;

-- Check external links and assessment status
SELECT 
    pte.id,
    pte.team_number,
    ee.name as evaluator_name,
    pte.status,
    pa.title as assessment_title,
    pa.status as assessment_status,
    LEFT(pte.invitation_token, 20) as token_preview
FROM project_team_externals pte
JOIN external_evaluators ee ON pte.external_evaluator_id = ee.id
LEFT JOIN project_assessments pa ON pa.external_evaluator_id = ee.id AND pa.role = 'EXTERNAL'
WHERE pte.assessment_id = 1;

-- Check external assessment scores
SELECT 
    pa.id as assessment_id,
    pa.title,
    rc.name as criterion,
    pas.score,
    pas.comment
FROM project_assessments pa
JOIN project_assessment_scores pas ON pas.assessment_id = pa.id
JOIN rubric_criteria rc ON pas.criterion_id = rc.id
WHERE pa.role = 'EXTERNAL'
ORDER BY pa.id, rc.name;
```

## Opnieuw Seeden

Als je de data opnieuw wilt seeden met een schone database:

```bash
# Drop en recreate database
docker exec docker-db-1 psql -U app -d postgres -c "DROP DATABASE IF EXISTS tea;"
docker exec docker-db-1 psql -U app -d postgres -c "CREATE DATABASE tea;"

# Run migrations
cd backend
source venv/bin/activate
alembic upgrade head

# Run seed script again
python scripts/seed_external_assessment_test.py
```

## Troubleshooting

### Database Connectie Problemen
- Zorg dat Docker services draaien: `docker compose -f ops/docker/compose.dev.yml ps`
- Check database logs: `docker logs docker-db-1`

### Seed Script Fouten
- Zorg dat migrations zijn uitgevoerd: `alembic upgrade head`
- Check of database bestaat: `docker exec docker-db-1 psql -U app -d tea -c "\dt"`

### Frontend Problemen
- Check dat backend draait op port 8000
- Verify CORS settings in backend `.env`
- Check browser console voor errors

## Notities

- Alle user IDs (inclusief studenten) worden automatisch toegekend door de database en zijn niet voorspelbaar
- De rubric heeft 4 criteria waarvan er 3 zichtbaar zijn voor externe beoordelaars
- Elk team heeft zijn eigen externe beoordelaar
- ProjectTeam records hebben de team compositie "frozen" op het moment van aanmaken
