# ⚠️ BELANGRIJKE DIAGNOSE: Waar draait je backend?

## Het Probleem
Je zegt: "ik héb de backend herstart en ik krijg nog steeds 422"

**MAAR:** Mijn tests laten zien dat er **GEEN backend draait op localhost:8000**

## Diagnose

### Test 1: Is er een lokale backend?
```bash
$ curl http://127.0.0.1:8000/health
curl: (7) Failed to connect - NO BACKEND RUNNING
```

### Test 2: Zijn er backend processen?
```bash
$ ps aux | grep uvicorn
# Geen processen gevonden
```

## Mogelijke Verklaringen

### Scenario 1: Je test tegen productie/staging 🎯 **MEEST WAARSCHIJNLIJK**
Als je frontend draait en API calls maakt, test je mogelijk tegen:
- Een productie server (die de OUDE code heeft)
- Een staging server (die de OUDE code heeft)
- Een remote backend (niet jouw lokale machine)

**Hoe te checken:**
1. Open je browser Developer Tools (F12)
2. Ga naar Network tab
3. Maak de API call die faalt
4. Kijk naar de Request URL - naar welke server gaat het?

**Als het naar een remote server gaat:** Die server moet geüpdatet worden met de nieuwe code!

### Scenario 2: Backend start met errors
Misschien start de backend, maar crashed meteen met een error.

**Hoe te checken:**
```bash
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app/backend
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Kijk naar de output - zijn er errors?

### Scenario 3: Python bytecode cache
De oude code zit in Python's `__pycache__` en wordt niet opnieuw geladen.

**Oplossing:**
```bash
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app/backend
# Clear alle Python cache
find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null
find . -type f -name '*.pyc' -delete

# Start opnieuw
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Scenario 4: Meerdere backend processen
Er draaien meerdere backend processen en je hebt er maar één gestopt.

**Oplossing:**
```bash
# Kill ALLE backend processen
pkill -9 -f uvicorn
pkill -9 -f 'python.*app.main'

# Wacht even
sleep 2

# Check of alles echt weg is
ps aux | grep uvicorn

# Start opnieuw
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## ACTIEPLAN

### Stap 1: Bepaal waar je backend draait

**Open Browser Developer Tools:**
1. Druk F12 in je browser
2. Ga naar Network tab
3. Clear alle requests
4. Refresh de pagina die de 422 error geeft
5. Kijk naar de failing request
6. Kijk naar de "Request URL"

**Belangrijke vragen:**
- Gaat de request naar `localhost:3000` of `localhost:8000`?
- Of naar een externe URL zoals `app.technasiummbh.nl`?
- Wat is de volledige URL?

### Stap 2: Als het naar localhost gaat

```bash
# 1. Zorg dat je in de juiste directory zit
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app

# 2. Check de branch
git branch
# Moet zijn: * copilot/fix-routing-issue-windows

# 3. Kill alle backend processen
pkill -9 -f uvicorn
pkill -9 -f 'python.*app.main'

# 4. Clear Python cache
cd backend
find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null
find . -type f -name '*.pyc' -delete

# 5. Installeer dependencies (als nodig)
pip3 install -r requirements.txt

# 6. Start backend met EXPLICIT logging
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --log-level debug

# 7. In een ANDERE terminal, test:
curl -i http://127.0.0.1:8000/api/v1/competencies/windows/
```

**Verwachte output:** HTTP 401 (niet 422!)

### Stap 3: Als het naar een remote server gaat

De remote server heeft de OUDE code. Je moet:

1. **Push je changes naar de juiste branch**
2. **Deploy naar de server**
3. **Restart de backend op die server**

## Verificatie

Nadat je de backend (her)start hebt:

```bash
# Test 1: Health check
curl http://127.0.0.1:8000/health
# Moet returnen: {"status":"ok"}

# Test 2: Windows endpoint
curl -i http://127.0.0.1:8000/api/v1/competencies/windows/
# Status moet zijn: 401 (niet 422!)

# Test 3: Numeric ID
curl -i http://127.0.0.1:8000/api/v1/competencies/123
# Status moet zijn: 401 of 404 (niet 422!)
```

## Debug Output

Als je de backend start, zou je moeten zien:

```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [XXXXX] using StatReload
INFO:     Started server process [XXXXX]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

Als je andere output ziet (errors, warnings), deel die dan!

## Nog Steeds 422?

Als je na al deze stappen NOG STEEDS 422 krijgt:

1. **Deel de exacte Request URL uit de browser DevTools**
2. **Deel de backend startup logs**
3. **Deel de output van:**
   ```bash
   curl -v http://127.0.0.1:8000/api/v1/competencies/windows/
   ```

Dan kunnen we verder debuggen!
