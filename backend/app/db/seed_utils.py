"""
Seed Utilities - Helpers for Database Seeding

Provides:
- DeterministicRandom: Seeded random number generator
- TimestampGenerator: Generate realistic timestamps over last 8 weeks
- UpsertHelper: Safe upsert operations with unique constraints
- DataFactory: Generate realistic test data
"""

from __future__ import annotations
import random
from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Dict, List, Type, TypeVar
from sqlalchemy.orm import Session
from sqlalchemy import select

T = TypeVar('T')


class DeterministicRandom:
    """Wrapper around random with deterministic seeding"""
    
    def __init__(self, seed: Optional[int] = None):
        self.seed = seed if seed is not None else 42
        self._rng = random.Random(self.seed)
    
    def reset(self):
        """Reset the random generator to initial seed"""
        self._rng = random.Random(self.seed)
    
    def randint(self, a: int, b: int) -> int:
        """Return random integer in range [a, b]"""
        return self._rng.randint(a, b)
    
    def uniform(self, a: float, b: float) -> float:
        """Return random float in range [a, b)"""
        return self._rng.uniform(a, b)
    
    def choice(self, seq: List[Any]) -> Any:
        """Choose random element from sequence"""
        return self._rng.choice(seq)
    
    def choices(self, population: List[Any], k: int) -> List[Any]:
        """Choose k elements from population with replacement"""
        return self._rng.choices(population, k=k)
    
    def sample(self, population: List[Any], k: int) -> List[Any]:
        """Choose k unique elements from population without replacement"""
        return self._rng.sample(population, k=k)
    
    def shuffle(self, seq: List[Any]) -> None:
        """Shuffle sequence in-place"""
        self._rng.shuffle(seq)
    
    def random(self) -> float:
        """Return random float in [0.0, 1.0)"""
        return self._rng.random()


class TimestampGenerator:
    """Generate realistic timestamps spread over last N weeks"""
    
    def __init__(self, weeks: int = 8, rand: Optional[DeterministicRandom] = None):
        self.weeks = weeks
        self.rand = rand if rand is not None else DeterministicRandom()
        self.now = datetime.now(timezone.utc)
        self.start = self.now - timedelta(weeks=weeks)
    
    def random_timestamp(self, days_ago_min: int = 0, days_ago_max: Optional[int] = None) -> datetime:
        """Generate random timestamp within specified day range"""
        if days_ago_max is None:
            days_ago_max = self.weeks * 7
        
        # Calculate timestamp range
        max_ts = self.now - timedelta(days=days_ago_min)
        min_ts = self.now - timedelta(days=days_ago_max)
        
        # Generate random timestamp
        delta_seconds = (max_ts - min_ts).total_seconds()
        random_seconds = self.rand.random() * delta_seconds
        return min_ts + timedelta(seconds=random_seconds)
    
    def timestamp_sequence(self, count: int, days_ago_min: int = 0, days_ago_max: Optional[int] = None) -> List[datetime]:
        """Generate sequence of increasing timestamps"""
        if days_ago_max is None:
            days_ago_max = self.weeks * 7
        
        timestamps = []
        for i in range(count):
            # Spread timestamps evenly with some randomness
            progress = i / max(count - 1, 1)
            days_ago = days_ago_max - (progress * (days_ago_max - days_ago_min))
            jitter = self.rand.uniform(-0.5, 0.5)  # Add random jitter
            days_ago = max(days_ago_min, min(days_ago_max, days_ago + jitter))
            
            ts = self.now - timedelta(days=days_ago)
            timestamps.append(ts)
        
        return sorted(timestamps)
    
    def recent_timestamp(self, days_ago_max: int = 7) -> datetime:
        """Generate recent timestamp within last N days"""
        return self.random_timestamp(days_ago_min=0, days_ago_max=days_ago_max)


class UpsertHelper:
    """Helper for safe upsert operations"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_or_create(
        self,
        model_class: Type[T],
        lookup_fields: Dict[str, Any],
        create_fields: Optional[Dict[str, Any]] = None
    ) -> tuple[T, bool]:
        """
        Get existing record or create new one
        
        Args:
            model_class: SQLAlchemy model class
            lookup_fields: Fields to search for existing record
            create_fields: Additional fields to set when creating (optional)
        
        Returns:
            Tuple of (instance, created) where created is True if new record
        """
        # Try to find existing
        stmt = select(model_class)
        for key, value in lookup_fields.items():
            stmt = stmt.where(getattr(model_class, key) == value)
        
        existing = self.db.execute(stmt).scalar_one_or_none()
        
        if existing:
            return existing, False
        
        # Create new
        fields = {**lookup_fields}
        if create_fields:
            fields.update(create_fields)
        
        instance = model_class(**fields)
        self.db.add(instance)
        return instance, True
    
    def upsert(
        self,
        model_class: Type[T],
        lookup_fields: Dict[str, Any],
        update_fields: Optional[Dict[str, Any]] = None
    ) -> T:
        """
        Update existing record or create new one
        
        Args:
            model_class: SQLAlchemy model class
            lookup_fields: Fields to search for existing record
            update_fields: Fields to update/set
        
        Returns:
            The instance (existing or new)
        """
        instance, created = self.get_or_create(model_class, lookup_fields)
        
        if not created and update_fields:
            for key, value in update_fields.items():
                setattr(instance, key, value)
        elif created and update_fields:
            for key, value in update_fields.items():
                setattr(instance, key, value)
        
        return instance


class DataFactory:
    """Generate realistic test data"""
    
    def __init__(self, rand: Optional[DeterministicRandom] = None):
        self.rand = rand if rand is not None else DeterministicRandom()
    
    def student_name(self) -> str:
        """Generate Dutch student name"""
        first_names = [
            "Emma", "Sophie", "Julia", "Anna", "Lisa", "Fleur", "Eva", "Mila", "Saar", "Lotte",
            "Daan", "Lucas", "Sem", "Finn", "Luuk", "Lars", "Bram", "Tim", "Tom", "Thijs",
            "Noah", "Levi", "Max", "Sam", "Jesse", "Milan", "Stijn", "Ruben", "Nick", "Jasper"
        ]
        last_names = [
            "de Jong", "Jansen", "de Vries", "van den Berg", "van Dijk", "Bakker", "Janssen",
            "Visser", "Smit", "Meijer", "de Boer", "Mulder", "de Groot", "Bos", "Vos",
            "Peters", "Hendriks", "van Leeuwen", "Dekker", "Brouwer", "de Wit", "Dijkstra",
            "Smits", "de Graaf", "van der Meer", "van der Linden", "Kok", "Jacobs"
        ]
        return f"{self.rand.choice(first_names)} {self.rand.choice(last_names)}"
    
    def teacher_name(self) -> str:
        """Generate Dutch teacher name"""
        titles = ["Dhr.", "Mevr."]
        last_names = [
            "Vermeulen", "Scholten", "de Haan", "van Beek", "Willems", "van Vliet",
            "Hoekstra", "Maas", "Verhoeven", "Koster", "van Dam", "Prins", "Blom"
        ]
        return f"{self.rand.choice(titles)} {self.rand.choice(last_names)}"
    
    def email(self, name: str, domain: str = "school.nl") -> str:
        """Generate email from name"""
        # Remove titles and dots
        clean_name = name.replace("Dhr. ", "").replace("Mevr. ", "").replace(".", "")
        parts = clean_name.lower().split()
        
        # Use first letter of first name + last name
        if len(parts) >= 2:
            username = f"{parts[0][0]}{parts[-1]}"
        else:
            username = parts[0]
        
        # Remove spaces and special chars
        username = username.replace(" ", "").replace("'", "")
        
        return f"{username}@{domain}"
    
    def project_title(self) -> str:
        """Generate project title"""
        themes = [
            "Duurzame Energie", "Smart City", "Gezonde School", "Circulaire Economie",
            "Robotica", "Virtual Reality", "Klimaatverandering", "Waterbeheer",
            "Mobiliteit van de Toekomst", "Kunstmatige Intelligentie", "3D Printen",
            "Groene Gebouwen", "Voedselproductie", "Afvalverwerking"
        ]
        return self.rand.choice(themes)
    
    def team_name(self, team_number: int) -> str:
        """Generate team name"""
        names = [
            "Team Alpha", "Team Beta", "Team Gamma", "Team Delta", "Team Epsilon",
            "Team Zeta"
        ]
        if team_number <= len(names):
            return names[team_number - 1]
        return f"Team {team_number}"
    
    def rubric_title(self, scope: str = "peer") -> str:
        """Generate rubric title"""
        if scope == "peer":
            titles = [
                "Peer Evaluatie - Samenwerking", "Peer Evaluatie - Teamrollen",
                "Peer Evaluatie - Communicatie", "OMZA Peer Rubric"
            ]
        else:
            titles = [
                "Project Beoordeling - Proces", "Project Beoordeling - Resultaat",
                "Project Beoordeling - Presentatie", "Eindproject Rubric"
            ]
        return self.rand.choice(titles)
    
    def criterion_name(self, category: str = "generic") -> str:
        """Generate criterion name"""
        peer_criteria = {
            "Organiseren": ["Planning", "Structuur", "Tijdmanagement", "Overzicht"],
            "Meedoen": ["Participatie", "Betrokkenheid", "Initiatief", "Inzet"],
            "Zelfvertrouwen": ["Presentatie", "Feedback geven", "Standpunt innemen", "Besluitvorming"],
            "Autonomie": ["Zelfsturing", "Verantwoordelijkheid", "Probleemoplossing", "Leervermogen"]
        }
        
        project_criteria = {
            "projectproces": ["Onderzoek", "Iteratie", "Planning", "Samenwerking"],
            "eindresultaat": ["Functionaliteit", "Kwaliteit", "Innovatie", "Documentatie"],
            "communicatie": ["Presentatie", "Verantwoording", "Reflectie", "Feedback verwerken"]
        }
        
        if category in peer_criteria:
            return self.rand.choice(peer_criteria[category])
        elif category in project_criteria:
            return self.rand.choice(project_criteria[category])
        else:
            return f"Criterium {self.rand.randint(1, 10)}"
    
    def feedback_comment(self, positive: bool = True) -> str:
        """Generate feedback comment"""
        if positive:
            comments = [
                "Goede bijdrage aan het team, blijft positief en helpt anderen.",
                "Neemt initiatief en komt met creatieve oplossingen.",
                "Communiceert duidelijk en luistert goed naar anderen.",
                "Werkt gestructureerd en houdt goed overzicht over taken.",
                "Denkt mee over het proces en stelt verbeteringen voor.",
                "Toont inzet en doorzettingsvermogen, ook bij tegenslagen.",
            ]
        else:
            comments = [
                "Zou actiever kunnen deelnemen aan teamoverleggen.",
                "Deadlines worden niet altijd gehaald, meer planning nodig.",
                "Communicatie kan directer en duidelijker.",
                "Zou meer initiatief kunnen tonen bij problemen.",
                "Feedback accepteren kan beter, verdedigend bij kritiek.",
                "Taken blijven soms liggen, meer verantwoordelijkheid nemen.",
            ]
        return self.rand.choice(comments)
    
    def reflection_text(self) -> str:
        """Generate reflection text"""
        templates = [
            "Deze evaluatie heeft me geholpen om bewuster te worden van mijn rol in het team. "
            "Ik realiseer me dat ik sterker ben in organisatie dan ik dacht, maar dat ik nog kan groeien "
            "in het delen van mijn ideeën tijdens teamoverleggen.",
            
            "Het was interessant om te zien hoe mijn teamgenoten mijn bijdrage waarderen. "
            "De feedback over mijn communicatie neem ik ter harte. Ik ga proberen om vaker "
            "mijn mening te geven en niet af te wachten wat anderen zeggen.",
            
            "Ik ben blij met de positieve feedback over mijn inzet en probleemoplossend vermogen. "
            "Het punt over planning is terecht - ik moet beter vooruitkijken en niet alles op het laatste moment doen. "
            "Volgende keer ga ik een duidelijker planning maken en die ook bijhouden.",
        ]
        return self.rand.choice(templates)
    
    def competency_goal(self) -> str:
        """Generate competency goal text"""
        goals = [
            "Ik wil actiever deelnemen aan teamoverleggen en vaker mijn mening delen.",
            "Mijn doel is om beter te plannen en deadlines consequent te halen.",
            "Ik ga werken aan duidelijker communiceren met teamleden en docenten.",
            "Ik wil meer initiatief tonen bij het oplossen van problemen.",
            "Mijn doel is om constructiever om te gaan met feedback van anderen.",
            "Ik ga werken aan mijn presentatievaardigheden en zelfvertrouwen.",
        ]
        return self.rand.choice(goals)
    
    def project_description(self, title: str) -> str:
        """Generate project description"""
        return (
            f"In dit project werken studenten in teams aan {title}. "
            f"Ze doorlopen het volledige ontwerpproces: onderzoek, ontwerp, prototyping en testen. "
            f"Het eindresultaat wordt gepresenteerd aan opdrachtgevers en medestudenten."
        )
    
    def client_organization(self) -> str:
        """Generate client organization name"""
        types = ["Gemeente", "Stichting", "Bedrijf", "Vereniging", "School"]
        names = [
            "Groen", "Energie", "Zorg", "Sport", "Cultuur", "Techniek",
            "Innovatie", "Duurzaamheid", "Jeugd", "Ouderen"
        ]
        return f"{self.rand.choice(types)} {self.rand.choice(names)}"
