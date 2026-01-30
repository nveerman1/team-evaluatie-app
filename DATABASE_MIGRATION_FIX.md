# Database Migration Fix

## Problem

Het seed script (`scripts/seed.py`) geeft de volgende error:

```
psycopg2.errors.UndefinedColumn: column "project_team_id" of relation "project_team_externals" does not exist
```

## Oorzaak

De database schema is niet up-to-date met de code. De `project_team_id` kolom is wel gedefinieerd in:
- Het model (`app/infra/db/models.py`)
- De migratie (`migrations/versions/118f1aa65586_initial_migration.py`)

Maar de migraties zijn niet uitgevoerd op jouw database.

## Oplossing

Voer de database migraties uit met Alembic:

```bash
cd backend
alembic upgrade head
```

Dit zal alle ontbrekende kolommen en tabellen aanmaken in je database.

### Stappen om te verifiëren:

1. **Check huidige migratie status:**
   ```bash
   cd backend
   alembic current
   ```

2. **Voer migraties uit:**
   ```bash
   alembic upgrade head
   ```

3. **Controleer of het gelukt is:**
   ```bash
   alembic current
   ```
   
   Je zou moeten zien: `de711157475c (head)`

4. **Run het seed script opnieuw:**
   ```bash
   python -m scripts.seed --mode demo --reset
   ```

## Fixes in dit PR

De volgende issues zijn al opgelost in dit PR:

### 1. DeprecationWarning: datetime.utcnow()

**Gefixte bestanden:**
- `scripts/seed.py` (3 occurrences)
- `scripts/cleanup_stuck_jobs.py` (3 occurrences)

**Verandering:**
```python
# Oud (deprecated):
from datetime import datetime, timedelta
datetime.utcnow()

# Nieuw (timezone-aware):
from datetime import datetime, timedelta, UTC
datetime.now(UTC)
```

Deze waarschuwingen zouden nu niet meer verschijnen.

**Note:** De nieuwe syntax vereist Python 3.11+. De `UTC` constant is toegevoegd in Python 3.11. Het project gebruikt Python 3.12, zoals aangegeven in het error bericht van de gebruiker.

### 2. Database Schema Issue

De database schema error kan opgelost worden door de migraties uit te voeren zoals hierboven beschreven.

## Notities

- De `project_team_externals` tabel heeft een foreign key naar `project_teams.id` via de `project_team_id` kolom
- Deze kolom is nodig voor het koppelen van externe evaluatoren aan specifieke projectteams
- De migratie is al beschikbaar sinds de initial migration (`118f1aa65586`)

## Test na migratie

Na het uitvoeren van de migraties zou het seed script zonder errors moeten draaien:

```bash
cd backend
python -m scripts.seed --mode demo --reset --seed 42
```

De deprecation warnings voor `datetime.utcnow()` zouden nu ook niet meer verschijnen.
