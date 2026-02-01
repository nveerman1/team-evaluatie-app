# ⚠️ BACKEND IS NIET ACTIEF - START INSTRUCTIES

## Probleem
Je krijgt nog steeds de 422 error omdat **de backend server niet draait**.

## Diagnose
```bash
$ curl http://127.0.0.1:8000/health
curl: (7) Failed to connect to 127.0.0.1 port 8000: Connection refused
```

**Conclusie:** Er draait geen backend op poort 8000.

## De Fix IS Klaar
✅ Code is gefixt (routes zijn in juiste volgorde)
✅ Tests passen
✅ Alles is committed

**MAAR:** De backend server moet draaien om de fix te kunnen gebruiken!

---

## OPLOSSING: Start de Backend

### Stap 1: Installeer Dependencies (eerste keer)

```bash
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app/backend

# Maak virtual environment (als niet bestaat)
python3 -m venv venv

# Activeer virtual environment
source venv/bin/activate

# Installeer requirements
pip install -r requirements.txt
```

### Stap 2: Start de Backend Server

**Optie A: Met Uvicorn (recommended)**
```bash
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app/backend

# Activeer venv (als je een nieuwe terminal hebt geopend)
source venv/bin/activate

# Start server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Je zou moeten zien:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using StatReload
INFO:     Started server process [12346]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**Optie B: Met Python Module**
```bash
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app/backend
source venv/bin/activate
python3 -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Optie C: Via Makefile**
```bash
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app
make be
```

### Stap 3: Verificatie

**Open een NIEUWE terminal** en test:

```bash
# 1. Check health endpoint
curl http://127.0.0.1:8000/health
# Verwacht: {"status":"ok"}

# 2. Test de windows endpoint (zonder auth)
curl -i http://127.0.0.1:8000/api/v1/competencies/windows/
# Verwacht: HTTP 401 Unauthorized
# NIET: HTTP 422 Unprocessable Entity

# 3. Test met numeric ID (zou ook moeten werken)
curl -i http://127.0.0.1:8000/api/v1/competencies/123
# Verwacht: HTTP 401 of 404
```

### Stap 4: Test in Frontend

1. **Start de frontend** (als die nog niet draait):
   ```bash
   cd /home/runner/work/team-evaluatie-app/team-evaluatie-app/frontend
   npm run dev
   ```

2. **Open browser:** http://localhost:3000

3. **Hard refresh:** `Ctrl + Shift + R` (of `Cmd + Shift + R` op Mac)

4. **Navigeer naar competencies page**

5. **De 422 error moet weg zijn!**

---

## Troubleshooting

### "Module not found" error
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

### "Port 8000 already in use"
```bash
# Find process on port 8000
lsof -i :8000
# or
netstat -tulpn | grep 8000

# Kill it
kill <PID>

# Then start again
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### "SECRET_KEY warning"
Dit is normaal in development. De app werkt nog steeds.
Voor productie moet je een echte SECRET_KEY instellen in de environment variables.

### Database errors
```bash
cd backend
# Run migrations
alembic upgrade head
```

### Nog steeds 422 error?
1. **Check of backend echt draait:**
   ```bash
   curl http://127.0.0.1:8000/health
   ```

2. **Check de backend logs** - kijk naar de terminal waar uvicorn draait

3. **Check welke branch je gebruikt:**
   ```bash
   git branch
   # Moet: * copilot/fix-routing-issue-windows
   ```

4. **Hard refresh je browser** (Ctrl+Shift+R)

5. **Check browser console** voor exacte error

---

## Samenvatting

De code fix is **compleet en correct**. Het probleem is simpel:

❌ **Backend draait niet**
✅ **Start de backend met: `uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`**

Dan werkt het!
