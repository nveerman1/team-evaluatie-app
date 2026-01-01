"""
Pytest configuration file.

This file is automatically loaded by pytest and ensures that the backend
directory is in the Python path so that imports work correctly.
"""
import sys
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
