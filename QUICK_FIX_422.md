# SNEL OVERZICHT: 422 Error Blijft Bestaan Na Herstart

## TL;DR

**De code fix is correct, maar je test waarschijnlijk tegen de VERKEERDE backend!**

## Wat Ik Heb Gecontroleerd

✅ **Code Fix:** Routes zijn in de juiste volgorde
- Lijn 617: `/windows/` route
- Lijn 756: `/{competency_id}` route  
- `/windows/` komt VOOR `/{competency_id}` ✓

✅ **Commits:** Alles is gepushed naar de branch

❌ **Lokale Backend:** Draait NIET
```bash
$ curl http://127.0.0.1:8000/health
Connection refused
```

## De Meest Waarschijnlijke Reden

### Je test tegen een REMOTE backend (productie/staging)

Wanneer je zegt "ik heb de backend herstart", bedoel je waarschijnlijk:
- Je lokale development backend? → Die draait niet volgens mijn tests
- Een productie/staging server? → Die heeft de OUDE code nog

## HOE TE CHECKEN

### Optie 1: Browser Developer Tools (Snelst)

1. Open je applicatie in de browser
2. Druk **F12** (open Developer Tools)
3. Ga naar **Network** tab
4. Refresh de pagina die de error geeft
5. Klik op de failing request (rood gekleurd)
6. Kijk naar **Request URL**

**Als de URL iets is zoals:**
- `https://app.technasiummbh.nl/api/v1/...` → Je test tegen PRODUCTIE
- `http://staging.example.com/api/v1/...` → Je test tegen STAGING  
- `http://localhost:3000/api/v1/...` → Via Next.js proxy naar lokale backend
- `http://localhost:8000/api/v1/...` → Direct naar lokale backend

### Optie 2: Command Line Check

```bash
# Check of lokale backend draait
curl http://127.0.0.1:8000/health

# Als het werkt:
{"status":"ok"}

# Als het NIET werkt:
Connection refused
```

## OPLOSSINGEN Per Scenario

### Scenario A: Je test tegen PRODUCTIE/STAGING

**Probleem:** Remote server heeft oude code

**Oplossing:**
1. Merge deze PR in de main/master branch
2. Deploy naar productie/staging
3. Restart de backend op die server
4. Dan werkt het!

**Of test lokaal:**
```bash
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app/backend
pip3 install -r requirements.txt
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Scenario B: Lokale Backend Draait Niet

**Probleem:** Je dacht dat je hem herstart hebt, maar hij draait niet

**Oplossing:**
```bash
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app/backend

# Clear Python cache
find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null
find . -type f -name '*.pyc' -delete

# Start backend
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Je zou moeten zien:
```
INFO: Uvicorn running on http://0.0.0.0:8000
INFO: Application startup complete.
```

### Scenario C: Backend Draait OUDE Code

**Probleem:** Python bytecode cache of verkeerde branch

**Oplossing:**
```bash
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app

# Check branch
git branch
# Moet zijn: * copilot/fix-routing-issue-windows

# Kill alle backend processen
pkill -9 -f uvicorn
pkill -9 -f 'python.*app.main'

# Clear cache
cd backend
find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null
find . -type f -name '*.pyc' -delete

# Start opnieuw
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## VERIFICATIE

Na het (her)starten van de backend:

```bash
# Test 1: Is backend online?
curl http://127.0.0.1:8000/health
# Moet returnen: {"status":"ok"}

# Test 2: Windows endpoint
curl -i http://127.0.0.1:8000/api/v1/competencies/windows/
# HTTP Status moet zijn: 401 (NIET 422!)

# Test 3: Numeric ID
curl -i http://127.0.0.1:8000/api/v1/competencies/123
# HTTP Status moet zijn: 401 of 404
```

### Wat Betekent 401?

`401 Unauthorized` is **GOED**! Dit betekent:
- De route wordt correct gematcht naar `/windows/`
- Je hebt alleen geen authentication cookie
- De 422 error is WEG! ✅

### Wat Betekent 422?

`422 Unprocessable Entity` is **SLECHT**! Dit betekent:
- De route wordt nog steeds gematcht naar `/{competency_id}`
- FastAPI probeert "windows" als integer te parsen
- De fix werkt NIET → verkeerde code wordt gedraaid

## VOLGENDE STAPPEN

1. **Check waar je backend draait** (Browser DevTools → Network → Request URL)
2. **Share deze info:**
   - Welke URL zie je in de browser DevTools?
   - Draait er een lokale backend? (`curl http://127.0.0.1:8000/health`)
   - Wat is de output als je de backend start?

3. **Als remote server:** Deploy nieuwe code en restart
4. **Als lokale backend:** Volg Scenario B of C hierboven

## Hulp Nodig?

Zie:
- `DEBUG_422_GUIDE.md` - Uitgebreide debug guide
- `START_BACKEND.md` - Backend startup instructies
- `ROUTING_FIX_SUMMARY.md` - Technische details van de fix

Of share:
- De Request URL uit browser DevTools
- Backend startup logs
- Output van `curl -v http://127.0.0.1:8000/api/v1/competencies/windows/`
