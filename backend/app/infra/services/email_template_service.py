"""
Email template service for client communications
"""

from __future__ import annotations
from typing import Dict, Any, Optional
import re


class EmailTemplateService:
    """
    Service for managing email templates with variable substitution
    """

    # Default email templates
    TEMPLATES: Dict[str, Dict[str, str]] = {
        "opvolgmail": {
            "name": "Opvolgmail nieuw schooljaar",
            "subject": "Samenwerking schooljaar {schooljaar}",
            "body": """Beste {contactpersoon},

Het schooljaar {schooljaar} staat voor de deur en wij willen graag onze samenwerking voortzetten.

Heeft u interesse om opnieuw een project met onze leerlingen te doen?

Met vriendelijke groet,
Het docententeam
{school_naam}""",
        },
        "tussenpresentatie": {
            "name": "Uitnodiging tussenpresentatie",
            "subject": "Uitnodiging tussenpresentatie {project_naam}",
            "body": """Beste {contactpersoon},

Graag nodigen wij u uit voor de tussenpresentatie van het project "{project_naam}".

Datum: {datum}
Tijd: {tijd}
Locatie: {locatie}

De leerlingen van klas {klas_naam} kijken ernaar uit om hun voortgang met u te delen.

Met vriendelijke groet,
{docent_naam}
{school_naam}""",
        },
        "eindpresentatie": {
            "name": "Uitnodiging eindpresentatie",
            "subject": "Uitnodiging eindpresentatie {project_naam}",
            "body": """Beste {contactpersoon},

Graag nodigen wij u uit voor de eindpresentatie van het project "{project_naam}".

Datum: {datum}
Tijd: {tijd}
Locatie: {locatie}

De leerlingen van klas {klas_naam} presenteren hun eindresultaat.

Met vriendelijke groet,
{docent_naam}
{school_naam}""",
        },
        "bedankmail": {
            "name": "Bedankmail na project",
            "subject": "Bedankt voor uw bijdrage aan {project_naam}",
            "body": """Beste {contactpersoon},

Hartelijk dank voor uw bijdrage aan het project "{project_naam}".

De leerlingen van klas {klas_naam} hebben veel geleerd van deze samenwerking en waardeerden uw expertise en feedback enorm.

Wij hopen in de toekomst opnieuw met u samen te mogen werken.

Met vriendelijke groet,
{docent_naam}
{school_naam}""",
        },
        "kennismakingsmail": {
            "name": "Kennismakingsmail nieuwe opdrachtgever",
            "subject": "Kennismaking {school_naam}",
            "body": """Beste {contactpersoon},

Bedankt voor uw interesse in een samenwerking met {school_naam}.

Wij zijn een school voor voortgezet onderwijs en zoeken regelmatig externe partners voor praktijkgerichte projecten met onze leerlingen.

Graag maken wij kennis om de mogelijkheden te bespreken.

Met vriendelijke groet,
{docent_naam}
{school_naam}""",
        },
    }

    @staticmethod
    def get_template(template_key: str) -> Optional[Dict[str, str]]:
        """Get a template by key"""
        return EmailTemplateService.TEMPLATES.get(template_key)

    @staticmethod
    def list_templates() -> Dict[str, Dict[str, str]]:
        """List all available templates"""
        return EmailTemplateService.TEMPLATES

    @staticmethod
    def substitute_variables(template_text: str, variables: Dict[str, Any]) -> str:
        """
        Substitute variables in template text
        Variables are in the format {variable_name}
        """
        result = template_text

        # Replace all variables
        for key, value in variables.items():
            placeholder = f"{{{key}}}"
            if placeholder in result:
                # Convert value to string, handle None
                str_value = str(value) if value is not None else ""
                result = result.replace(placeholder, str_value)

        return result

    @staticmethod
    def render_template(
        template_key: str, variables: Dict[str, Any]
    ) -> Optional[Dict[str, str]]:
        """
        Render a template with variable substitution
        Returns dict with 'subject' and 'body' keys
        """
        template = EmailTemplateService.get_template(template_key)
        if not template:
            return None

        return {
            "subject": EmailTemplateService.substitute_variables(
                template["subject"], variables
            ),
            "body": EmailTemplateService.substitute_variables(
                template["body"], variables
            ),
        }

    @staticmethod
    def extract_variables(template_text: str) -> list[str]:
        """
        Extract variable names from template text
        Variables are in the format {variable_name}
        """
        # Find all {variable_name} patterns
        pattern = r"\{([^}]+)\}"
        matches = re.findall(pattern, template_text)
        return list(set(matches))

    @staticmethod
    def get_template_variables(template_key: str) -> Optional[list[str]]:
        """Get all variables required by a template"""
        template = EmailTemplateService.get_template(template_key)
        if not template:
            return None

        subject_vars = EmailTemplateService.extract_variables(template["subject"])
        body_vars = EmailTemplateService.extract_variables(template["body"])

        return list(set(subject_vars + body_vars))
