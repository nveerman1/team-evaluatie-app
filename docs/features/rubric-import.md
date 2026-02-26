# Rubric importeren via CSV

Met de CSV-importfunctie kunnen docenten en beheerders in één keer meerdere rubrics aanmaken, inclusief beoordelingscriteria, gewichten, niveau-descriptoren en koppelingen met leerdoelen.

---

## Toegang

Navigeer naar **Rubrics → 📥 CSV Importeren**. De knop verschijnt bovenaan de rubricpagina (tabblad _Peer_ of _Project_).

---

## Stappenplan

1. Bereid een CSV-bestand voor (zie formaat hieronder).
2. Sleep het bestand naar het uploadvak of klik **Bestand selecteren**.
3. Controleer de **preview**: de app toont per rubric welke criteria worden aangemaakt en of de leerdoelkoppelingen gevonden zijn (✓ = gevonden, ✗ = niet gevonden).
4. Klik **Importeren** om de rubrics definitief op te slaan.

---

## CSV-formaat

```
scope,target_level,rubric_title,rubric_description,scale_min,scale_max,
criterion_name,category,weight,level1,level2,level3,level4,level5,learning_objectives
```

| Kolom                 | Verplicht | Waarden / notatie                                    |
|-----------------------|-----------|------------------------------------------------------|
| `scope`               | ✅        | `peer` of `project`                                  |
| `rubric_title`        | ✅        | Naam van de rubric                                   |
| `criterion_name`      | ✅        | Naam van het criterium                               |
| `target_level`        | –         | `onderbouw` of `bovenbouw`                           |
| `rubric_description`  | –         | Vrije tekst                                          |
| `scale_min`           | –         | Standaard `1`                                        |
| `scale_max`           | –         | Standaard `5`                                        |
| `category`            | –         | **Peer**: `Organiseren` · `Meedoen` · `Zelfvertrouwen` · `Autonomie` (OMZA) — **Project**: `Projectproces` · `Eindresultaat` · `Communicatie` |
| `weight`              | –         | Decimaal gewicht per criterium (worden genormaliseerd naar 1,0) |
| `level1` … `level5`  | –         | Tekstbeschrijving per schaalniveau                   |
| `learning_objectives` | –         | Puntkomma-gescheiden `order`-nummers, bijv. `11;13;41` |

### Regels

- Eén rij = één criterium. Meerdere rijen met dezelfde `rubric_title` worden samengevoegd tot één rubric.
- Gewichten worden automatisch genormaliseerd als hun som niet gelijk is aan 1,0.
- Alleen leerdoelen met `is_template = true` (beheerd via **Leerdoelen → Sjablonen**) worden gekoppeld. Ontbrekende nummers geven een waarschuwing, maar stoppen de import niet.
- Maximale bestandsgrootte: **10 MB** — maximaal **10 000 gegevensrijen**.

---

## Voorbeeld CSV

Een kant-en-klaar voorbeeldbestand voor een **onderbouw industrial-design productontwerp**-project (inclusief peer-evaluatierubric) is beschikbaar op:

```
docs/examples/rubric_import_productontwerp_onderbouw.csv
```

Dit bestand bevat:

| Rubric                        | Scope   | Aantal criteria | Categorieën (geldig)                                  | LO orders |
|-------------------------------|---------|-----------------|-------------------------------------------------------|-----------|
| Productontwerp Onderbouw      | project | 5               | `Projectproces` (×2), `Eindresultaat` (×2), `Communicatie` (×1) | 11, 13, 14, 16, 17, 18, 20, 21, 22, 25, 41, 42, 43, 44, 45 |
| Samenwerken Productontwerp    | peer    | 3               | `Meedoen` (×1), `Organiseren` (×1), `Autonomie` (×1)  | 1, 3, 4, 5, 15, 29 |

De order-nummers verwijzen naar de onderbouw-leerdoelen in `backend/data/templates/learning_objectives_onderbouw.json`:

| Order | Code   | Domein                            | Titel                                      |
|-------|--------|-----------------------------------|--------------------------------------------|
| 1     | OB1.1  | Samenwerken                       | Actief meewerken in het team               |
| 3     | OB1.3  | Samenwerken                       | Informatie delen binnen het team           |
| 4     | OB1.4  | Samenwerken                       | Eerlijke taakverdeling maken               |
| 5     | OB1.5  | Samenwerken                       | Teamleden helpen waar nodig                |
| 11    | OB3.1  | Creatief Denken & Probleemoplossen | Meerdere ideeën bedenken                  |
| 13    | OB3.3  | Creatief Denken & Probleemoplossen | Bijpassend idee kiezen en onderbouwen     |
| 14    | OB3.4  | Creatief Denken & Probleemoplossen | Oplossingen uitproberen                   |
| 15    | OB3.5  | Creatief Denken & Probleemoplossen | Idee verbeteren met feedback              |
| 16    | OB4.1  | Technische Vaardigheden           | Zorgvuldig werken met materialen en gereedschap |
| 17    | OB4.2  | Technische Vaardigheden           | Eenvoudige technische handelingen uitvoeren |
| 18    | OB4.3  | Technische Vaardigheden           | Eenvoudig 2D- of 3D-model maken           |
| 20    | OB4.5  | Technische Vaardigheden           | Technische oplossing controleren          |
| 21    | OB5.1  | Communicatie & Presenteren        | Eigen werk duidelijk uitleggen            |
| 22    | OB5.2  | Communicatie & Presenteren        | Visuele hulpmiddelen gebruiken            |
| 25    | OB5.5  | Communicatie & Presenteren        | Vragen over het werk beantwoorden         |
| 29    | OB6.4  | Reflectie & Professionele houding | Feedback serieus nemen                    |
| 41    | OB9.1  | Ontwerpend Werken                 | Idee voor een oplossing schetsen          |
| 42    | OB9.2  | Ontwerpend Werken                 | Rekening houden met eisen in de opdracht  |
| 43    | OB9.3  | Ontwerpend Werken                 | Eenvoudig model of prototype maken        |
| 44    | OB9.4  | Ontwerpend Werken                 | Ontwerp verbeteren met testresultaten     |
| 45    | OB9.5  | Ontwerpend Werken                 | Werking en doelgroep van het ontwerp uitleggen |

---

## Foutafhandeling

| Situatie                              | Gedrag                                           |
|---------------------------------------|--------------------------------------------------|
| Verplichte kolom ontbreekt            | Import geblokkeerd met foutmelding               |
| Ongeldige `scope`-waarde              | Rij wordt overgeslagen met foutmelding           |
| Onbekend `learning_objectives`-nummer | Waarschuwing; koppeling wordt niet aangemaakt    |
| Gewichten die niet optellen tot 1,0   | Automatisch genormaliseerd; waarschuwing getoond |
| Bestand groter dan 10 MB              | Import geblokkeerd                               |
| Meer dan 10 000 rijen                 | Import geblokkeerd                               |
