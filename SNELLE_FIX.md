# 🎯 SNELLE OPLOSSING VOOR JOUW 422 ERROR

## Situatie ✅ Begrepen

Je backend **draait WEL** op je laptop:
```bash
nveerman@LaptopNick:~/projects/team-evaluatie-app$ curl http://127.0.0.1:8000/health
{"status":"ok"}
```

Maar je krijgt nog steeds 422 bij `/competencies/windows`:
```
:3000/api/v1/competencies/windows:1 Failed to load resource: 422
```

## Probleem 🔍

Je backend process gebruikt de **OUDE code** (van voor de fix).

## Oplossing 🚀 (3 minuten)

### Open een terminal op je laptop:

```bash
# 1. Stop backend
pkill -f uvicorn

# 2. Ga naar project directory
cd ~/projects/team-evaluatie-app/backend

# 3. Clear Python cache (BELANGRIJK!)
find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null
find . -type f -name '*.pyc' -delete

# 4. Herstart backend
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Test of het werkt (nieuwe terminal):

```bash
curl -i http://127.0.0.1:8000/api/v1/competencies/windows/
```

**Verwacht:** `HTTP/1.1 401 Unauthorized` (NIET 422!)

### In je browser:

1. Hard refresh: **Ctrl+Shift+R** (of Cmd+Shift+R op Mac)
2. Ga naar de competencies page
3. ✅ **Geen 422 error meer!**

## Uitleg

FastAPI registreert routes bij startup. Jouw backend:
- Startte met de OUDE code (verkeerde route volgorde)
- Heeft die volgorde in geheugen
- Python cached ook de oude bytecode

Door te herstarten + cache te clearen laadt het de NIEUWE route volgorde!

## Hulp Nodig?

Zie `GEBRUIKER_INSTRUCTIES.md` voor uitgebreide stappen en troubleshooting.

---

**TL;DR: Stop backend, clear cache, herstart → Werkt! 🎉**
