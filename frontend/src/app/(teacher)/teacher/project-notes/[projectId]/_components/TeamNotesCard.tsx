"use client";

import { useState, useEffect } from "react";
import { ChecklistItem } from "./ChecklistItem";
import { TeamInfo, ProjectNote } from "@/dtos/project-notes.dto";
import { projectNotesService } from "@/services";

interface TeamNotesCardProps {
  contextId: number;
  team: TeamInfo;
  quickNoteText: string;
  onQuickNoteTextChange: (value: string) => void;
  onQuickNoteClick: (template: string) => void;
  onSelectStudent: (studentId: number) => void;
  searchText?: string;
  filterCategory?: string;
}

// Quick notes with pre-linked OMZA category and tags
const QUICK_NOTES = [
  { text: "Mindere communicatie", omza: "Communicatie", tags: ["communicatie", "aandachtspunt"] },
  { text: "Veel afgeleid", omza: "Meedoen", tags: ["focus", "aandachtspunt"] },
  { text: "Goede rolverdeling", omza: "Organiseren", tags: ["samenwerking", "organisatie"] },
  { text: "Neemt weinig initiatief", omza: "Meedoen", tags: ["initiatief", "aandachtspunt"] },
  { text: "Actief betrokken bij groep", omza: "Meedoen", tags: ["betrokkenheid", "samenwerking"] },
  { text: "Sterke uitleg aan klasgenoten", omza: "Communicatie", tags: ["communicatie", "helpend"] },
];

export function TeamNotesCard({
  contextId,
  team,
  quickNoteText,
  onQuickNoteTextChange,
  onQuickNoteClick,
  onSelectStudent,
  searchText,
  filterCategory,
}: TeamNotesCardProps) {
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [omzaCategory, setOmzaCategory] = useState<string>("");
  const [learningObjectiveId, setLearningObjectiveId] = useState<string>("");
  const [isCompetencyEvidence, setIsCompetencyEvidence] = useState(false);

  useEffect(() => {
    loadNotes();
  }, [contextId, team.id]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const data = await projectNotesService.listNotes(contextId, {
        note_type: "team",
        team_id: team.id,
      });
      setNotes(data);
    } catch (error) {
      console.error("Failed to load team notes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickNoteClick = (quickNote: typeof QUICK_NOTES[0]) => {
    onQuickNoteClick(quickNote.text);
    setOmzaCategory(quickNote.omza);
    setSelectedTags(quickNote.tags);
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = async () => {
    if (!quickNoteText.trim()) {
      alert("Vul eerst een aantekening in.");
      return;
    }

    try {
      setSaving(true);
      await projectNotesService.createNote(contextId, {
        note_type: "team",
        team_id: team.id,
        text: quickNoteText,
        tags: selectedTags,
        omza_category: omzaCategory || null,
        learning_objective_id: learningObjectiveId ? Number(learningObjectiveId) : null,
        is_competency_evidence: isCompetencyEvidence,
        is_portfolio_evidence: false,
        metadata: {},
      });
      
      // Reset form
      onQuickNoteTextChange("");
      setSelectedTags([]);
      setOmzaCategory("");
      setLearningObjectiveId("");
      setIsCompetencyEvidence(false);
      
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
      {/* Header met teaminfo & snel naar leerlingen */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Team</p>
            <h2 className="text-sm font-semibold text-slate-900">
              {team.team_number ? `Team ${team.team_number}` : team.name}
            </h2>
            <p className="text-xs text-slate-500">Leerlingen: {team.members.join(", ")}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700 border border-indigo-100">
              {notes.length} {notes.length === 1 ? 'observatie' : 'observaties'}
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
                key={q.text}
                onClick={() => handleQuickNoteClick(q)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-800 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-800"
                title={`OMZA: ${q.omza} | Tags: ${q.tags.join(', ')}`}
              >
                {q.text}
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
                  checked={isCompetencyEvidence}
                  onChange={(e) => setIsCompetencyEvidence(e.target.checked)}
                />
                Markeer als competentiebewijs
              </label>
              <select 
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700"
                value={omzaCategory}
                onChange={(e) => setOmzaCategory(e.target.value)}
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

          <div className="flex justify-end mt-1">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Opslaan..." : "Notitie opslaan"}
            </button>
          </div>
        </div>
      </div>

      {/* Overzicht van gemaakte teamnotities */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Eerdere teamnotities
            </p>
            <p className="text-sm text-slate-600">
              Laatste observaties voor {team.name}, met datum en tags.
            </p>
          </div>
        </div>
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            Laden...
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            Nog geen notities voor dit team.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredNotes.map((note) => (
              <li key={note.id} className="px-4 py-3.5">
                <div className="flex justify-between gap-3">
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
                    {note.is_competency_evidence && (
                      <span className="inline-block mt-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                        Competentiebewijs
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
