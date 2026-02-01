#!/usr/bin/env python3
"""
Verification script for the competencies routing fix.

This script verifies that the /windows/ routes are registered before
/{competency_id} in the FastAPI router to prevent routing conflicts.

Run this script to verify the fix is working:
    python3 scripts/verify_competencies_routing.py
"""

import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.api.v1.routers import competencies


def verify_route_order():
    """Verify that /windows/ routes come before /{competency_id}"""
    
    routes = [r for r in competencies.router.routes if hasattr(r, 'path')]
    
    print("=" * 70)
    print("COMPETENCIES ROUTING ORDER VERIFICATION")
    print("=" * 70)
    print()
    
    # Find relevant routes
    windows_indices = []
    competency_id_indices = []
    
    print("Relevant routes (in order):")
    print("-" * 70)
    for i, route in enumerate(routes):
        if 'windows' in route.path or '{competency_id}' in route.path:
            methods = ','.join(route.methods)
            print(f"  {i:2d}. {route.path:50s} [{methods}]")
            
            if '/windows' in route.path:
                windows_indices.append(i)
            if '{competency_id}' in route.path:
                competency_id_indices.append(i)
    
    print()
    print("-" * 70)
    
    # Verify basic windows routes come before competency_id
    basic_windows_index = min(windows_indices) if windows_indices else None
    first_competency_id_index = min(competency_id_indices) if competency_id_indices else None
    
    if basic_windows_index is None:
        print("❌ ERROR: /windows/ route not found!")
        return False
    
    if first_competency_id_index is None:
        print("❌ ERROR: /{competency_id} route not found!")
        return False
    
    if basic_windows_index < first_competency_id_index:
        print("✓ SUCCESS: /windows/ routes come before /{competency_id}")
        print(f"  - First /windows/ route at index: {basic_windows_index}")
        print(f"  - First /{{competency_id}} route at index: {first_competency_id_index}")
        print()
        print("This ensures that GET /api/v1/competencies/windows will not be")
        print("mistakenly matched as /{competency_id} with 'windows' as the ID.")
        return True
    else:
        print("❌ ERROR: Route order is incorrect!")
        print(f"  - First /windows/ route at index: {basic_windows_index}")
        print(f"  - First /{{competency_id}} route at index: {first_competency_id_index}")
        print()
        print("The /{competency_id} route will match 'windows' before reaching")
        print("the /windows/ endpoint, causing a 422 validation error.")
        return False


if __name__ == "__main__":
    try:
        success = verify_route_order()
        print()
        print("=" * 70)
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
