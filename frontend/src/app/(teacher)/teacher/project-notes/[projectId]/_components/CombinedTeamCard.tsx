"use client";

import { useState, useEffect } from "react";
import { StudentPill } from "./StudentPill";
import { TeamInfo, StudentInfo, ProjectNote } from "@/dtos/project-notes.dto";
import { TeacherCourse } from "@/dtos/course.dto";
import { projectNotesService } from "@/services";
import { ReactNode } from "react";

interface CombinedTeamCardProps {
  contextId: number;
  team: TeamInfo;
  students: StudentInfo[];
  notes: ProjectNote[];
  search: string;
  searchOmza: string;
  courseTeachers: TeacherCourse[];
  teamTitle: string;
  teamResponsibleTeacherId: number | null;
  onTeamMetaChange: (teamId: number, patch: { title?: string; responsibleTeacherId?: number | null }) => void;
  onTitleLiveChange?: (teamId: number, title: string) => void;
  onNoteSaved: () => void;
}
// Quick notes for teams with linked OMZA tags
const QUICK_NOTES_TEAM: { text: string; omza: string | null }[] = [
  { text: "Werkt geconcentreerd als team", omza: "Organiseren" },
  { text: "Taken goed verdeeld", omza: "Organiseren" },
  { text: "Planning helder en gevolgd", omza: "Organiseren" },
  { text: "Team neemt samen beslissingen", omza: "Meedoen" },
  { text: "Weinig overleg / ieder werkt op eilandje", omza: "Meedoen" },
  { text: "Tempo ligt te laag voor de planning", omza: "Organiseren" },
  { text: "Veel afleiding in de groep", omza: "Zelfvertrouwen" },
  { text: "Constructieve sfeer, helpt elkaar", omza: "Meedoen" },
  { text: "Onenigheid remt het werk", omza: "Meedoen" },
];

// Quick notes for students with linked OMZA tags
const QUICK_NOTES_STUDENT: { text: string; omza: string | null }[] = [
  { text: "Weinig gedaan", omza: "Meedoen" },
  { text: "Extra aandacht / sturing nodig", omza: "Autonomie" },
  { text: "Stille deelname, weinig inbreng", omza: "Meedoen" },
  { text: "Neemt snel de leiding", omza: "Organiseren" },
  { text: "Zoekt veel afleiding", omza: "Zelfvertrouwen" },
  { text: "Toont veel initiatief", omza: "Autonomie" },
  { text: "Helpt actief andere teamleden", omza: "Meedoen" },
  { text: "Komt afspraken niet na", omza: "Organiseren" },
  { text: "Blijft rustig en gefocust werken", omza: "Zelfvertrouwen" },
];

// OMZA categories with abbreviated display labels
const OMZA_MAP = [
  { label: "O", value: "Organiseren" },
  { label: "M", value: "Meedoen" },
  { label: "Z", value: "Zelfvertrouwen" },
  { label: "A", value: "Autonomie" },
];

export function CombinedTeamCard({
  contextId,
  team,
  students,
  notes,
  search,
  searchOmza,
  courseTeachers,
  teamTitle,
  teamResponsibleTeacherId,
  onTeamMetaChange,
  onTitleLiveChange,
  onNoteSaved,
}: CombinedTeamCardProps) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [omzaTags, setOmzaTags] = useState<string[]>([]);

  // Local editable state for team metadata
  const [localTitle, setLocalTitle] = useState(teamTitle);
  const [localTeacherId, setLocalTeacherId] = useState<number | null>(teamResponsibleTeacherId);

  // Keep local state in sync if props change (e.g. after parent reload)
  useEffect(() => { setLocalTitle(teamTitle); }, [teamTitle]);
  useEffect(() => { setLocalTeacherId(teamResponsibleTeacherId); }, [teamResponsibleTeacherId]);

  // Reset note form when the active team changes
  useEffect(() => {
    setNote("");
    setOmzaTags([]);
    setFilter(null);
    setSelectedStudentId(null);
  }, [team.id]);

  const toggleOmza = (tag: string) => {
    setOmzaTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleStudentClick = (name: string, studentId: number) => {
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

  const saveQuick = (text: string, omzaTag: string | null, isStudent: boolean = false) => {
    // Set the OMZA tag if provided
    if (omzaTag && !omzaTags.includes(omzaTag)) {
      setOmzaTags([omzaTag]);
    }
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
        // Only pass team_id for team notes, not for student notes
        team_id: isStudentNote ? null : team.id,
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

  // Filter and sort notes for the timeline panel
  let timelineNotes = notes;
  if (filter) {
    timelineNotes = timelineNotes.filter(
      n => n.student_name === filter || n.note_type === "team"
    );
  }
  if (search) {
    const sl = search.toLowerCase();
    timelineNotes = timelineNotes.filter(n =>
      n.text.toLowerCase().includes(sl) ||
      n.student_name?.toLowerCase().includes(sl)
    );
  }
  if (searchOmza) {
    timelineNotes = timelineNotes.filter(n => n.omza_category === searchOmza);
  }
  timelineNotes = [...timelineNotes].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Highlight search terms in note text
  const highlightText = (text: string): ReactNode => {
    if (!search) return text;
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escapedSearch})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, index) =>
      part.toLowerCase() === search.toLowerCase()
        ? <mark key={index} className="bg-yellow-200">{part}</mark>
        : part
    );
  };

  return (
    <article
      id={`team-${team.id}`}
      className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
    >
      {/* ── Header: team label + editable project title + teacher dropdown ── */}
      <div className="border-b border-slate-200 px-5 py-2 bg-slate-200">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-900 whitespace-nowrap shrink-0">
              {teamDisplayName}
            </h3>
            {/* Editable project title */}
            <input
              type="text"
              value={localTitle}
              onChange={(e) => {
                setLocalTitle(e.target.value);
                onTitleLiveChange?.(team.id, e.target.value);
              }}
              onBlur={() => {
                if (localTitle !== teamTitle) {
                  onTeamMetaChange(team.id, { title: localTitle });
                }
              }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
              placeholder="Projecttitel…"
              className="flex-1 min-w-[160px] text-sm font-bold bg-transparent border-b border-transparent hover:border-slate-400 focus:border-blue-500 focus:outline-none px-1 py-0.5 text-slate-700 placeholder:font-normal placeholder:text-slate-400"
              title="Klik om de projecttitel in te stellen"
              aria-label="Projecttitel van dit team"
            />
          </div>
          {/* Teacher dropdown */}
          <select
            value={localTeacherId ?? ""}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              setLocalTeacherId(val);
              onTeamMetaChange(team.id, { responsibleTeacherId: val });
            }}
            className="shrink-0 text-xs bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none px-2 py-1.5 text-slate-700 cursor-pointer"
            aria-label="Verantwoordelijk docent"
          >
            <option value="">Docent: —</option>
            {courseTeachers.map((t) => (
              <option key={t.teacher_id} value={t.teacher_id}>
                {t.teacher_name ?? `Docent ${t.teacher_id}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Body: 2-column split ── */}
      <div className="grid xl:grid-cols-[1fr_420px] divide-y xl:divide-y-0 xl:divide-x divide-slate-200">

        {/* LEFT: note entry UI */}
        <div className="p-4 space-y-3">

          {/* 1. Student selection */}
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Leerlingen</div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-4">
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

          {/* 2. Quick observation chips */}
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
              {filter ? `Snelle observaties – ${filter}` : "Snelle observaties"}
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {(!filter ? QUICK_NOTES_TEAM : QUICK_NOTES_STUDENT).map(n => (
                <button
                  key={n.text}
                  onClick={() => saveQuick(n.text, n.omza, !!filter)}
                  className={`rounded-full border px-3 py-1 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-800 transition ${
                    filter
                      ? "border-indigo-100 bg-indigo-50/50 text-slate-700"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                  title={n.omza ? `OMZA: ${n.omza}` : undefined}
                >
                  {n.text}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Observation textarea */}
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={filter ? `Observatie voor ${filter}...` : "Korte observatie voor het team..."}
            className="w-full min-h-[80px] rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 resize-none"
          />

          {/* 4. OMZA tags + Save button row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {OMZA_MAP.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleOmza(value)}
                  title={value}
                  className={`w-8 h-8 rounded-md border text-xs font-semibold transition ${
                    omzaTags.includes(value)
                      ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                      : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {label}
                </button>
              ))}
              {omzaTags.length > 0 && (
                <span className="text-[11px] text-slate-500 ml-1">
                  {omzaTags.join(", ")}
                </span>
              )}
            </div>
            <button
              onClick={saveNote}
              disabled={saving || !note.trim()}
              className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {saving ? "Opslaan..." : "Opslaan"}
            </button>
          </div>

        </div>

        {/* RIGHT: notes timeline */}
        <div className="p-4">
          <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
            Tijdlijn
            {timelineNotes.length > 0 && (
              <span className="ml-2 text-slate-400 normal-case font-normal tracking-normal">
                {timelineNotes.length} {timelineNotes.length === 1 ? "notitie" : "notities"}
              </span>
            )}
          </div>

          <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
            {timelineNotes.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                Nog geen aantekeningen{filter ? ` voor ${filter}` : ""}.
              </p>
            ) : (
              timelineNotes.map(n => {
                const isTeamNote = n.note_type === "team";
                const target = isTeamNote ? "Heel team" : (n.student_name ?? "Leerling");
                const date = new Date(n.created_at);
                const formattedDate = date.toLocaleDateString("nl-NL", {
                  day: "2-digit", month: "2-digit", year: "numeric",
                });
                const formattedTime = date.toLocaleTimeString("nl-NL", {
                  hour: "2-digit", minute: "2-digit",
                });
                const omzaTagsFromMeta: string[] = n.metadata?.omza_tags ?? [];
                const allOmzaTags = n.omza_category
                  ? [n.omza_category, ...omzaTagsFromMeta.filter((t: string) => t !== n.omza_category)]
                  : omzaTagsFromMeta;

                return (
                  <div
                    key={n.id}
                    className={`rounded-xl border p-3 text-sm ${
                      isTeamNote
                        ? "border-sky-200 bg-sky-50"
                        : "border-emerald-200 bg-emerald-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-[11px] font-semibold ${isTeamNote ? "text-sky-700" : "text-emerald-700"}`}>
                        {target}
                      </span>
                      <span className="text-[11px] text-slate-500 whitespace-nowrap shrink-0">
                        {formattedDate} · {formattedTime}
                      </span>
                    </div>
                    <p className="text-slate-700 text-[13px] leading-snug">
                      {highlightText(n.text)}
                    </p>
                    {allOmzaTags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {allOmzaTags.map((tag: string) => (
                          <span
                            key={tag}
                            className="inline-flex px-1.5 py-0.5 rounded-full bg-indigo-100 text-[10px] text-indigo-700"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </article>
  );
}
