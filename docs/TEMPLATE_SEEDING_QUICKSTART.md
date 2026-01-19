# Template Seeding Quick Start

Snel templates in de database laden zonder Alembic migrations te gebruiken.

## Quick Commands

### Voor één school (nieuwe O&O subject):
```bash
python backend/scripts/seed_templates.py --school-id 1 --create-subject
```

### Voor alle scholen:
```bash
python backend/scripts/seed_templates.py --all-schools --create-subject
```

### Test eerst (dry run):
```bash
python backend/scripts/seed_templates.py --school-id 1 --create-subject --dry-run
```

## Vereist

```bash
export DATABASE_URL="postgresql://user:password@host:port/database"
```

## Wat wordt geseed?

✅ Peerevaluatie Criteria  
✅ Projectbeoordeling Criteria  
✅ Competenties  
✅ Leerdoelen  
✅ Mail Templates  
✅ Standaardopmerkingen  
✅ Projectrubrics  

## Meer Info

Zie [TEMPLATE_SEEDING_GUIDE.md](TEMPLATE_SEEDING_GUIDE.md) voor volledige documentatie.

## Command-line Opties

| Optie | Beschrijving |
|-------|-------------|
| `--school-id ID` | Seed voor specifieke school |
| `--subject-id ID` | Gebruik specifieke subject ID |
| `--create-subject` | Maak O&O subject aan indien nodig |
| `--all-schools` | Seed voor alle scholen |
| `--dry-run` | Test mode (geen wijzigingen) |

## Kenmerken

- ✅ **Idempotent**: Veilig meerdere keren uit te voeren
- ✅ **Flexibel**: Kies school_id en subject_id
- ✅ **Veilig**: Dry-run mode beschikbaar
- ✅ **Duidelijk**: Gedetailleerde output

## Template Bronnen

Templates komen uit JSON bestanden in `backend/data/templates/`:
- `peer_criteria.json`
- `project_assessment_criteria_vwo_bovenbouw.json`
- `competencies.json`
- `learning_objectives_onderbouw.json`
- `learning_objectives_bovenbouw.json`
