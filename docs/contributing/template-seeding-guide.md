# Template Seeding Guide

## Overzicht

Dit document beschrijft hoe je de template data in de database kunt laden met behulp van het `seed_templates.py` script in plaats van Alembic migrations.

## Wat wordt er geseed?

Het script laadt de volgende templates in:

1. **Peerevaluatie Criteria** - Criteria voor peer evaluations (uit `peer_criteria.json`)
2. **Projectbeoordeling Criteria** - Criteria voor projectbeoordelingen (uit `project_assessment_criteria_vwo_bovenbouw.json`)
3. **Projectrubrics** - Standaard rubrics voor verschillende niveaus (onderbouw, HAVO bovenbouw, VWO bovenbouw)
4. **Competenties** - Competentie templates met categorieën en rubric levels (uit `competencies.json`)
5. **Leerdoelen** - Leerdoelen voor onderbouw en bovenbouw (uit `learning_objectives_*.json`)
6. **Mail Templates** - Standaard e-mail templates voor verschillende scenario's
7. **Standaardopmerkingen** - Standaard feedback opmerkingen
8. **Tags & Metadata** - Template tags voor organisatie (via de database structuur)

## Vereisten

- Python 3.9 of hoger
- PostgreSQL database
- `DATABASE_URL` environment variable ingesteld
- Benodigde Python packages (zie `requirements.txt`)

## Installatie

```bash
# Installeer dependencies (als dat nog niet gebeurd is)
cd backend
pip install -r requirements.txt
```

## Gebruik

### Basis Gebruik

#### Voor één school met nieuwe O&O subject:

```bash
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app
python backend/scripts/seed_templates.py --school-id 1 --create-subject
```

#### Voor één school met bestaande subject:

```bash
python backend/scripts/seed_templates.py --school-id 1 --subject-id 2
```

#### Voor alle scholen in de database:

```bash
python backend/scripts/seed_templates.py --all-schools --create-subject
```

### Dry Run Mode

Om te zien wat er gedaan zou worden zonder wijzigingen te maken:

```bash
python backend/scripts/seed_templates.py --school-id 1 --create-subject --dry-run
```

## Opties

| Optie | Beschrijving |
|-------|-------------|
| `--school-id ID` | Seed templates voor specifieke school (verplicht tenzij `--all-schools`) |
| `--subject-id ID` | Gebruik specifieke subject ID (standaard: maak of gebruik O&O subject) |
| `--create-subject` | Maak "O&O" (Onderzoek & Ontwerpen) subject aan als deze niet bestaat |
| `--all-schools` | Seed templates voor alle scholen in database |
| `--dry-run` | Toon wat er gedaan zou worden zonder wijzigingen te maken |
| `--help` | Toon help bericht |

## Environment Variables

Het script heeft de volgende environment variable nodig:

- `DATABASE_URL`: PostgreSQL connection string
  - Formaat: `postgresql://user:password@host:port/database`
  - Voorbeeld: `postgresql://postgres:password@localhost:5432/team_evaluatie`

## Voorbeelden

### Voorbeeld 1: Eerste keer seeden voor nieuwe school

```bash
# Exporteer database URL
export DATABASE_URL="postgresql://user:pass@localhost:5432/team_evaluatie"

# Seed templates voor school 1
python backend/scripts/seed_templates.py --school-id 1 --create-subject
```

### Voorbeeld 2: Templates toevoegen aan bestaande subject

```bash
# Als je al een subject hebt met ID 5
python backend/scripts/seed_templates.py --school-id 1 --subject-id 5
```

### Voorbeeld 3: Alle scholen in één keer seeden

```bash
# Handig voor productie deployment
python backend/scripts/seed_templates.py --all-schools --create-subject
```

### Voorbeeld 4: Test mode (dry run)

```bash
# Zie wat er gebeurt zonder wijzigingen te maken
python backend/scripts/seed_templates.py --school-id 1 --create-subject --dry-run
```

## Idempotentie

Het script is **idempotent**, wat betekent dat je het meerdere keren kunt uitvoeren zonder problemen:

- Templates die al bestaan worden overgeslagen
- Geen duplicaten worden aangemaakt
- Het script toont hoeveel items zijn toegevoegd vs. overgeslagen

## Template Data Files

De template data komt uit JSON bestanden in `backend/data/templates/`:

- `peer_criteria.json` - Peer evaluatie criteria
- `project_assessment_criteria_vwo_bovenbouw.json` - Projectbeoordeling criteria
- `competencies.json` - Competenties met categorieën en levels
- `learning_objectives_onderbouw.json` - Leerdoelen onderbouw
- `learning_objectives_bovenbouw.json` - Leerdoelen bovenbouw

## Output

Het script geeft duidelijke feedback tijdens het uitvoeren:

```
✓ Connected to database
  ✓ Found existing O&O subject (ID: 1)

============================================================
Seeding templates for school_id=1, subject_id=1
============================================================

📚 Seeding Learning Objectives...
  ✓ Inserted 45 learning objectives
  ℹ Skipped 0 existing learning objectives

🎯 Seeding Competency Templates...
  ✓ Inserted 8 competency categories
  ✓ Inserted 32 competency templates
  ℹ Skipped 0 existing competencies

👥 Seeding Peer Evaluation Criteria Templates...
  ✓ Inserted 24 peer evaluation criterion templates
  ℹ Skipped 0 existing templates

📋 Seeding Project Assessment Criteria Templates...
  ✓ Inserted 18 project assessment criterion templates
  ℹ Skipped 0 existing templates

📊 Seeding Project Rubric Templates...
  ✓ Inserted 3 project rubric templates
  ℹ Skipped 0 existing rubrics

📧 Seeding Mail Templates...
  ✓ Inserted 4 mail templates
  ℹ Skipped 0 existing templates

💬 Seeding Standard Remarks (Standaardopmerkingen)...
  ✓ Inserted 13 standard remarks
  ℹ Skipped 0 existing remarks

============================================================
✅ Template seeding complete!
============================================================

✓ Changes committed to database
```

## Troubleshooting

### Error: DATABASE_URL environment variable not set

**Oplossing:** Stel de `DATABASE_URL` environment variable in:

```bash
export DATABASE_URL="postgresql://user:password@host:port/database"
```

### Error: No O&O subject found for school

**Oplossing:** Gebruik de `--create-subject` flag:

```bash
python backend/scripts/seed_templates.py --school-id 1 --create-subject
```

### Error: Template file not found

**Probleem:** Een JSON template bestand ontbreekt.

**Oplossing:** Zorg dat alle JSON bestanden aanwezig zijn in `backend/data/templates/`.

### Error: psycopg2 module not found

**Oplossing:** Installeer de requirements:

```bash
pip install -r backend/requirements.txt
```

## Integratie met Deployment

### In deployment scripts

Je kunt het script toevoegen aan je deployment proces:

```bash
#!/bin/bash
# deploy.sh

# Run migrations
alembic upgrade head

# Seed templates (idempotent, veilig om meerdere keren uit te voeren)
python backend/scripts/seed_templates.py --all-schools --create-subject
```

### Docker entrypoint

In je Docker container kun je het toevoegen aan de entrypoint:

```dockerfile
CMD ["sh", "-c", "alembic upgrade head && python scripts/seed_templates.py --all-schools --create-subject && uvicorn main:app --host 0.0.0.0"]
```

## Migratie van Oude Migrations

Als je al migrations hebt gebruikt om templates te seeden:

1. Het script is idempotent - het zal bestaande data niet dupliceren
2. Je kunt oude seed migrations verwijderen of uitschakelen
3. Gebruik vanaf nu het script voor nieuwe deployments

## Best Practices

1. **Dry run eerst**: Gebruik altijd `--dry-run` om te zien wat er gebeurt
2. **Backup eerst**: Maak een backup van je database voor je productie data seed
3. **Test in staging**: Test het script eerst in een staging environment
4. **Version control**: De JSON template files zitten in git, waardoor wijzigingen traceerbaar zijn
5. **Idempotentie**: Het script is veilig om meerdere keren uit te voeren

## Aanpassingen van Templates

Als je de template data wilt aanpassen:

1. **Wijzig de JSON bestanden** in `backend/data/templates/`
2. **Test lokaal** met `--dry-run`
3. **Run het script** opnieuw - nieuwe items worden toegevoegd, bestaande blijven ongewijzigd
4. **Commit de wijzigingen** naar git

Let op: Het script **overschrijft geen bestaande templates**. Als je bestaande templates wilt wijzigen, moet je dat via de database of admin interface doen.

## Verschillen met Migrations

### Voordelen van Script vs. Migrations:

| Aspect | Script | Migrations |
|--------|--------|-----------|
| **Flexibiliteit** | ✅ Kan parameters meegeven (school_id, subject_id) | ❌ Hardcoded waarden |
| **Herbruikbaarheid** | ✅ Kan meerdere keren draaien voor verschillende scholen | ❌ Eenmalig per migration |
| **Dry run** | ✅ Test mode beschikbaar | ❌ Niet mogelijk |
| **Duidelijkheid** | ✅ Duidelijke output en feedback | ⚠️ Beperkte feedback |
| **Idempotentie** | ✅ Veilig meerdere keren uit te voeren | ⚠️ Moet expliciet geïmplementeerd worden |
| **Deployment** | ✅ Kan apart van migrations worden gedraaid | ❌ Gekoppeld aan migration sequentie |

## Support

Voor vragen of problemen:

1. Controleer dit document
2. Run het script met `--help` voor meer informatie
3. Check de logs voor specifieke error messages
4. Gebruik `--dry-run` om te debuggen zonder wijzigingen

## Conclusie

Het `seed_templates.py` script biedt een flexibele, veilige en herhaalbare manier om template data te seeden. Het vervangt de noodzaak voor Alembic migrations voor template data en geeft meer controle over wanneer en hoe templates worden geseed.
