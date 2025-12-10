"use client";

import Link from "next/link";
import { useNumericEvalId } from "@/utils";
import { useDashboardData } from "@/hooks";
import { Tile, Loading, ErrorMessage, TeamBadge, TeamFilter } from "@/components";
import { useState, useMemo, useEffect } from "react";
import { dashboardService } from "@/services/dashboard.service";
import { evaluationService } from "@/services/evaluation.service";
import type { EvaluationTeamContext } from "@/dtos/evaluation.dto";

function getStatusIcon(status: string): string {
  switch (status) {
    case "completed":
      return "🟢";
    case "partial":
      return "🟡";
    case "not_started":
      return "🔴";
    default:
      return "⚪";
  }
}

function formatLastActivity(dateStr?: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m geleden`;
  if (diffHours < 24) return `${diffHours}u geleden`;
  if (diffDays < 7) return `${diffDays}d geleden`;
  return date.toLocaleDateString("nl-NL");
}

function getFlagDescription(flag: string): string {
  const descriptions: Record<string, string> = {
    low_progress: "Lage voortgang (<30%)",
    no_activity: "Geen activiteit geregistreerd",
    inactive_7days: "Meer dan 7 dagen inactief",
    missing_peer_reviews: "Mist peer reviews (<50% ontvangen)",
    no_self_assessment: "Zelfbeoordeling niet gestart",
    no_reflection: "Reflectie niet ingeleverd",
  };
  return descriptions[flag] || flag;
}

type SortField =
  | "name"
  | "class"
  | "progress"
  | "last_activity"
  | "self_assessment"
  | "peer_reviews"
  | "reflection";
type SortDirection = "asc" | "desc";
type FilterType = "all" | "not_started" | "partial" | "completed";

export default function EvaluationDashboardPage() {
  const evalIdNum = useNumericEvalId();
  const { kpis, studentProgress, loading, error } =
    useDashboardData(evalIdNum ?? undefined);

  const evalId = evalIdNum?.toString() ?? "";

  // State for sorting and filtering
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filterType, setFilterType] = useState<FilterType>("all");

  // State for team context
  const [teamContext, setTeamContext] = useState<EvaluationTeamContext | null>(null);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<number | null>(null);

  // Load team context
  useEffect(() => {
    if (!evalIdNum) return;
    
    const controller = new AbortController();
    
    async function loadTeams() {
      try {
        const context = await evaluationService.getEvaluationTeams(
          evalIdNum,
          controller.signal
        );
        setTeamContext(context);
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Failed to load team context:', error);
        }
      }
    }
    
    loadTeams();
    
    return () => controller.abort();
  }, [evalIdNum]);

  // Map user IDs to team numbers for quick lookup
  const userTeamMap = useMemo(() => {
    if (!teamContext) return new Map<number, number>();
    
    const map = new Map<number, number>();
    teamContext.teams.forEach((team) => {
      team.members.forEach((member) => {
        map.set(member.user_id, team.team_number);
      });
    });
    return map;
  }, [teamContext]);

  // Filtered and sorted students
  const filteredStudents = useMemo(() => {
    if (!studentProgress?.items) return [];

    let filtered = [...studentProgress.items];

    // Apply status filter
    if (filterType === "completed") {
      filtered = filtered.filter((s) => s.total_progress_percent === 100);
    } else if (filterType === "partial") {
      filtered = filtered.filter(
        (s) => s.total_progress_percent > 0 && s.total_progress_percent < 100,
      );
    } else if (filterType === "not_started") {
      filtered = filtered.filter((s) => s.total_progress_percent === 0);
    }

    // Apply team filter
    if (selectedTeamFilter !== null && userTeamMap.size > 0) {
      filtered = filtered.filter((s) => userTeamMap.get(s.user_id) === selectedTeamFilter);
    }

    // Apply sort
    filtered.sort((a, b) => {
      let aVal: any = 0;
      let bVal: any = 0;

      switch (sortField) {
        case "name":
          aVal = a.user_name.toLowerCase();
          bVal = b.user_name.toLowerCase();
          break;
        case "class":
          aVal = a.class_name || "";
          bVal = b.class_name || "";
          break;
        case "progress":
          aVal = a.total_progress_percent;
          bVal = b.total_progress_percent;
          break;
        case "last_activity":
          aVal = a.last_activity ? new Date(a.last_activity).getTime() : 0;
          bVal = b.last_activity ? new Date(b.last_activity).getTime() : 0;
          break;
        case "self_assessment":
          aVal =
            a.self_assessment_status === "completed"
              ? 2
              : a.self_assessment_status === "partial"
                ? 1
                : 0;
          bVal =
            b.self_assessment_status === "completed"
              ? 2
              : b.self_assessment_status === "partial"
                ? 1
                : 0;
          break;
        case "peer_reviews":
          aVal = a.peer_reviews_given;
          bVal = b.peer_reviews_given;
          break;
        case "reflection":
          aVal = a.reflection_status === "completed" ? 1 : 0;
          bVal = b.reflection_status === "completed" ? 1 : 0;
          break;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [studentProgress, filterType, selectedTeamFilter, userTeamMap, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleExportCSV = async () => {
    if (!evalIdNum) return;
    try {
      const blob = await dashboardService.exportProgressCSV(evalIdNum);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `evaluation_${evalIdNum}_progress.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error("Export failed:", e);
      alert("Export mislukte. Probeer het opnieuw.");
    }
  };

  const handleSendReminders = async () => {
    if (!evalIdNum) return;
    if (!confirm("Weet je zeker dat je herinneringen wilt versturen naar alle studenten met onvolledige taken?")) {
      return;
    }
    try {
      const result = await dashboardService.sendReminders(evalIdNum);
      alert(
        `${result.message}\n\n` +
        `Aantal studenten: ${result.reminders_sent}\n` +
        `(Email functionaliteit wordt nog geïmplementeerd)`
      );
    } catch (e) {
      console.error("Send reminders failed:", e);
      alert("Versturen van herinneringen mislukt. Probeer het opnieuw.");
    }
  };

  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <>
      {!loading && !error && (
        <>
          {/* KPI tiles */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Tile label="Self-reviews" value={kpis?.selfreviews_present ?? 0} />
          <Tile label="Peer-reviews" value={kpis?.reviewers_total ?? 0} />
          <Tile label="Reflecties" value={kpis?.reflections_count ?? 0} />
          <Tile label="Totaal studenten" value={kpis?.students_total ?? 0} />
        </section>

          {/* Teams Overview Card */}
          {teamContext && teamContext.teams.length > 0 && (
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                Teams Overzicht
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {teamContext.teams.map((team) => (
                  <div key={team.team_id} className="p-4 border border-slate-200 rounded-lg">
                    <TeamBadge teamNumber={team.team_number} displayName={team.display_name} />
                    <div className="mt-2 text-sm text-slate-600">
                      {team.member_count} leden
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {team.members.filter(m => m.is_allocated).length} toegewezen
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Student Progress Table */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Voortgang per leerling
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={handleSendReminders}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium shadow-sm"
                >
                  ✉️ Stuur herinnering
                </button>
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 text-sm font-medium shadow-sm"
                >
                  📥 Export naar CSV
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 items-center flex-wrap">
              <label className="text-sm font-medium text-slate-600">Filter:</label>
              <button
                onClick={() => setFilterType("all")}
                className={`px-3 py-1 rounded-lg text-sm ${
                  filterType === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 hover:bg-slate-200"
                }`}
              >
                Alle leerlingen
              </button>
              <button
                onClick={() => setFilterType("not_started")}
                className={`px-3 py-1 rounded-lg text-sm ${
                  filterType === "not_started"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 hover:bg-slate-200"
                }`}
              >
                Niet gestart
              </button>
              <button
                onClick={() => setFilterType("partial")}
                className={`px-3 py-1 rounded-lg text-sm ${
                  filterType === "partial"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 hover:bg-slate-200"
                }`}
              >
                Deels voltooid
              </button>
              <button
                onClick={() => setFilterType("completed")}
                className={`px-3 py-1 rounded-lg text-sm ${
                  filterType === "completed"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 hover:bg-slate-200"
                }`}
              >
                Voltooid
              </button>
              
              {/* Team filter */}
              {teamContext && teamContext.teams.length > 0 && (
                <>
                  <div className="mx-2 h-6 w-px bg-slate-300"></div>
                  <TeamFilter
                    teams={teamContext.teams.map(t => ({
                      teamNumber: t.team_number,
                      displayName: t.display_name,
                      memberCount: t.member_count,
                    }))}
                    selectedTeam={selectedTeamFilter}
                    onTeamChange={setSelectedTeamFilter}
                  />
                </>
              )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th
                        className="px-5 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center gap-1">
                          Naam
                          {sortField === "name" && (
                            <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-5 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort("class")}
                      >
                        <div className="flex items-center gap-1">
                          Klas
                          {sortField === "class" && (
                            <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      {teamContext && teamContext.teams.length > 0 && (
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide">
                          Team
                        </th>
                      )}
                      <th
                        className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort("self_assessment")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Zelfbeoordeling
                          {sortField === "self_assessment" && (
                            <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort("peer_reviews")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Peer reviews
                          {sortField === "peer_reviews" && (
                            <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort("reflection")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Reflectie
                          {sortField === "reflection" && (
                            <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort("progress")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Totaal %
                          {sortField === "progress" && (
                            <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort("last_activity")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Laatste activiteit
                          {sortField === "last_activity" && (
                            <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">
                        Signaal
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={teamContext && teamContext.teams.length > 0 ? 9 : 8} className="px-4 py-8 text-center text-slate-500">
                          Geen studenten gevonden
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((student) => (
                        <tr key={student.user_id} className="bg-white hover:bg-slate-50">
                          <td className="px-5 py-3 text-sm text-slate-800 font-medium">
                            {student.user_name}
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-600">
                            {student.class_name || "-"}
                          </td>
                          {teamContext && teamContext.teams.length > 0 && (
                            <td className="px-4 py-3 text-sm">
                              {userTeamMap.get(student.user_id) ? (
                                <TeamBadge teamNumber={userTeamMap.get(student.user_id)!} size="sm" />
                              ) : (
                                <span className="text-gray-400 text-xs">Geen team</span>
                              )}
                            </td>
                          )}
                          <td className="px-4 py-3 text-center text-lg">
                            {getStatusIcon(student.self_assessment_status)}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-slate-800">
                            {student.peer_reviews_given}/
                            {student.peer_reviews_given_expected}
                          </td>
                          <td className="px-4 py-3 text-center text-lg">
                            {getStatusIcon(student.reflection_status)}
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-medium text-slate-900">
                            {student.total_progress_percent}%
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-slate-600">
                            {formatLastActivity(student.last_activity)}
                          </td>
                          <td className="px-4 py-3 text-center text-sm">
                            {student.flags.length > 0 ? (
                              <span
                                className="cursor-help text-lg"
                                title={student.flags.map(getFlagDescription).join("\n• ")}
                              >
                                ⚠️ {student.flags.length}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}

      {loading && <Loading />}
      {error && <ErrorMessage message={error} />}

      {evalIdNum == null && (
        <p className="text-sm text-slate-500">
          Geen geldige evaluatie geselecteerd. Open het dashboard via een
          bestaande evaluatie.
        </p>
      )}
    </>
  );
}
