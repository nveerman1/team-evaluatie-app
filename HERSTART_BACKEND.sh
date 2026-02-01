#!/bin/bash
# HERSTART SCRIPT VOOR GEBRUIKER
# Dit script moet op je LAPTOP gedraaid worden, niet op de GitHub runner

echo "=========================================="
echo "BACKEND HERSTART MET NIEUWE CODE"
echo "=========================================="
echo ""

echo "Je backend draait momenteel OUDE code!"
echo "Daarom krijg je nog steeds 422 errors."
echo ""
echo "Volg deze stappen:"
echo ""

echo "1. Stop je huidige backend process"
echo "   Druk Ctrl+C in de terminal waar uvicorn draait"
echo "   OF gebruik: pkill -f uvicorn"
echo ""

echo "2. Zorg dat je op de juiste branch zit:"
echo "   cd ~/projects/team-evaluatie-app"
echo "   git checkout copilot/fix-routing-issue-windows"
echo "   git pull origin copilot/fix-routing-issue-windows"
echo ""

echo "3. Clear Python cache (BELANGRIJK!):"
echo "   cd backend"
echo "   find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null"
echo "   find . -type f -name '*.pyc' -delete"
echo ""

echo "4. Herstart de backend:"
echo "   cd ~/projects/team-evaluatie-app/backend"
echo "   source venv/bin/activate  # als je een venv hebt"
echo "   python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo ""

echo "5. Test of het werkt:"
echo "   In een nieuwe terminal:"
echo "   curl -i http://127.0.0.1:8000/api/v1/competencies/windows/"
echo "   Verwacht: HTTP 401 (NIET 422!)"
echo ""

echo "=========================================="
echo "WAAROM IS DIT NODIG?"
echo "=========================================="
echo ""
echo "De code in je repository is correct:"
echo "  - Lijn 617: /windows/ route"
echo "  - Lijn 756: /{competency_id} route"
echo ""
echo "MAAR je backend process gebruikt nog de oude route volgorde"
echo "omdat het process gestart is VOOR je de nieuwe code hebt gepulled."
echo ""
echo "Door de backend te herstarten laadt Python de nieuwe route volgorde!"
echo ""
