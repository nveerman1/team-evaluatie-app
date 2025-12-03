"use client";

import { useState, useEffect } from "react";
import { StudentPill } from "./StudentPill";
import { NotesOverviewAll } from "./NotesOverviewAll";
import { TeamInfo, StudentInfo, ProjectNote } from "@/dtos/project-notes.dto";
import { projectNotesService } from "@/services";

interface CombinedTeamCardProps {
  contextId: number;
  team: TeamInfo;
  students: StudentInfo[];
  notes: ProjectNote[];
  search: string;
  searchOmza: string;
  initialOpen?: boolean;
  onNoteSaved: () => void;
}

// Quick notes for teams
const QUICK_NOTES_TEAM = [
  "Mindere communicatie",
  "Veel afgeleid",
  "Goede rolverdeling",
  "Neemt weinig initiatief",
  "Actief betrokken bij groep",
  "Sterke uitleg aan klasgenoten",
];

// Quick notes for students
const QUICK_NOTES_STUDENT = [
  "Weinig gedaan",
  "Aandacht nodig",
  "Stille deelname",
  "Neemt snel de leiding",
  "Zoekt veel afleiding",
];

// OMZA categories
const OMZA_CATEGORIES = ["Organiseren", "Meedoen", "Zelfvertrouwen", "Autonomie"];

export function CombinedTeamCard({
  contextId,
  team,
  students,
  notes,
  search,
  searchOmza,
  initialOpen = false,
  onNoteSaved,
}: CombinedTeamCardProps) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [filter, setFilter] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [omzaTags, setOmzaTags] = useState<string[]>([]);

  // Update isOpen when initialOpen changes (e.g., when search matches)
  useEffect(() => {
    if (initialOpen) {
      setIsOpen(true);
    }
  }, [initialOpen]);

  const toggleOmza = (tag: string) => {
    setOmzaTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleStudentClick = (name: string, studentId: number) => {
    if (!isOpen) setIsOpen(true);
    if (filter === name) {
      setFilter(null);
      setSelectedStudentId(null);
      return;
    }
    setFilter(name);
    setSelectedStudentId(studentId);
  };

  const formatSnippet = (baseText: string, isStudent: boolean) => {
    const tags: string[] = [];
    if (isStudent && filter) tags.push(`#${filter}`);
    if (omzaTags.length) tags.push(...omzaTags.map(t => `#${t}`));
    const tagBlock = tags.length ? `[${tags.join("][")}]` : "";
    const trimmedText = baseText.trim();
    if (!tagBlock && !trimmedText) return "";
    if (!trimmedText) return tagBlock;
    if (!tagBlock) return trimmedText;
    return `${tagBlock} – ${trimmedText}`;
  };

  const saveQuick = (text: string, isStudent: boolean = false) => {
    if (!isOpen) setIsOpen(true);
    const line = formatSnippet(text, isStudent);
    if (!line) {
      return;
    }
    setNote(prev => prev.trim() ? `${prev.trim()}\n${line}` : line);
  };

  const saveNote = async () => {
    if (!note.trim()) return;
    
    try {
      setSaving(true);
      
      // Determine if this is a student note or team note
      const isStudentNote = selectedStudentId !== null;
      
      await projectNotesService.createNote(contextId, {
        note_type: isStudentNote ? "student" : "team",
        team_id: team.id,
        student_id: isStudentNote ? selectedStudentId : null,
        text: note,
        tags: [],
        omza_category: omzaTags.length > 0 ? omzaTags[0] : null,
        learning_objective_id: null,
        is_competency_evidence: false,
        is_portfolio_evidence: false,
        metadata: { omza_tags: omzaTags },
      });
      
      // Reset form
      setNote("");
      setOmzaTags([]);
      
      // Notify parent to refresh notes
      onNoteSaved();
    } catch (error) {
      console.error("Failed to save note:", error);
      alert("Fout bij opslaan. Probeer het opnieuw.");
    } finally {
      setSaving(false);
    }
  };

  // Get the team display name
  const teamDisplayName = team.team_number ? `Team ${team.team_number}` : team.name;

  return (
    <article 
      id={`team-${team.id}`}
      className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-4"
    >
      <div className="flex flex-col gap-3">
        {/* Header with team name and toggle */}
        <div className="flex items-start justify-between w-full">
          <button onClick={() => setIsOpen(!isOpen)} className="text-left flex-1">
            <h3 className="text-sm font-semibold text-slate-900">{teamDisplayName}</h3>
          </button>
          <div className="flex items-center gap-1">
            {saving && <span className="text-[10px] text-green-600">Opgeslagen ✓</span>}
            <span className={`transition-transform ${isOpen ? "rotate-90" : "rotate-0"}`}>▸</span>
          </div>
        </div>
        
        {/* Student pills */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {students.map(student => (
            <StudentPill
              key={student.id}
              name={student.name}
              active={filter === student.name}
              onClick={() => handleStudentClick(student.name, student.id)}
            />
          ))}
        </div>
      </div>

      {/* Team quick notes - always visible */}
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {QUICK_NOTES_TEAM.map(n => (
          <button
            key={n}
            onClick={() => saveQuick(n, false)}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 hover:bg-indigo-50"
          >
            {n}
          </button>
        ))}
      </div>

      {/* Student quick notes - only visible when a student is selected */}
      {filter && (
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {QUICK_NOTES_STUDENT.map(n => (
            <button
              key={n}
              onClick={() => saveQuick(n, true)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 hover:bg-indigo-50"
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {/* Expanded content */}
      {isOpen && (
        <div className="space-y-4">
          {/* Note textarea */}
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Korte observatie..."
            className="w-full min-h-[80px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          
          {/* OMZA tags */}
          <div className="flex flex-wrap gap-2 text-xs">
            {OMZA_CATEGORIES.map(tag => (
              <button
                key={tag}
                onClick={() => toggleOmza(tag)}
                className={`px-2 py-1 rounded-full border text-[11px] ${
                  omzaTags.includes(tag)
                    ? "bg-indigo-100 border-indigo-300 text-indigo-800"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-indigo-50"
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
          
          {/* Save button */}
          <button
            onClick={saveNote}
            disabled={saving || !note.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Opslaan..." : "Notitie opslaan"}
          </button>
          
          {/* Notes feed */}
          <NotesOverviewAll
            teamName={teamDisplayName}
            notes={notes}
            filter={filter}
            search={search}
            searchOmza={searchOmza}
          />
        </div>
      )}
    </article>
  );
}
