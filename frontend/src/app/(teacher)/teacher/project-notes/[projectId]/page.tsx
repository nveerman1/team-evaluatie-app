"use client";

import { useState, useEffect, useCallback } from "react";
import { use } from "react";
import { CombinedTeamCard } from "./_components/CombinedTeamCard";
import { projectNotesService } from "@/services";
import { ProjectNotesContextDetail, ProjectNote, TeamInfo } from "@/dtos/project-notes.dto";

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
  
  // Filter states
  const [search, setSearch] = useState<string>("");
  const [searchOmza, setSearchOmza] = useState<string>("");

  const loadContext = useCallback(async () => {
    try {
      setLoading(true);
      const data = await projectNotesService.getContext(Number(projectId));
      setContext(data);
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

  async function handleExport() {
    try {
      const notes = await projectNotesService.listNotes(Number(projectId));
      const XLSX = await import('xlsx');
      
      const exportData = notes.map(note => ({
        'Datum': new Date(note.created_at).toLocaleDateString('nl-NL'),
        'Type': note.note_type === 'project' ? 'Project' : note.note_type === 'team' ? 'Team' : 'Student',
        'Team': note.team_name || '-',
        'Student': note.student_name || '-',
        'OMZA Categorie': note.omza_category || '-',
        'Eindterm': note.learning_objective_title || '-',
        'Tags': note.tags.join(', '),
        'Aantekening': note.text,
        'Competentiebewijs': note.is_competency_evidence ? 'Ja' : 'Nee',
        'Portfolio': note.is_portfolio_evidence ? 'Ja' : 'Nee',
      }));
      
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Aantekeningen');
      
      const filename = `${context?.title || 'project'}_aantekeningen_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
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
    if (!search && !searchOmza) return false;
    
    const teamNotes = getNotesForTeam(team);
    return teamNotes.some(note => {
      const matchesSearch = !search || 
        note.text.toLowerCase().includes(search.toLowerCase()) ||
        note.student_name?.toLowerCase().includes(search.toLowerCase()) ||
        team.members.some(m => m.toLowerCase().includes(search.toLowerCase()));
      const matchesOmza = !searchOmza || note.omza_category === searchOmza;
      return matchesSearch && matchesOmza;
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

  const projectTitle = context.title;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* PAGE HEADER */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              Aantekeningen – {projectTitle}
            </h1>
            <p className="text-gray-600 mt-1 text-sm max-w-xl">
              Centrale plek voor observaties, snelnotities en koppeling aan OMZA
            </p>
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
              initialOpen={teamHasSearchMatches(team)}
              onNoteSaved={handleNoteSaved}
            />
          ))}
        </section>
      </main>
    </div>
  );
}
