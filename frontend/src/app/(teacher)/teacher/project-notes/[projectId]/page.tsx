"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import { SidebarTab } from "./_components/SidebarTab";
import { ProjectNotesCard } from "./_components/ProjectNotesCard";
import { TeamNotesCard } from "./_components/TeamNotesCard";
import { StudentNotesCard } from "./_components/StudentNotesCard";
import { TimelineCard } from "./_components/TimelineCard";
import { projectNotesService } from "@/services";
import { ProjectNotesContextDetail } from "@/dtos/project-notes.dto";

type TabKey = "project" | "teams" | "students" | "timeline";

export default function ProjectNotesDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  
  const [context, setContext] = useState<ProjectNotesContextDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("teams");
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [quickNoteText, setQuickNoteText] = useState<string>("");
  
  // Filter states
  const [searchText, setSearchText] = useState<string>("");
  const [searchName, setSearchName] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterLearningObjective, setFilterLearningObjective] = useState<string>("");

  useEffect(() => {
    loadContext();
  }, [projectId]);

  // Automatically switch to timeline view when search or filter is used
  useEffect(() => {
    if (searchText || searchName || filterCategory || filterLearningObjective) {
      setActiveTab("timeline");
    }
  }, [searchText, searchName, filterCategory, filterLearningObjective]);

  const loadContext = async () => {
    try {
      setLoading(true);
      const data = await projectNotesService.getContext(Number(projectId));
      setContext(data);
      
      // Set default selections
      if (data.teams.length > 0 && !selectedTeamId) {
        setSelectedTeamId(data.teams[0].id);
      }
      if (data.students.length > 0 && !selectedStudentId) {
        setSelectedStudentId(data.students[0].id);
      }
    } catch (error) {
      console.error("Failed to load project context:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedTeam = context?.teams.find((t) => t.id === selectedTeamId) ?? context?.teams[0];
  const selectedStudent = context?.students.find((s) => s.id === selectedStudentId);

  function handleSelectTeam(id: number) {
    setSelectedTeamId(id);
    setActiveTab("teams");
  }

  function handleSelectStudent(id: number) {
    setSelectedStudentId(id);
    setActiveTab("students");
  }

  function handleQuickNoteClick(template: string) {
    setQuickNoteText(template);
  }

  async function handleExport() {
    try {
      // Get all notes from the context
      const notes = await projectNotesService.listNotes(Number(projectId));
      
      // Import XLSX dynamically
      const XLSX = await import('xlsx');
      
      // Prepare data for export
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
      
      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Aantekeningen');
      
      // Generate filename with project title and date
      const filename = `${context?.title || 'project'}_aantekeningen_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Download file
      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error('Failed to export notes:', error);
      alert('Fout bij exporteren. Probeer het opnieuw.');
    }
  }

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
    <>
      {/* PAGE HEADER */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              Aantekeningen – Project &quot;{projectTitle}&quot;
            </h1>
            <p className="text-gray-600 mt-1 text-sm max-w-xl">
              Centrale plek voor observaties, snelnotities en koppeling aan OMZA, rubrics en competenties.
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
      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          {/* BOVENSTE RIJ: filters + quick note context */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4 md:mb-6">
            {/* Filters & search */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Zoek in aantekeningen..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-64 max-w-full rounded-xl border border-gray-200/80 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-500 shadow-sm"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400 text-[11px]">
                  ⌘K
                </span>
              </div>

              {/* Zoek op naam */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Zoek op naam..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="w-52 max-w-full rounded-xl border border-gray-200/80 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500 shadow-sm"
                />
              </div>

              <select 
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="rounded-xl border border-gray-200/80 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/70"
              >
                <option value="">Alle categorieën</option>
                <option value="Organiseren">Organiseren</option>
                <option value="Meedoen">Meedoen</option>
                <option value="Zelfvertrouwen">Zelfvertrouwen</option>
                <option value="Autonomie">Autonomie</option>
                <option value="Projectproces">Projectproces</option>
                <option value="Eindresultaat">Eindresultaat</option>
                <option value="Communicatie">Communicatie</option>
              </select>

              <select 
                value={filterLearningObjective}
                onChange={(e) => setFilterLearningObjective(e.target.value)}
                className="rounded-xl border border-gray-200/80 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/70"
              >
                <option value="">Alle eindtermen</option>
                <option value="Domein A">Domein A – Vaardig handelen</option>
                <option value="Domein C">Domein C – Denkwijzen</option>
                <option value="Domein F">Domein F – Zelfregulatie</option>
              </select>
            </div>
          </div>

          {/* LAYOUT: sidebar (weergave) + content */}
          <div className="flex gap-4 md:gap-6">
            {/* LOKALE SIDEBAR: weergave voor dit project */}
            <aside className="w-64 shrink-0 space-y-4">
              <div className="rounded-xl bg-white border border-gray-200/80 shadow-sm p-2">
                <p className="px-2 pt-1 pb-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  Weergave
                </p>
                <div className="flex flex-col gap-1">
                  <SidebarTab
                    label="Project"
                    description="Projectbrede aantekeningen"
                    active={activeTab === "project"}
                    onClick={() => setActiveTab("project")}
                  />
                  <SidebarTab
                    label="Teams"
                    description="Checklists, snelnotities & observaties per team"
                    active={activeTab === "teams"}
                    onClick={() => setActiveTab("teams")}
                  />
                  <SidebarTab
                    label="Leerlingen"
                    description="Individuele dossiers & competentiebewijs"
                    active={activeTab === "students"}
                    onClick={() => setActiveTab("students")}
                  />
                  <SidebarTab
                    label="Tijdlijn"
                    description="Chronologisch logboek van alle observaties"
                    active={activeTab === "timeline"}
                    onClick={() => setActiveTab("timeline")}
                  />
                </div>
              </div>

              {/* Teams als dropdown */}
              {context.teams.length > 0 && (
                <div className="rounded-xl bg-white border border-gray-200/80 shadow-sm p-3">
                  <p className="px-1 text-xs uppercase tracking-[0.16em] text-slate-500 mb-2">Teamselectie</p>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-500"
                    value={selectedTeamId || ''}
                    onChange={(e) => handleSelectTeam(Number(e.target.value))}
                  >
                    {context.teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.team_number ? `Team ${team.team_number}` : team.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Leerlingenlijst in sidebar - filtered by selected team */}
              {selectedTeamId && context.students.filter(s => s.team_id === selectedTeamId).length > 0 && (
                <div className="rounded-xl bg-white border border-gray-200/80 shadow-sm p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 px-1 mb-2">
                    Leerlingen in dit team
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {context.students
                      .filter((student) => student.team_id === selectedTeamId)
                      .map((student) => (
                        <button
                          key={student.id}
                          onClick={() => handleSelectStudent(student.id)}
                          className={`w-full text-left rounded-xl px-3 py-2 text-xs transition border ${
                            selectedStudentId === student.id
                              ? "bg-slate-900 text-slate-50 border-slate-900 shadow-sm"
                              : "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100"
                          }`}
                        >
                          <p className="font-medium text-[13px]">{student.name}</p>
                          <p className="text-[11px] opacity-80">{student.team_name || 'Geen team'}</p>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </aside>

            {/* CONTENT: aantekeningen-secties */}
            <section className="flex-1 space-y-4 md:space-y-6">
              {activeTab === "project" && (
                <ProjectNotesCard 
                  contextId={Number(projectId)} 
                  searchText={searchText}
                />
              )}

              {activeTab === "teams" && selectedTeam && (
                <TeamNotesCard
                  contextId={Number(projectId)}
                  team={selectedTeam}
                  quickNoteText={quickNoteText}
                  onQuickNoteTextChange={setQuickNoteText}
                  onQuickNoteClick={handleQuickNoteClick}
                  onSelectStudent={handleSelectStudent}
                  searchText={searchText}
                  filterCategory={filterCategory}
                />
              )}

              {activeTab === "students" && selectedStudent && (
                <StudentNotesCard
                  contextId={Number(projectId)}
                  selectedStudent={selectedStudent}
                  searchText={searchText}
                  filterCategory={filterCategory}
                />
              )}

              {activeTab === "timeline" && (
                <TimelineCard 
                  contextId={Number(projectId)} 
                  searchText={searchText}
                  searchName={searchName}
                  filterCategory={filterCategory}
                />
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
