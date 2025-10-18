# app/db_shell.py
import os
import sys

# Zorg dat 'backend/' (de map die 'app/' bevat) op sys.path staat
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + "/.."))

from app.infra.db.session import SessionLocal

db = SessionLocal()
print("✅ DB connected. Variabelen: db, en alle modellen uit app.infra.db.models.")
