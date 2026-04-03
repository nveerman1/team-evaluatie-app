"""
Test that all backend Python source files comply with Black formatting.
"""

import subprocess
import sys
from pathlib import Path


def test_black_formatting():
    """Verify that the entire backend source tree passes `black --check`."""
    backend_dir = Path(__file__).resolve().parent.parent
    result = subprocess.run(
        [sys.executable, "-m", "black", "--check", "."],
        cwd=backend_dir,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        "Black formatting check failed. Run `black .` in the backend directory to fix.\n"
        f"{result.stdout}\n{result.stderr}"
    )
