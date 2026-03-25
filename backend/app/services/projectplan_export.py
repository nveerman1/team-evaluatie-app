from __future__ import annotations

from datetime import date
from io import BytesIO

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt, RGBColor

# Document color palette
COLOR_TITLE = RGBColor(0x1E, 0x29, 0x3B)   # slate-800
COLOR_META = RGBColor(0x64, 0x74, 0x8B)    # slate-500


SECTION_ORDER = [
    "client",
    "problem",
    "goal",
    "method",
    "planning",
    "tasks",
    "motivation",
    "risks",
]

SECTION_TITLES = {
    "client": "1. Opdrachtgever",
    "problem": "2. Probleemstelling",
    "goal": "3. Doelstelling",
    "method": "4. Methode",
    "planning": "5. Planning",
    "tasks": "6. Taakverdeling",
    "motivation": "7. Motivatie",
    "risks": "8. Risico's",
}


def generate_projectplan_docx(team_data: dict) -> BytesIO:
    """
    Generate a professionally styled Word document for a projectplan.

    Args:
        team_data: dict with title, team_number, team_members, sections

    Returns:
        BytesIO buffer containing the .docx file
    """
    doc = Document()

    # --- Page margins ---
    for section in doc.sections:
        section.top_margin = Cm(2.5)
        section.bottom_margin = Cm(2.5)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2.5)

    # --- Project information block (first section, no page break) ---
    title_text = team_data.get("title") or "Projectplan"
    title_para = doc.add_heading(title_text, level=0)
    title_para.alignment = WD_ALIGN_PARAGRAPH.LEFT
    # Style the title
    for run in title_para.runs:
        run.font.size = Pt(24)
        run.font.color.rgb = COLOR_TITLE

    team_number = team_data.get("team_number")
    team_members = team_data.get("team_members") or []
    export_date = date.today().strftime("%d-%m-%Y")

    def _add_meta_line(text: str) -> None:
        para = doc.add_paragraph(text)
        para.paragraph_format.space_before = Pt(0)
        para.paragraph_format.space_after = Pt(2)
        for run in para.runs:
            run.font.size = Pt(11)
            run.font.color.rgb = COLOR_META

    if team_number is not None:
        _add_meta_line(f"Team {team_number}")
    if team_members:
        _add_meta_line(", ".join(team_members))
    _add_meta_line(f"Datum: {export_date}")

    # --- Content sections ---
    sections_map = {s["key"]: s for s in team_data.get("sections", [])}

    for key in SECTION_ORDER:
        section = sections_map.get(key)
        if not section:
            continue

        if key == "client":
            client = section.get("client") or {}
            # Only include section if at least one client field has content
            client_rows = [
                ("Organisatie", client.get("organisation")),
                ("Contactpersoon", client.get("contact")),
                ("Email", client.get("email")),
                ("Telefoon", client.get("phone")),
                ("Beschrijving", client.get("description")),
            ]
            non_empty_rows = [(label, val) for label, val in client_rows if val]
            if not non_empty_rows:
                continue

            doc.add_heading(SECTION_TITLES[key], level=1)

            table = doc.add_table(rows=0, cols=2)
            table.style = "Light List Accent 1"
            for label, value in non_empty_rows:
                row = table.add_row()
                row.cells[0].text = label
                row.cells[1].text = value
        else:
            text = (section.get("text") or "").strip()
            if not text:
                continue

            doc.add_heading(SECTION_TITLES[key], level=1)
            doc.add_paragraph(text)

    # --- Akkoordverklaring ---
    doc.add_heading("Akkoordverklaring", level=1)
    doc.add_paragraph(
        "Hierbij verklaren ondergetekenden akkoord te gaan met de inhoud van "
        "bovenstaand projectplan."
    )
    doc.add_paragraph()

    sig_table = doc.add_table(rows=4, cols=2)
    sig_table.alignment = WD_TABLE_ALIGNMENT.CENTER

    sig_table.cell(0, 0).text = "Namens opdrachtgever:"
    sig_table.cell(0, 1).text = "Namens projectteam:"
    sig_table.cell(1, 0).text = "\n\n______________________"
    sig_table.cell(1, 1).text = "\n\n______________________"
    sig_table.cell(2, 0).text = "Naam:"
    sig_table.cell(2, 1).text = "Naam:"
    sig_table.cell(3, 0).text = "Datum:"
    sig_table.cell(3, 1).text = "Datum:"

    # --- Save to buffer ---
    buffer = BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer
