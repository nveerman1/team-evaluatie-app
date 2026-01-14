"""
Task generation service for automatic client tasks (opdrachtgeverstaken)
"""

from __future__ import annotations
from typing import List, Optional
from datetime import timedelta, date
from sqlalchemy.orm import Session

from app.infra.db.models import Task, Project, Client, ClientProjectLink


class TaskGenerationService:
    """
    Service for generating automatic tasks based on project milestones
    """

    @staticmethod
    def generate_presentation_tasks(
        db: Session,
        project: Project,
        tussen_datum: Optional[date] = None,
        eind_datum: Optional[date] = None,
        commit: bool = True,
    ) -> List[Task]:
        """
        Generate automatic tasks for tussenpresentatie and eindpresentatie.
        Tasks are created 21 days (3 weeks) before the presentation dates.

        Args:
            db: Database session
            project: The project to generate tasks for
            tussen_datum: Tussenpresentatie date (optional)
            eind_datum: Eindpresentatie date (optional)
            commit: Whether to commit the changes to the database

        Returns:
            List of created Task objects
        """
        created_tasks = []

        # Get the main client for this project
        main_client_link = (
            db.query(ClientProjectLink)
            .filter(
                ClientProjectLink.project_id == project.id,
                ClientProjectLink.role == "main",
            )
            .first()
        )

        client = None
        client_email = None
        if main_client_link:
            client = (
                db.query(Client).filter(Client.id == main_client_link.client_id).first()
            )
            if client:
                client_email = client.email

        # Generate tussenpresentatie task
        if tussen_datum:
            # Check if auto-generated tussenpresentatie task already exists
            existing_tussen = (
                db.query(Task)
                .filter(
                    Task.project_id == project.id,
                    Task.auto_generated == True,
                    Task.source == "tussenpresentatie",
                )
                .first()
            )

            # Calculate due date: 21 days before tussenpresentatie
            due_date_tussen = tussen_datum - timedelta(days=21)

            if existing_tussen:
                # Update existing task
                existing_tussen.due_date = due_date_tussen
                existing_tussen.title = (
                    f"Tussenpresentatie {project.title} voorbereiden"
                )
                existing_tussen.client_id = client.id if client else None
                existing_tussen.email_to = client_email
                created_tasks.append(existing_tussen)
            else:
                # Create new task
                task_tussen = Task(
                    school_id=project.school_id,
                    title=f"Tussenpresentatie {project.title} voorbereiden",
                    description=f"Contact opnemen met opdrachtgever voor de tussenpresentatie op {tussen_datum.strftime('%d-%m-%Y')}. Bespreken: verwachtingen, stand van zaken, planning.",
                    due_date=due_date_tussen,
                    status="open",
                    type="opdrachtgever",
                    project_id=project.id,
                    client_id=client.id if client else None,
                    class_id=None,
                    auto_generated=True,
                    source="tussenpresentatie",
                    email_to=client_email,
                    email_cc=None,
                )
                db.add(task_tussen)
                created_tasks.append(task_tussen)

        # Generate eindpresentatie task
        if eind_datum:
            # Check if auto-generated eindpresentatie task already exists
            existing_eind = (
                db.query(Task)
                .filter(
                    Task.project_id == project.id,
                    Task.auto_generated == True,
                    Task.source == "eindpresentatie",
                )
                .first()
            )

            # Calculate due date: 21 days before eindpresentatie
            due_date_eind = eind_datum - timedelta(days=21)

            if existing_eind:
                # Update existing task
                existing_eind.due_date = due_date_eind
                existing_eind.title = f"Eindpresentatie {project.title} voorbereiden"
                existing_eind.client_id = client.id if client else None
                existing_eind.email_to = client_email
                created_tasks.append(existing_eind)
            else:
                # Create new task
                task_eind = Task(
                    school_id=project.school_id,
                    title=f"Eindpresentatie {project.title} voorbereiden",
                    description=f"Contact opnemen met opdrachtgever voor de eindpresentatie op {eind_datum.strftime('%d-%m-%Y')}. Bespreken: verwachtingen, eindproduct, beoordeling.",
                    due_date=due_date_eind,
                    status="open",
                    type="opdrachtgever",
                    project_id=project.id,
                    client_id=client.id if client else None,
                    class_id=None,
                    auto_generated=True,
                    source="eindpresentatie",
                    email_to=client_email,
                    email_cc=None,
                )
                db.add(task_eind)
                created_tasks.append(task_eind)

        if commit and created_tasks:
            db.commit()
            for task in created_tasks:
                db.refresh(task)

        return created_tasks

    @staticmethod
    def update_project_tasks(
        db: Session,
        project: Project,
        tussen_datum: Optional[date] = None,
        eind_datum: Optional[date] = None,
        commit: bool = True,
    ) -> List[Task]:
        """
        Update auto-generated tasks when project dates change.
        Only updates auto-generated tasks, leaves manual tasks untouched.

        Args:
            db: Database session
            project: The project to update tasks for
            tussen_datum: New tussenpresentatie date (optional)
            eind_datum: New eindpresentatie date (optional)
            commit: Whether to commit the changes to the database

        Returns:
            List of updated/created Task objects
        """
        return TaskGenerationService.generate_presentation_tasks(
            db=db,
            project=project,
            tussen_datum=tussen_datum,
            eind_datum=eind_datum,
            commit=commit,
        )

    @staticmethod
    def delete_auto_generated_tasks(
        db: Session,
        project_id: int,
        commit: bool = True,
    ) -> int:
        """
        Delete all auto-generated tasks for a project.
        Useful when a project is deleted or client is removed.

        Args:
            db: Database session
            project_id: ID of the project
            commit: Whether to commit the changes

        Returns:
            Number of tasks deleted
        """
        tasks = (
            db.query(Task)
            .filter(Task.project_id == project_id, Task.auto_generated == True)
            .all()
        )

        count = len(tasks)
        for task in tasks:
            db.delete(task)

        if commit:
            db.commit()

        return count
