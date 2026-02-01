# ⚠️ JE BACKEND DRAAIT OUDE CODE

## Het Probleem

Je backend is **actief** (health check werkt ✓), maar gebruikt nog de **OUDE route volgorde**.

```bash
$ curl http://127.0.0.1:8000/health
{"status":"ok"}  # ✓ Backend draait

# MAAR:
$ curl http://127.0.0.1:8000/api/v1/competencies/windows/
HTTP 422  # ✗ Nog steeds oude code!
```

## Waarom Gebeurt Dit?

Je backend process is gestart **VOOR** je de nieuwe code hebt gepulled/gecheckout. FastAPI registreert routes bij het opstarten, dus de oude route volgorde zit nog in het geheugen.

## OPLOSSING: Herstart Backend Met Nieuwe Code

### Stap 1: Stop Huidige Backend

Ga naar de terminal waar uvicorn draait en druk **Ctrl+C**

OF gebruik:
```bash
pkill -f uvicorn
```

### Stap 2: Zorg Dat Je Op De Juiste Branch Zit

```bash
cd ~/projects/team-evaluatie-app
git branch --show-current
# Moet zijn: copilot/fix-routing-issue-windows

# Als je op een andere branch zit:
git checkout copilot/fix-routing-issue-windows
git pull origin copilot/fix-routing-issue-windows
```

### Stap 3: Clear Python Cache ⚠️ BELANGRIJK

Python cached de oude bytecode. Clear deze:

```bash
cd ~/projects/team-evaluatie-app/backend

# Remove all __pycache__ directories
find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null

# Remove all .pyc files
find . -type f -name '*.pyc' -delete

echo "Python cache cleared!"
```

### Stap 4: Herstart Backend

```bash
cd ~/projects/team-evaluatie-app/backend

# Activate virtual environment (if you have one)
source venv/bin/activate

# Start backend with explicit reload
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Je zou moeten zien:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [XXXXX] using StatReload
INFO:     Started server process [XXXXX]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### Stap 5: Test Of Het Werkt

**Open een NIEUWE terminal** (laat de backend draaien):

```bash
# Test 1: Health check
curl http://127.0.0.1:8000/health
# Verwacht: {"status":"ok"}

# Test 2: Windows endpoint (DE BELANGRIJKSTE TEST)
curl -i http://127.0.0.1:8000/api/v1/competencies/windows/
# Verwacht: HTTP 401 Unauthorized (NIET 422!)

# Test 3: Numeric ID
curl -i http://127.0.0.1:8000/api/v1/competencies/123
# Verwacht: HTTP 401 of 404
```

**Als je 401 krijgt:** ✅ **DE FIX WERKT!**
- 401 = route wordt correct gematcht, je hebt alleen geen auth
- De 422 error is weg!

**Als je nog steeds 422 krijgt:** ❌ Er is iets mis gegaan
- Check of je echt op de juiste branch zit
- Check of Python cache echt gecleared is
- Check of er geen andere backend process nog draait

### Stap 6: Test In Browser

1. **Refresh je browser** (hard refresh: Ctrl+Shift+R)
2. **Navigeer naar de competencies page**
3. **Check de console** - geen 422 errors meer!

## Verificatie

Na het herstarten zou je dit moeten zien in de backend logs wanneer een request komt:

```
INFO:     127.0.0.1:XXXXX - "GET /api/v1/competencies/windows/ HTTP/1.1" 401 Unauthorized
```

**401 is GOED!** Dit betekent:
- Route wordt correct gematcht naar `/windows/`
- Je hebt alleen geen authentication
- De fix werkt! ✅

## Troubleshooting

### "Port already in use"
Er draait nog een backend process:
```bash
# Find the process
lsof -i :8000

# Kill it
kill -9 <PID>
```

### "Module not found" errors
Installeer dependencies opnieuw:
```bash
cd ~/projects/team-evaluatie-app/backend
pip install -r requirements.txt
```

### Backend crashed bij startup
Check de error logs en zorg dat:
- Database is accessible (PostgreSQL draait)
- Redis is accessible (of niet vereist)
- Alle environment variables zijn gezet

### Nog steeds 422 na herstart?
Verifieer dat de code daadwerkelijk is geüpdatet:
```bash
cd ~/projects/team-evaluatie-app/backend
grep -n '@router.get("/windows/"' app/api/v1/routers/competencies.py | head -1
# Moet returnen: 617:@router.get("/windows/", response_model=List[CompetencyWindowOut])

grep -n '@router.get("/{competency_id}"' app/api/v1/routers/competencies.py | head -1
# Moet returnen: 756:@router.get("/{competency_id}", response_model=CompetencyOut)
```

Als lijn 617 `/windows/` heeft en lijn 756 `/{competency_id}` heeft: **Code is correct!**

Als de nummers anders zijn: Je hebt mogelijk de verkeerde code. Doe `git pull` opnieuw.

## Samenvatting

✅ **De code fix is correct en compleet**
✅ **Alle tests passen**
❌ **Jouw backend moet herstarten om de nieuwe code te laden**

**Volg de stappen hierboven en het werkt!** 🚀
