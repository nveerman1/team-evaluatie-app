"""
Reminder generation service for client communications
"""

from __future__ import annotations
from typing import List, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.infra.db.models import Client, ClientProjectLink, Project, ProjectAssessment, Group


class ReminderService:
    """
    Service for generating reminders based on project phases and deadlines
    """

    @staticmethod
    def generate_reminders(
        db: Session, school_id: int, days_ahead: int = 14
    ) -> List[Dict[str, Any]]:
        """
        Generate upcoming reminders for client communications
        
        Args:
            db: Database session
            school_id: School ID to filter by
            days_ahead: How many days ahead to look for reminders
            
        Returns:
            List of reminder dictionaries
        """
        reminders = []
        now = datetime.now()
        future_date = now + timedelta(days=days_ahead)

        # Get all active client project links
        project_links = (
            db.query(ClientProjectLink)
            .join(Project)
            .join(Client)
            .filter(
                Client.school_id == school_id,
                Client.active.is_(True),
            )
            .all()
        )

        for link in project_links:
            # Note: ClientProjectLink now links to Project, not ProjectAssessment
            # For reminders, we need to find related ProjectAssessment through the project
            # For now, skip links without assessments as reminders are assessment-specific
            project = link.project
            client = link.client
            
            # Try to find a related ProjectAssessment (this is a simplified approach)
            # In reality, a Project can have multiple assessments
            assessment = (
                db.query(ProjectAssessment)
                .join(Group)
                .filter(
                    Group.course_id == project.course_id,
                    ProjectAssessment.status == "published",
                )
                .first()
            )
            
            # Skip if no assessment found
            if not assessment:
                continue

            # Get the group/class name
            group = db.query(Group).filter(Group.id == assessment.group_id).first()
            class_name = group.name if group else "Unknown"

            # Generate reminders based on project version/phase
            version = assessment.version or ""
            
            # Reminder for tussenpresentatie (midterm presentation)
            if "tussen" in version.lower() or version == "midterm":
                # Check if assessment was published recently (within last 2 weeks)
                if assessment.published_at:
                    days_since_publish = (now - assessment.published_at).days
                    if 0 <= days_since_publish <= 14:
                        reminder_date = assessment.published_at + timedelta(days=7)
                        if now <= reminder_date <= future_date:
                            reminders.append({
                                "id": f"reminder-mid-{link.id}",
                                "text": f"Uitnodiging tussenpresentatie versturen aan {client.organization} ({class_name})",
                                "client_name": client.organization,
                                "client_email": client.email,
                                "client_id": client.id,
                                "due_date": reminder_date.strftime("%Y-%m-%d"),
                                "template": "tussenpresentatie",
                                "project_title": assessment.title,
                            })

            # Reminder for eindpresentatie (final presentation)
            elif "eind" in version.lower() or version == "final":
                # Check if assessment was published recently (within last 2 weeks)
                if assessment.published_at:
                    days_since_publish = (now - assessment.published_at).days
                    if 0 <= days_since_publish <= 14:
                        reminder_date = assessment.published_at + timedelta(days=7)
                        if now <= reminder_date <= future_date:
                            reminders.append({
                                "id": f"reminder-final-{link.id}",
                                "text": f"Uitnodiging eindpresentatie versturen aan {client.organization} ({class_name})",
                                "client_name": client.organization,
                                "client_email": client.email,
                                "client_id": client.id,
                                "due_date": reminder_date.strftime("%Y-%m-%d"),
                                "template": "eindpresentatie",
                                "project_title": assessment.title,
                            })
                        
                        # Also add bedankmail reminder (2 weeks after final presentation)
                        bedank_date = assessment.published_at + timedelta(days=21)
                        if now <= bedank_date <= future_date:
                            reminders.append({
                                "id": f"reminder-thanks-{link.id}",
                                "text": f"Bedankmail versturen aan {client.organization} ({class_name})",
                                "client_name": client.organization,
                                "client_email": client.email,
                                "client_id": client.id,
                                "due_date": bedank_date.strftime("%Y-%m-%d"),
                                "template": "bedankmail",
                                "project_title": assessment.title,
                            })

        # Check for clients with projects ending soon (based on end_date)
        ending_soon = (
            db.query(ClientProjectLink)
            .join(Client)
            .filter(
                Client.school_id == school_id,
                Client.active.is_(True),
                ClientProjectLink.end_date.isnot(None),
                ClientProjectLink.end_date >= now,
                ClientProjectLink.end_date <= future_date,
            )
            .all()
        )

        for link in ending_soon:
            client = link.client
            project = link.project
            
            # Only add if not already in reminders
            reminder_id = f"reminder-ending-{link.id}"
            if not any(r["id"] == reminder_id for r in reminders):
                reminders.append({
                    "id": reminder_id,
                    "text": f"Project eindigt binnenkort: {client.organization} - {project.title}",
                    "client_name": client.organization,
                    "client_email": client.email,
                    "client_id": client.id,
                    "due_date": link.end_date.strftime("%Y-%m-%d"),
                    "template": "bedankmail",
                    "project_title": project.title,
                })

        # Sort reminders by due date
        reminders.sort(key=lambda r: r["due_date"])

        return reminders

    @staticmethod
    def get_upcoming_reminders_for_school(
        db: Session, school_id: int
    ) -> List[Dict[str, Any]]:
        """
        Convenience method to get upcoming reminders with default settings
        """
        return ReminderService.generate_reminders(db, school_id, days_ahead=30)
