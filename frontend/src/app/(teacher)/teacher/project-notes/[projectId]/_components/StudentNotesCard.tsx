"use client";

import { useState } from "react";

interface Team {
  id: number;
  name: string;
  focus: string;
  members: string[];
}

interface NoteItem {
  id: number;
  date: string;
  who: string;
  category: string;
  text: string;
  tags?: string[];
}

interface StudentNotesCardProps {
  selectedStudentName: string | null;
  selectedTeam: Team;
}

const STUDENT_QUICK_NOTES = [
  { label: "Neemt weinig initiatief", omza: "Meedoen" },
  { label: "Trekt de kar voor het team", omza: "Organiseren" },
  { label: "Laat weinig van zich horen", omza: "Zelfvertrouwen" },
  { label: "Probeert een nieuwe aanpak uit", omza: "Autonomie" },
];

export function StudentNotesCard({
  selectedStudentName,
  selectedTeam,
}: StudentNotesCardProps) {
  const name = selectedStudentName ?? selectedTeam.members[0] ?? "Leerling";
  const [studentNoteText, setStudentNoteText] = useState("");
  const [studentOmza, setStudentOmza] = useState<string>("");

  const handleStudentQuickNoteClick = (note: { label: string; omza: string }) => {
    setStudentNoteText(note.label);
    setStudentOmza(note.omza);
  };

  const studentNotes: NoteItem[] = [
    {
      id: 1,
      date: "14-11-2025 · Les 3",
      who: name,
      category: "Meedoen · Communicatie",
      text: `${name} werkte actief samen met het team en nam een duidelijke rol in tijdens de opdracht.`,
      tags: ["samenwerking", "communicatie"],
    },
    {
      id: 2,
      date: "13-11-2025 · Les 2",
      who: name,
      category: "Zelfvertrouwen",
      text: `${name} presenteerde een tussenresultaat aan de klas met meer overtuiging dan vorige week`,
      tags: ["presenteren", "zelfvertrouwen"],
    },
  ];

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Leerlingdossier header */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 flex flex-col gap-2">
        <div className="flex flex-wrap justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Leerlingdossier</p>
            <h2 className="text-sm font-semibold text-slate-900">{name}</h2>
            <p className="text-xs text-slate-500">3H · {selectedTeam.name}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 border border-emerald-100">
              Sterk in: Samenwerken (dummy)
            </span>
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700 border border-sky-100">
              Groei in: Presenteren (dummy)
            </span>
          </div>
        </div>
      </div>

      {/* Nieuwe aantekening voor leerling */}
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-4 flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
          Nieuwe aantekening voor {name}
        </p>

        {/* Snelnotities gekoppeld aan OMZA */}
        <div className="mt-1">
          <p className="text-[11px] text-slate-500 mb-1">Snelnotities (direct gekoppeld aan OMZA):</p>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {STUDENT_QUICK_NOTES.map((note) => (
              <button
                key={note.label}
                type="button"
                onClick={() => handleStudentQuickNoteClick(note)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-800"
              >
                <span>{note.label}</span>
              </button>
            ))}
          </div>
        </div>

        <textarea
          className="mt-2 w-full min-h-[90px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/70"
          placeholder={`Bijvoorbeeld: ${name} nam vandaag spontaan de rol van host bij de rondleiding voor de opdrachtgever...`}
          value={studentNoteText}
          onChange={(e) => setStudentNoteText(e.target.value)}
        />

        {/* Tags + OMZA + eindterm + portfolio */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] mt-2">
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
              Markeer als portfolio-bewijs
            </label>
            <select
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700"
              value={studentOmza || ""}
              onChange={(e) => setStudentOmza(e.target.value)}
            >
              <option value="">OMZA-categorie</option>
              <option value="Organiseren">Organiseren</option>
              <option value="Meedoen">Meedoen</option>
              <option value="Zelfvertrouwen">Zelfvertrouwen</option>
              <option value="Autonomie">Autonomie</option>
            </select>
            <select className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700">
              <option>Koppel aan eindterm (optioneel)</option>
              <option>16 – Presenteren</option>
              <option>5 – Projectmatig werken</option>
            </select>
          </div>
        </div>

        <div className="flex justify-between items-center mt-1">
          <p className="text-[11px] text-slate-500">
            Alleen zichtbaar voor docenten; niet gedeeld met leerlingen.
          </p>
          <button className="rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
            Aantekening opslaan (dummy)
          </button>
        </div>
      </div>

      {/* Observatielijst (dummydata) */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            Observaties gekoppeld aan {name}
          </p>
          <button className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium">
            Exporteer voor gesprek (dummy)
          </button>
        </div>
        <ul className="divide-y divide-slate-100">
          {studentNotes.map((note) => (
            <li key={note.id} className="px-4 py-3.5">
              <div className="flex justify-between gap-2">
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
