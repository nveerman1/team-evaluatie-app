"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { use } from "react";
import { CombinedTeamCard } from "./_components/CombinedTeamCard";
import { projectNotesService, courseService } from "@/services";
import { ProjectNotesContextDetail, ProjectNote, TeamInfo } from "@/dtos/project-notes.dto";
import { TeacherCourse } from "@/dtos/course.dto";

// OMZA categories
const OMZA_CATEGORIES = ["Organiseren", "Meedoen", "Zelfvertrouwen", "Autonomie"];

export default function ProjectNotesDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  
  const [context, setContext] = useState<ProjectNotesContextDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [allNotes, setAllNotes] = useState<ProjectNote[]>([]);
  const [courseTeachers, setCourseTeachers] = useState<TeacherCourse[]>([]);

  // Editable project title
  const [editableTitle, setEditableTitle] = useState<string>("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Filter states
  const [search, setSearch] = useState<string>("");
  const [searchOmza, setSearchOmza] = useState<string>("");
  const [searchTeacher, setSearchTeacher] = useState<string>("");

  const loadContext = useCallback(async () => {
    try {
      setLoading(true);
      const data = await projectNotesService.getContext(Number(projectId));
      setContext(data);
      setEditableTitle(data.title ?? "");
      // Load teachers for the course if available
      if (data.course_id) {
        try {
          const teachers = await courseService.getCourseTeachers(data.course_id);
          setCourseTeachers(teachers);
        } catch {
          // Teachers not critical – ignore errors
        }
      }
    } catch (error) {
      console.error("Failed to load project context:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadAllNotes = useCallback(async () => {
    try {
      const data = await projectNotesService.getTimeline(Number(projectId));
      setAllNotes(data);
    } catch (error) {
      console.error("Failed to load notes:", error);
    }
  }, [projectId]);

  useEffect(() => {
    loadContext();
    loadAllNotes();
  }, [loadContext, loadAllNotes]);

  const handleNoteSaved = useCallback(() => {
    loadAllNotes();
  }, [loadAllNotes]);

  const handleTitleSave = useCallback(async () => {
    if (!context || editableTitle.trim() === context.title) return;
    const trimmed = editableTitle.trim();
    if (!trimmed) {
      setEditableTitle(context.title);
      return;
    }
    try {
      setIsSavingTitle(true);
      await projectNotesService.updateContext(Number(projectId), { title: trimmed });
      setContext(prev => prev ? { ...prev, title: trimmed } : prev);
    } catch (error) {
      console.error("Failed to save title:", error);
      setEditableTitle(context.title);
    } finally {
      setIsSavingTitle(false);
    }
  }, [context, editableTitle, projectId]);

  const handleResponsibleTeacherChange = useCallback(async (teacherId: string) => {
    if (!context) return;
    const newSettings = { ...context.settings, responsible_teacher_id: teacherId ? Number(teacherId) : null };
    try {
      await projectNotesService.updateContext(Number(projectId), { settings: newSettings });
      setContext(prev => prev ? { ...prev, settings: newSettings } : prev);
    } catch (error) {
      console.error("Failed to save responsible teacher:", error);
    }
  }, [context, projectId]);

  async function handleExport() {
    try {
      const notes = await projectNotesService.listNotes(Number(projectId));
      
      // Prepare CSV headers
      const headers = [
        'Datum',
        'Type',
        'Team',
        'Student',
        'OMZA Categorie',
        'Eindterm',
        'Tags',
        'Aantekening',
        'Competentiebewijs',
        'Portfolio',
      ];
      
      // Prepare CSV rows
      const rows = notes.map(note => [
        new Date(note.created_at).toLocaleDateString('nl-NL'),
        note.note_type === 'project' ? 'Project' : note.note_type === 'team' ? 'Team' : 'Student',
        note.team_name || '-',
        note.student_name || '-',
        note.omza_category || '-',
        note.learning_objective_title || '-',
        note.tags.join(', '),
        note.text,
        note.is_competency_evidence ? 'Ja' : 'Nee',
        note.is_portfolio_evidence ? 'Ja' : 'Nee',
      ]);
      
      // Create CSV content
      const csvContent =
        headers.join(',') +
        '\n' +
        rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      
      // Create and download CSV file using native browser APIs
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      const filename = `${context?.title || 'project'}_aantekeningen_${new Date().toISOString().split('T')[0]}.csv`;
      link.download = filename;
      link.click();
      // Revoke the object URL to prevent memory leaks
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Failed to export notes:', error);
      alert('Fout bij exporteren. Probeer het opnieuw.');
    }
  }

  // Get notes for a specific team (includes team notes and student notes for team members)
  const getNotesForTeam = (team: TeamInfo): ProjectNote[] => {
    return allNotes.filter(note => {
      // Include team notes for this team
      if (note.note_type === "team" && note.team_id === team.id) return true;
      // Include student notes for students in this team
      if (note.note_type === "student" && team.member_ids.includes(note.student_id || 0)) return true;
      return false;
    });
  };

  // Check if a team has search matches
  const teamHasSearchMatches = (team: TeamInfo): boolean => {
    if (!search && !searchOmza && !searchTeacher) return false;
    
    const teamNotes = getNotesForTeam(team);
    return teamNotes.some(note => {
      const matchesSearch = !search || 
        note.text.toLowerCase().includes(search.toLowerCase()) ||
        note.student_name?.toLowerCase().includes(search.toLowerCase()) ||
        team.members.some(m => m.toLowerCase().includes(search.toLowerCase()));
      const matchesOmza = !searchOmza || note.omza_category === searchOmza;
      const matchesTeacher = !searchTeacher || note.created_by_name === searchTeacher;
      return matchesSearch && matchesOmza && matchesTeacher;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Project laden...</p>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Project niet gevonden</p>
      </div>
    );
  }

  const responsibleTeacherId = context.settings?.responsible_teacher_id ?? null;

  // Derive unique teachers from all notes for the teacher filter
  const noteAuthors = Array.from(
    new Map(
      allNotes
        .filter(n => n.created_by_name)
        .map(n => [n.created_by, n.created_by_name as string])
    ).entries()
  ).map(([id, name]) => ({ id, name }));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* PAGE HEADER */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-5 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold text-gray-500 whitespace-nowrap">Aantekeningen –</span>
              <input
                ref={titleInputRef}
                type="text"
                value={editableTitle}
                onChange={(e) => setEditableTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
                disabled={isSavingTitle}
                className="text-lg md:text-2xl font-semibold tracking-tight text-gray-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-1 py-0.5 min-w-[8rem] w-full max-w-sm disabled:opacity-60"
                title="Klik om de projecttitel te bewerken"
                aria-label="Projecttitel"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 ml-1">
              <label className="text-xs text-slate-500 whitespace-nowrap">Verantwoordelijk docent:</label>
              <select
                value={responsibleTeacherId ?? ""}
                onChange={(e) => handleResponsibleTeacherChange(e.target.value)}
                className="text-xs bg-transparent border-b border-slate-300 focus:border-blue-500 focus:outline-none px-1 py-0.5 text-slate-700 cursor-pointer"
                aria-label="Verantwoordelijk docent"
              >
                <option value="">— kies docent —</option>
                {courseTeachers.map((t) => (
                  <option key={t.teacher_id} value={t.teacher_id}>
                    {t.teacher_name ?? `Docent ${t.teacher_id}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 md:self-center">
            <button 
              onClick={handleExport}
              className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Exporteren
            </button>
          </div>
        </header>
      </div>

      {/* PAGE CONTENT */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* FILTERS */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              placeholder="Zoek op naam of in aantekeningen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 max-w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 shadow-sm"
            />
            <select 
              value={searchOmza}
              onChange={(e) => setSearchOmza(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-slate-700"
            >
              <option value="">Alle OMZA-categorieën</option>
              {OMZA_CATEGORIES.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
            <select
              value={searchTeacher}
              onChange={(e) => setSearchTeacher(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-slate-700"
              aria-label="Filter op docent"
            >
              <option value="">Alle docenten</option>
              {noteAuthors.map(({ id, name }) => (
                <option key={id} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* TEAMS OVERVIEW */}
        <section className="space-y-6">
          {context.teams.map((team) => (
            <CombinedTeamCard
              key={team.id}
              contextId={Number(projectId)}
              team={team}
              students={context.students.filter(s => s.team_id === team.id)}
              notes={getNotesForTeam(team)}
              search={search}
              searchOmza={searchOmza}
              searchTeacher={searchTeacher}
              initialOpen={teamHasSearchMatches(team)}
              onNoteSaved={handleNoteSaved}
            />
          ))}
        </section>
      </main>
    </div>
  );
}
