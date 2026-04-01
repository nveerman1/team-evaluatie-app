# GCF (Group Correction Factor) — Uitleg

## Wat is de GCF?

De GCF (Group Correction Factor) is een correctiefactor die aangeeft hoe een individuele student presteert **ten opzichte van de rest van het team**, op basis van peer-evaluaties. De GCF wordt gebruikt om het groepscijfer individueel aan te passen:

**Eindcijfer = Groepscijfer × GCF**

---

## Stap-voor-stap berekening

### Stap 1: Peer-percentage per student

Elke student krijgt een gemiddeld percentage (0–100) op basis van hoe hun teamgenoten hen hebben beoordeeld op de rubric-criteria:

```
peer_pct = gewogen gemiddelde van alle ontvangen peer-scores, genormaliseerd naar 0–100%
```

### Stap 2: Team-gemiddelde berekenen

Per team wordt het gemiddelde van alle peer-percentages berekend:

```
team_mean = gemiddelde van alle peer_pct waarden binnen het team
```

### Stap 3: Ruwe GCF berekenen

Per student:

```
raw_gcf = peer_pct / team_mean
```

Dit zorgt ervoor dat de GCF **binnen een team altijd rond 1.0 middelt**.

### Stap 4: Clampen (begrenzen)

De ruwe GCF wordt begrensd tot het bereik dat in de evaluatie-instellingen staat (standaard 0.85 – 1.50):

```
gcf = clamp(raw_gcf, min_cf, max_cf)
```

---

## Voorbeelden

### Voorbeeld 1: Team met weinig verschil in scores

| Student | Peer % | Berekening  | Ruwe GCF | GCF (na clamp) |
|---------|--------|-------------|----------|----------------|
| Anna    | 78%    | 78 / 77.5   | 1.006    | **1.01**        |
| Bas     | 76%    | 76 / 77.5   | 0.981    | **0.98**        |
| Chris   | 79%    | 79 / 77.5   | 1.019    | **1.02**        |
| Dana    | 77%    | 77 / 77.5   | 0.994    | **0.99**        |

**Team-gemiddelde: 77.5%**

Iedereen scoort ongeveer hetzelfde. De GCF's liggen heel dicht bij 1.0. Als het groepscijfer 7.0 is, krijgt iedereen een eindcijfer tussen 6.9 en 7.1.

| Student | Eindcijfer (7.0 × GCF) |
|---------|------------------------|
| Anna    | **7.1**                |
| Bas     | **6.9**                |
| Chris   | **7.1**                |
| Dana    | **6.9**                |

---

### Voorbeeld 2: Team met groot verschil in scores

| Student | Peer % | Berekening  | Ruwe GCF | GCF (na clamp) |
|---------|--------|-------------|----------|----------------|
| Emma    | 90%    | 90 / 70     | 1.286    | **1.29**        |
| Finn    | 85%    | 85 / 70     | 1.214    | **1.21**        |
| Gijs    | 55%    | 55 / 70     | 0.786    | **0.85***       |
| Hannah  | 50%    | 50 / 70     | 0.714    | **0.85***       |

**Team-gemiddelde: 70%**

*\* Geclampt naar min_cf = 0.85 (standaardinstelling)*

Emma en Finn worden door peers veel hoger beoordeeld. Gijs en Hannah zitten onder de ondergrens van 0.85, dus worden ze afgekapt. Met groepscijfer 7.0:

| Student | Eindcijfer (7.0 × GCF) |
|---------|------------------------|
| Emma    | **9.0**                |
| Finn    | **8.5**                |
| Gijs    | **6.0**                |
| Hannah  | **6.0**                |

---

### Voorbeeld 3: Eén freerider in het team

| Student | Peer % | Berekening   | Ruwe GCF | GCF (na clamp) |
|---------|--------|--------------|----------|----------------|
| Iris    | 82%    | 82 / 68.5    | 1.197    | **1.20**        |
| Jan     | 80%    | 80 / 68.5    | 1.168    | **1.17**        |
| Kim     | 78%    | 78 / 68.5    | 1.139    | **1.14**        |
| Luuk    | 34%    | 34 / 68.5    | 0.496    | **0.85***       |

**Team-gemiddelde: 68.5%**

*\* Geclampt naar 0.85*

Luuk trekt het gemiddelde omlaag, waardoor de andere drie relatief **hoger** uitkomen dan ze zonder Luuk zouden zijn. Met groepscijfer 7.5:

| Student | Eindcijfer (7.5 × GCF) |
|---------|------------------------|
| Iris    | **9.0**                |
| Jan     | **8.8**                |
| Kim     | **8.6**                |
| Luuk    | **6.4**                |

---

## Belangrijke eigenschappen

| Eigenschap                        | Uitleg                                                                                              |
|-----------------------------------|-----------------------------------------------------------------------------------------------------|
| **Middelt rond 1.0**             | Binnen een team is het gemiddelde van alle ruwe GCF's altijd exact 1.0                              |
| **Relatief, niet absoluut**       | De GCF zegt niks over hoe goed een team is, alleen hoe studenten *binnen* het team presteren        |
| **Clamp beschermt**              | De min_cf/max_cf grenzen voorkomen dat één extreme score het eindcijfer te veel beïnvloedt          |
| **Onafhankelijk van andere teams**| Team A's GCF-waarden worden niet beïnvloed door team B                                              |

---

## Relatie met het suggestiecijfer

Het **suggestiecijfer** wordt apart berekend op basis van de peer- en self-scores (75% peer, 25% self), zonder de GCF. Het suggestiecijfer is een individueel cijfervoorstel puur op basis van hoe iemand is beoordeeld. De GCF daarentegen is een *relatieve correctiefactor* die pas effect heeft wanneer er een groepscijfer is ingevuld.

| Begrip            | Basis                              | Doel                                          |
|-------------------|------------------------------------|-----------------------------------------------|
| **Suggestiecijfer** | Peer- en self-scores (absoluut)    | Individueel cijfervoorstel zonder groepscijfer |
| **GCF**            | Peer-scores t.o.v. teamgemiddelde  | Correctiefactor op het groepscijfer            |
| **Eindcijfer**     | Groepscijfer × GCF                 | Definitief individueel cijfer                  |