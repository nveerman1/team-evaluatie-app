import { ChecklistItem } from "./ChecklistItem";
import { TeamInfo } from "@/dtos/project-notes.dto";

interface NoteItem {
  id: number;
  date: string;
  who: string;
  category: string;
  text: string;
  tags?: string[];
}

interface TeamNotesCardProps {
  contextId: number;
  team: TeamInfo;
  quickNoteText: string;
  onQuickNoteTextChange: (value: string) => void;
  onQuickNoteClick: (template: string) => void;
  onSelectStudent: (studentId: number) => void;
}

const QUICK_NOTES = [
  "Mindere communicatie",
  "Veel afgeleid",
  "Goede rolverdeling",
  "Neemt weinig initiatief",
  "Actief betrokken bij groep",
  "Sterke uitleg aan klasgenoten",
];

export function TeamNotesCard({
  contextId,
  team,
  quickNoteText,
  onQuickNoteTextChange,
  onQuickNoteClick,
  onSelectStudent,
}: TeamNotesCardProps) {
  const teamNotes: NoteItem[] = [
    {
      id: 1,
      date: "14-11-2025 · Les 3",
      who: team.name,
      category: "Samenwerking",
      text: "Team werkte actief samen; iedereen kwam aan het woord tijdens de brainstorm.",
      tags: ["samenwerking", "proces"],
    },
    {
      id: 2,
      date: "13-11-2025 · Coachmoment",
      who: team.name,
      category: "Taakverdeling",
      text: "Taken opnieuw verdeeld zodat ook rustigere leerlingen een duidelijke rol kregen.",
      tags: ["taakverdeling", "eigenaarschap"],
    },
    {
      id: 3,
      date: "07-11-2025",
      who: team.name,
      category: "Planning",
      text: "Planning liep achter, maar team heeft concrete tussenstappen toegevoegd aan het bord.",
      tags: ["planning", "bijsturen"],
    },
  ];

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Header met teaminfo & snel naar leerlingen */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Team</p>
            <h2 className="text-sm font-semibold text-slate-900">{team.name}</h2>
            <p className="text-xs text-slate-500">Leerlingen: {team.members.join(", ")}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 border border-amber-100">
              Focus: {team.focus}
            </span>
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700 border border-indigo-100">
              {teamNotes.length} observaties (dummy)
            </span>
          </div>
        </div>

        {/* Snelle navigatie naar leerlingen van dit team */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-slate-500">Ga naar leerlingdossier:</span>
          {team.members.map((memberName, idx) => (
            <button
              key={team.member_ids[idx]}
              onClick={() => onSelectStudent(team.member_ids[idx])}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-800"
            >
              {memberName}
            </button>
          ))}
        </div>
      </div>

      {/* Checklists + gecombineerde teamnotitie */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr),minmax(0,1fr)]">
        {/* Linkerkolom: checklists */}
        <div className="space-y-3 md:space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 mb-2">Teamchecklists</p>
            <div className="grid md:grid-cols-3 gap-3 text-[11px]">
              <div className="space-y-1.5">
                <p className="font-semibold text-slate-800 text-xs">Voortgang</p>
                <ChecklistItem label="Tussenproduct op tijd ingeleverd" />
                <ChecklistItem label="Planning zichtbaar/geactualiseerd" />
                <ChecklistItem label="Doelen voor deze les duidelijk" />
              </div>
              <div className="space-y-1.5">
                <p className="font-semibold text-slate-800 text-xs">Taakverdeling</p>
                <ChecklistItem label="Taken evenwichtig verdeeld" />
                <ChecklistItem label="Iedereen weet wat hij/zij doet" />
                <ChecklistItem label="Taken sluiten aan bij kwaliteiten" />
              </div>
              <div className="space-y-1.5">
                <p className="font-semibold text-slate-800 text-xs">Proces</p>
                <ChecklistItem label="Reflectie op keuzes vastgelegd" />
                <ChecklistItem label="Feedback gebruikt in bijsturing" />
                <ChecklistItem label="Prototypes/testen uitgevoerd" />
              </div>
            </div>
          </div>
        </div>

        {/* Rechterkolom: nieuwe aantekening voor team */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Nieuwe aantekening voor team
              </p>
              <p className="text-xs text-slate-500">
                Gebruik een snelnotitie en vul zo nodig kort aan in het tekstvak.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-700">
              Tijdstempel: nu (dummy)
            </span>
          </div>

          {/* Veelgebruikte knoppen */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_NOTES.map((q) => (
              <button
                key={q}
                onClick={() => onQuickNoteClick(q)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-800 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-800"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Tekstvak voor toelichting */}
          <textarea
            className="mt-2 w-full min-h-[90px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/70"
            placeholder="Bijvoorbeeld: korte observatie over hoe dit team vandaag werkte..."
            value={quickNoteText}
            onChange={(e) => onQuickNoteTextChange(e.target.value)}
          />

          {/* Tags + competentie + eindterm */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] mt-1">
            <div className="flex flex-wrap gap-1.5">
              <span className="text-slate-500 mr-1">Tags:</span>
              {["samenwerking", "proces", "reflectie", "communicatie"].map((tag) => (
                <button
                  key={tag}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-800"
                >
                  #{tag}
                </button>
              ))}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1 text-slate-600">
                <input type="checkbox" className="h-3 w-3 rounded border-slate-300" />
                Markeer als competentiebewijs
              </label>
              <select className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700">
                <option>OMZA-categorie</option>
                <option>Organiseren</option>
                <option>Meedoen</option>
                <option>Zelfvertrouwen</option>
                <option>Autonomie</option>
              </select>
              <select className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700">
                <option>Koppel aan eindterm (optioneel)</option>
                <option>16 – Presenteren</option>
                <option>5 – Projectmatig werken</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end mt-1">
            <button className="rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
              Notitie opslaan (dummy)
            </button>
          </div>
        </div>
      </div>

      {/* Overzicht van gemaakte teamnotities */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Eerdere teamnotities (dummy)
            </p>
            <p className="text-sm text-slate-600">
              Laatste observaties voor {team.name}, met datum en tags.
            </p>
          </div>
          <button className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium">
            Alles bekijken
          </button>
        </div>
        <ul className="divide-y divide-slate-100">
          {teamNotes.map((note) => (
            <li key={note.id} className="px-4 py-3.5">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-[11px] text-slate-500">{note.date}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{note.category}</p>
                  <p className="text-sm text-slate-800 mt-0.5">{note.text}</p>
                  {note.tags && (
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                      {note.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
