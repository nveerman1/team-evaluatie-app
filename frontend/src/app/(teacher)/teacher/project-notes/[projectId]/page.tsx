"use client";

import { useState, useEffect, useCallback } from "react";
import { use } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CombinedTeamCard } from "./_components/CombinedTeamCard";
import { projectNotesService, courseService } from "@/services";
import {
  ProjectNotesContextDetail,
  ProjectNote,
  TeamInfo,
} from "@/dtos/project-notes.dto";
import { TeacherCourse } from "@/dtos/course.dto";
import { useTeacherLayout } from "@/app/(teacher)/layout";

// OMZA categories
const OMZA_CATEGORIES = [
  "Organiseren",
  "Meedoen",
  "Zelfvertrouwen",
  "Autonomie",
];

interface TeamMeta {
  title?: string;
  responsible_teacher_id?: number | null;
}

export default function ProjectNotesDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  const [context, setContext] = useState<ProjectNotesContextDetail | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [allNotes, setAllNotes] = useState<ProjectNote[]>([]);
  const [courseTeachers, setCourseTeachers] = useState<TeacherCourse[]>([]);

  // Active team selection
  const [activeTeamId, setActiveTeamId] = useState<number | null>(null);
  // Live title overrides – updated on every keystroke so tiles stay in sync while typing
  const [liveTeamTitles, setLiveTeamTitles] = useState<Record<string, string>>({});

  // Teams panel open/close – auto-opens on load to immediately show focus mode with team selection
  const [teamsOpen, setTeamsOpen] = useState(true);
  const { setSidebarCollapsed, setOnSidebarIconClick } = useTeacherLayout();

  // Filter states
  const [search, setSearch] = useState<string>("");
  const [searchOmza, setSearchOmza] = useState<string>("");
  // Filter by responsible teacher (teacher_id as string, "" = all)
  const [searchTeacher, setSearchTeacher] = useState<string>("");

  const loadContext = useCallback(async () => {
    try {
      setLoading(true);
      const data = await projectNotesService.getContext(Number(projectId));
      setContext(data);
      // Load teachers for the course if available
      if (data.course_id) {
        try {
          const teachers = await courseService.getCourseTeachers(
            data.course_id,
          );
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

  // Select the first team once context has loaded
  useEffect(() => {
    if (context?.teams.length && activeTeamId === null) {
      setActiveTeamId(context.teams[0].id);
    }
  }, [context, activeTeamId]);

  // Collapse / restore the left navigation sidebar when the teams panel is open,
  // using the same pattern as the assessment page (useTeacherLayout + setSidebarCollapsed).
  useEffect(() => {
    setSidebarCollapsed(teamsOpen);
    return () => {
      setSidebarCollapsed(false);
    };
  }, [teamsOpen, setSidebarCollapsed]);

  useEffect(() => {
    const exitFocus = () => setTeamsOpen(false);
    setOnSidebarIconClick(() => exitFocus);
    return () => {
      setOnSidebarIconClick(undefined);
    };
  }, [setOnSidebarIconClick]);

  const handleNoteSaved = useCallback(() => {
    loadAllNotes();
  }, [loadAllNotes]);

  /**
   * Called by CombinedTeamCard when a team's title or responsible teacher changes.
   * Persists the updated team_metadata to context.settings via the API.
   */
  const handleTeamMetaChange = useCallback(
    async (
      teamId: number,
      patch: { title?: string; responsibleTeacherId?: number | null },
    ) => {
      if (!context) return;
      const current = (context.settings?.team_metadata ?? {}) as Record<
        string,
        TeamMeta
      >;
      const key = String(teamId);
      const updated = {
        ...context.settings,
        team_metadata: {
          ...current,
          [key]: {
            ...current[key],
            ...(patch.title !== undefined ? { title: patch.title } : {}),
            ...(patch.responsibleTeacherId !== undefined
              ? { responsible_teacher_id: patch.responsibleTeacherId }
              : {}),
          },
        },
      };
    try {
      await projectNotesService.updateContext(Number(projectId), { settings: updated });
      setContext(prev => prev ? { ...prev, settings: updated } : prev);
      // Clear the live override now that the saved value is in sync
      if (patch.title !== undefined) {
        setLiveTeamTitles(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    } catch (error) {
      console.error("Failed to save team metadata:", error);
    }
  }, [context, projectId]);

  /** Called on every keystroke in the title field so tiles stay in sync while typing */
  const handleTitleLiveChange = useCallback((teamId: number, title: string) => {
    setLiveTeamTitles(prev => ({ ...prev, [String(teamId)]: title }));
  }, []);

  async function handleExport() {
    try {
      const notes = await projectNotesService.listNotes(Number(projectId));

      // Prepare CSV headers
      const headers = [
        "Datum",
        "Type",
        "Team",
        "Student",
        "OMZA Categorie",
        "Eindterm",
        "Tags",
        "Aantekening",
        "Competentiebewijs",
        "Portfolio",
      ];

      // Prepare CSV rows
      const rows = notes.map((note) => [
        new Date(note.created_at).toLocaleDateString("nl-NL"),
        note.note_type === "project"
          ? "Project"
          : note.note_type === "team"
            ? "Team"
            : "Student",
        note.team_name || "-",
        note.student_name || "-",
        note.omza_category || "-",
        note.learning_objective_title || "-",
        note.tags.join(", "),
        note.text,
        note.is_competency_evidence ? "Ja" : "Nee",
        note.is_portfolio_evidence ? "Ja" : "Nee",
      ]);

      // Create CSV content
      const csvContent =
        headers.join(",") +
        "\n" +
        rows
          .map((row) =>
            row
              .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
              .join(","),
          )
          .join("\n");

      // Create and download CSV file using native browser APIs
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.href = url;
      const filename = `${context?.title || "project"}_aantekeningen_${new Date().toISOString().split("T")[0]}.csv`;
      link.download = filename;
      link.click();
      // Revoke the object URL to prevent memory leaks
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Failed to export notes:", error);
      alert("Fout bij exporteren. Probeer het opnieuw.");
    }
  }

  // Get notes for a specific team (includes team notes and student notes for team members)
  const getNotesForTeam = (team: TeamInfo): ProjectNote[] => {
    return allNotes.filter((note) => {
      // Include team notes for this team
      if (note.note_type === "team" && note.team_id === team.id) return true;
      // Include student notes for students in this team
      if (
        note.note_type === "student" &&
        team.member_ids.includes(note.student_id || 0)
      )
        return true;
      return false;
    });
  };

  // Returns true when the team should be initially expanded due to search/filter matches
  const teamHasSearchMatches = (team: TeamInfo): boolean => {
    if (!search && !searchOmza) return false;

    // Match against the team's saved project title
    const teamMeta = (context?.settings?.team_metadata ?? {}) as Record<
      string,
      TeamMeta
    >;
    const savedTitle = teamMeta[String(team.id)]?.title ?? "";
    if (search && savedTitle.toLowerCase().includes(search.toLowerCase()))
      return true;

    const teamNotes = getNotesForTeam(team);
    return teamNotes.some((note) => {
      const matchesSearch =
        !search ||
        note.text.toLowerCase().includes(search.toLowerCase()) ||
        note.student_name?.toLowerCase().includes(search.toLowerCase()) ||
        team.members.some((m) =>
          m.toLowerCase().includes(search.toLowerCase()),
        );
      const matchesOmza = !searchOmza || note.omza_category === searchOmza;
      return matchesSearch && matchesOmza;
    });
  };

  // Returns true when the team card should be hidden due to teacher filter
  const teamMatchesTeacherFilter = (team: TeamInfo): boolean => {
    if (!searchTeacher) return true;
    const teamMeta = (context?.settings?.team_metadata ?? {}) as Record<
      string,
      TeamMeta
    >;
    const meta = teamMeta[String(team.id)];
    const responsibleId = meta?.responsible_teacher_id;
    if (responsibleId == null) return false;
    return String(responsibleId) === searchTeacher;
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

  // Per-team metadata from settings
  const teamMetadata = (context.settings?.team_metadata ?? {}) as Record<
    string,
    TeamMeta
  >;

  // Apply filters to determine which teams are visible
  const filteredTeams = context.teams.filter(team =>
    teamMatchesTeacherFilter(team) &&
    ((!search && !searchOmza) || teamHasSearchMatches(team))
  );

  // Derive active team – fall back to first visible team if the selected one is filtered out
  const activeTeam =
    filteredTeams.find(t => t.id === activeTeamId) ??
    filteredTeams[0] ??
    null;

  // Navigation between filtered teams
  const activeTeamIndex = activeTeam ? filteredTeams.findIndex(t => t.id === activeTeam.id) : -1;
  const canGoPrev = activeTeamIndex > 0;
  const canGoNext = activeTeamIndex >= 0 && activeTeamIndex < filteredTeams.length - 1;

  /** Get the tile-display title: use the live (unsaved) value while typing, otherwise the saved one */
  const getTileTitle = (teamId: number): string => {
    const live = liveTeamTitles[String(teamId)];
    if (live !== undefined) return live;
    return teamMetadata[String(teamId)]?.title ?? "";
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* PAGE HEADER */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              Aantekeningen – {context.title}
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
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* FILTERS */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => setTeamsOpen(v => !v)}
              className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                teamsOpen
                  ? "border-sky-300 bg-sky-50 text-sky-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Teams {teamsOpen ? "▴" : "▾"}
            </button>
            <button
              onClick={() => setActiveTeamId(filteredTeams[activeTeamIndex - 1].id)}
              disabled={!canGoPrev}
              aria-label="Vorig team"
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTeamId(filteredTeams[activeTeamIndex + 1].id)}
              disabled={!canGoNext}
              aria-label="Volgend team"
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <input
              type="text"
              placeholder="Zoek op projecttitel, naam of in aantekeningen..."
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
              {courseTeachers.map((t) => (
                <option key={t.teacher_id} value={String(t.teacher_id)}>
                  {t.teacher_name ?? `Docent ${t.teacher_id}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* SPLIT LAYOUT – only visible when Teams panel is open */}
        {teamsOpen ? (
          <div className="grid gap-5 xl:grid-cols-[280px_minmax(720px,1fr)]">

            {/* LEFT COLUMN: compact team selection panel */}
            <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm self-start">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Teams</h2>
                <span className="text-xs text-slate-400">{filteredTeams.length}</span>
              </div>
              {filteredTeams.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Geen teams gevonden</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filteredTeams.map(team => {
                    const teamLabel = team.team_number ? `Team ${team.team_number}` : team.name;
                    const tileTitle = getTileTitle(team.id);
                    const firstNames = team.members.map(m => m.split(" ")[0]).join(" · ");
                    const isActive = activeTeam?.id === team.id;
                    return (
                      <button
                        key={team.id}
                        onClick={() => setActiveTeamId(team.id)}
                        className={`rounded-xl border px-3 py-2.5 text-left transition ${
                          isActive
                            ? "border-sky-300 bg-sky-50 shadow-sm"
                            : "border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className={`text-sm font-semibold truncate ${isActive ? "text-sky-800" : "text-slate-800"}`}>
                          {teamLabel}
                        </div>
                        {tileTitle && (
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">{tileTitle}</div>
                        )}
                        <div className="mt-1 text-[10px] text-slate-400 truncate">{firstNames}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>

            {/* RIGHT COLUMN: active team card */}
            {activeTeam ? (
              <CombinedTeamCard
                key={activeTeam.id}
                contextId={Number(projectId)}
                team={activeTeam}
                students={context.students.filter(s => s.team_id === activeTeam.id)}
                notes={getNotesForTeam(activeTeam)}
                search={search}
                searchOmza={searchOmza}
                courseTeachers={courseTeachers}
                teamTitle={teamMetadata[String(activeTeam.id)]?.title ?? ""}
                teamResponsibleTeacherId={teamMetadata[String(activeTeam.id)]?.responsible_teacher_id ?? null}
                onTeamMetaChange={handleTeamMetaChange}
                onTitleLiveChange={handleTitleLiveChange}
                onNoteSaved={handleNoteSaved}
              />
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex items-center justify-center py-16">
                <p className="text-slate-500 text-sm">Geen teams beschikbaar</p>
              </div>
            )}

          </div>
        ) : (
          /* Single-column view: active team card full-width */
          activeTeam ? (
            <CombinedTeamCard
              key={activeTeam.id}
              contextId={Number(projectId)}
              team={activeTeam}
              students={context.students.filter(s => s.team_id === activeTeam.id)}
              notes={getNotesForTeam(activeTeam)}
              search={search}
              searchOmza={searchOmza}
              courseTeachers={courseTeachers}
              teamTitle={teamMetadata[String(activeTeam.id)]?.title ?? ""}
              teamResponsibleTeacherId={teamMetadata[String(activeTeam.id)]?.responsible_teacher_id ?? null}
              onTeamMetaChange={handleTeamMetaChange}
              onTitleLiveChange={handleTitleLiveChange}
              onNoteSaved={handleNoteSaved}
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex items-center justify-center py-16">
              <p className="text-slate-500 text-sm">Geen teams beschikbaar</p>
            </div>
          )
        )}
      </main>
    </div>
  );
}
