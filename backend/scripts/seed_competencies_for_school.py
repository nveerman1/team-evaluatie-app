"""
Helper script to seed competencies for a specific school.
Used when a school is created after the competency seed migration has run.

Usage:
    python scripts/seed_competencies_for_school.py [school_id]
"""

import sys
import os
import json
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.infra.db.session import SessionLocal
from app.infra.db.models import Competency, CompetencyCategory, CompetencyRubricLevel, School


def seed_competencies_for_school(school_id=1):
    """Seed competencies for a specific school"""
    db = SessionLocal()
    
    try:
        # Load competencies template
        base_dir = Path(__file__).resolve().parents[1]
        path = base_dir / 'data' / 'templates' / 'competencies.json'
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        categories_data = data.get('categories', [])
        competencies_data = data.get('competencies', [])
        
        # Get school
        school = db.query(School).filter(School.id == school_id).first()
        if not school:
            print(f'❌ School with ID {school_id} not found')
            return
        
        print(f'✓ Loading competencies for {school.name}...')
        
        # Default labels
        default_scale_labels = {
            '1': 'Beginner',
            '2': 'Ontwikkelend',
            '3': 'Competent',
            '4': 'Gevorderd',
            '5': 'Expert',
        }
        
        # Create categories
        category_map = {}
        for cat in categories_data:
            category = CompetencyCategory(
                school_id=school.id,
                name=cat['name'],
                description=cat.get('description', '') or '',
                color=cat.get('color'),
                icon=cat.get('icon'),
                order_index=cat.get('order_index', 0),
            )
            db.add(category)
            db.flush()
            category_map[cat['key']] = category.id
            print(f'  ✓ Created category: {cat["name"]}')
        
        # Create competencies
        for comp in competencies_data:
            category_id = category_map.get(comp['category_key'])
            
            competency = Competency(
                school_id=school.id,
                category_id=category_id,
                subject_id=comp.get('subject_id', 1),
                teacher_id=None,
                course_id=None,
                is_template=True,
                phase=comp.get('phase'),
                name=comp['name'],
                description=comp.get('description', '') or '',
                order=comp.get('order', 0),
                active=True,
                scale_min=1,
                scale_max=5,
                scale_labels=default_scale_labels,
                metadata_json={'code': comp.get('code')},
            )
            db.add(competency)
            db.flush()
            
            # Add rubric levels
            levels = comp.get('levels', {})
            for level_str, desc in levels.items():
                level = int(level_str)
                label = default_scale_labels.get(level_str, f'Level {level}')
                
                rubric_level = CompetencyRubricLevel(
                    school_id=school.id,
                    competency_id=competency.id,
                    level=level,
                    label=label,
                    description=desc,
                )
                db.add(rubric_level)
        
        db.commit()
        count = db.query(Competency).filter(Competency.school_id == school.id).count()
        print(f'✓ Successfully created {count} competencies for school {school.name}')
        
    except Exception as e:
        print(f'❌ Error: {e}')
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    school_id = 1
    if len(sys.argv) > 1:
        try:
            school_id = int(sys.argv[1])
        except ValueError:
            print(f"❌ Error: Invalid school_id '{sys.argv[1]}'. Please provide a valid integer.")
            sys.exit(1)
    
    seed_competencies_for_school(school_id)
