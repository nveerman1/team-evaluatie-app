# Plan: Templates opnieuw opbouwen via Alembic

## 1. Scope bepalen
We vervangen *alle* bestaande templates:
- Peerevaluatie-criteria  
- Projectbeoordeling-criteria  
- Competenties (+ niveaubeschrijvingen)  
- Leerdoelen (onderbouw + bovenbouw)  
- Mail-templates  
- Standaardopmerkingen  

## 2. Brondefinitie in JSON
Maak per type een datafile in de repository, bijvoorbeeld:
- `data/templates/learning_objectives_onderbouw.json`
- `data/templates/learning_objectives_bovenbouw.json`
- `data/templates/competencies.json`
- `data/templates/peer_criteria.json`
- `data/templates/project_criteria.json`
- `data/templates/mail_templates.json`
- `data/templates/standard_remarks.json`

Inhoud: definitieve canon van wat je in de app wilt tonen.

## 3. Alembic data-migraties schrijven
Per cluster één migratie:
1. `seed_learning_objectives`
2. `seed_competencies`
3. `seed_peer_criteria`
4. `seed_project_criteria`
5. `seed_mail_templates`
6. `seed_standard_remarks`

Elke migratie doet:
1. **DELETE** alle bestaande rijen in de relevante tabel(len).
2. **INSERT** nieuwe data uit de JSON.
3. Gebruik waar nuttig **ON CONFLICT** voor idempotentie.

## 4. Testvolgorde
### Development
- DB-dump maken.  
- `alembic upgrade head` draaien.  
- UI controleren.

### Staging
- Zelfde als dev, maar met productie-achtige data.

### Productie
- Volledige DB-backup maken.  
- `alembic upgrade head` uitvoeren.  
- Smoke tests uitvoeren:
  - 1 projectbeoordeling
  - 1 peerevaluatie
  - 1 mail genereren

## 5. Rollbackstrategie
- Primair: DB-backup terugzetten.
- Secundair: eenvoudige `downgrade()` in elke migratie die ingevoerde templates verwijdert.

## 6. Beheer op lange termijn
- Alle wijzigingen verlopen via:
  - Aanpassen van JSON in `data/templates/`
  - Nieuwe kleine Alembic-migratie **of** een `seed_templates.py` script
- Zo blijft de waarheid over templates versie-gecontroleerd in Git.

