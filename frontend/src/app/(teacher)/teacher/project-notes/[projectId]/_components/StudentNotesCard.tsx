"use client";

import { useState, useEffect } from "react";
import { StudentInfo, ProjectNote } from "@/dtos/project-notes.dto";
import { projectNotesService } from "@/services";

interface StudentNotesCardProps {
  contextId: number;
  selectedStudent: StudentInfo;
  searchText?: string;
  filterCategory?: string;
}

// Quick notes with pre-linked OMZA category and tags
const STUDENT_QUICK_NOTES = [
  { label: "Neemt weinig initiatief", omza: "Meedoen", tags: ["initiatief", "aandachtspunt"] },
  { label: "Trekt de kar voor het team", omza: "Organiseren", tags: ["leiderschap", "organisatie"] },
  { label: "Laat weinig van zich horen", omza: "Zelfvertrouwen", tags: ["communicatie", "aandachtspunt"] },
  { label: "Probeert een nieuwe aanpak uit", omza: "Autonomie", tags: ["innovatie", "experimenteren"] },
];

export function StudentNotesCard({
  contextId,
  selectedStudent,
  searchText,
  filterCategory,
}: StudentNotesCardProps) {
  const name = selectedStudent.name;
  const [studentNoteText, setStudentNoteText] = useState("");
  const [studentOmza, setStudentOmza] = useState<string>("");
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [learningObjectiveId, setLearningObjectiveId] = useState<string>("");
  const [isPortfolioEvidence, setIsPortfolioEvidence] = useState(false);

  useEffect(() => {
    loadNotes();
  }, [contextId, selectedStudent.id]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const data = await projectNotesService.listNotes(contextId, {
        note_type: "student",
        student_id: selectedStudent.id,
      });
      setNotes(data);
    } catch (error) {
      console.error("Failed to load student notes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentQuickNoteClick = (note: typeof STUDENT_QUICK_NOTES[0]) => {
    setStudentNoteText(note.label);
    setStudentOmza(note.omza);
    setSelectedTags(note.tags);
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = async () => {
    if (!studentNoteText.trim()) {
      alert("Vul eerst een aantekening in.");
      return;
    }

    try {
      setSaving(true);
      await projectNotesService.createNote(contextId, {
        note_type: "student",
        student_id: selectedStudent.id,
        text: studentNoteText,
        tags: selectedTags,
        omza_category: studentOmza || null,
        learning_objective_id: learningObjectiveId ? Number(learningObjectiveId) : null,
        is_competency_evidence: false,
        is_portfolio_evidence: isPortfolioEvidence,
        metadata: {},
      });
      
      // Reset form
      setStudentNoteText("");
      setSelectedTags([]);
      setStudentOmza("");
      setLearningObjectiveId("");
      setIsPortfolioEvidence(false);
      
      loadNotes(); // Reload notes
    } catch (error) {
      console.error("Failed to save note:", error);
      alert("Fout bij opslaan. Probeer het opnieuw.");
    } finally {
      setSaving(false);
    }
  };

  // Filter notes
  const filteredNotes = notes.filter(note => {
    if (searchText && !note.text.toLowerCase().includes(searchText.toLowerCase())) {
      return false;
    }
    if (filterCategory && note.omza_category !== filterCategory) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Leerlingdossier header */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 flex flex-col gap-2">
        <div className="flex flex-wrap justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Leerlingdossier</p>
            <h2 className="text-sm font-semibold text-slate-900">{name}</h2>
            <p className="text-xs text-slate-500">{selectedStudent.team_name || 'Geen team'}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700 border border-indigo-100">
              {notes.length} {notes.length === 1 ? 'observatie' : 'observaties'}
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
                title={`OMZA: ${note.omza} | Tags: ${note.tags.join(', ')}`}
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
                onClick={() => handleToggleTag(tag)}
                className={`rounded-full border px-2.5 py-1 ${
                  selectedTags.includes(tag)
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                    : 'border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-800'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1 text-slate-600">
              <input 
                type="checkbox" 
                className="h-3 w-3 rounded border-slate-300"
                checked={isPortfolioEvidence}
                onChange={(e) => setIsPortfolioEvidence(e.target.checked)}
              />
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
              <option value="Communicatie">Communicatie</option>
            </select>
            <select 
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700"
              value={learningObjectiveId}
              onChange={(e) => setLearningObjectiveId(e.target.value)}
            >
              <option value="">Koppel aan eindterm (optioneel)</option>
              <option value="16">16 – Presenteren</option>
              <option value="5">5 – Projectmatig werken</option>
            </select>
          </div>
        </div>

        <div className="flex justify-between items-center mt-1">
          <p className="text-[11px] text-slate-500">
            Alleen zichtbaar voor docenten; niet gedeeld met leerlingen.
          </p>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Opslaan..." : "Aantekening opslaan"}
          </button>
        </div>
      </div>

      {/* Observatielijst */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            Observaties gekoppeld aan {name}
          </p>
        </div>
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            Laden...
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            Nog geen notities voor deze leerling.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredNotes.map((note) => (
              <li key={note.id} className="px-4 py-3.5">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="text-[11px] text-slate-500">
                      {new Date(note.created_at).toLocaleDateString('nl-NL', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                      {note.created_by_name && ` • ${note.created_by_name}`}
                    </p>
                    {note.omza_category && (
                      <p className="text-[11px] text-slate-500 mt-0.5">{note.omza_category}</p>
                    )}
                    <p className="text-sm text-slate-800 mt-0.5">{note.text}</p>
                    {note.tags.length > 0 && (
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
                    {note.is_portfolio_evidence && (
                      <span className="inline-block mt-1 text-[10px] text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">
                        Portfolio-bewijs
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
