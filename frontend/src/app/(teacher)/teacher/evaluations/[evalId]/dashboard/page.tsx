"use client";

import { useNumericEvalId } from "@/utils";
import { useDashboardData } from "@/hooks";
import {
  Loading,
  ErrorMessage,
} from "@/components";
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

type SortField =
  | "team"
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
  const { studentProgress, flags: flagsData, preview, loading, error } = useDashboardData(
    evalIdNum ?? undefined,
  );

  // State for sorting and filtering
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // State for team context
  const [teamContext, setTeamContext] = useState<EvaluationTeamContext | null>(
    null,
  );

  // Load team context
  useEffect(() => {
    if (!evalIdNum) return;

    const controller = new AbortController();
    const currentEvalId = evalIdNum; // Capture the value to ensure type safety

    async function loadTeams() {
      try {
        const context = await evaluationService.getEvaluationTeams(
          currentEvalId,
          controller.signal,
        );
        setTeamContext(context);
      } catch (error: any) {
        if (
          error.name !== "AbortError" &&
          error.name !== "CanceledError" &&
          error.message !== "canceled"
        ) {
          console.error("Failed to load team context:", error);
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

  // Maps for assessment-style signals (SPR and given_avg_pct)
  const sprMap = useMemo(() => {
    const map = new Map<number, number>();
    flagsData.forEach((f) => map.set(f.user_id, f.spr));
    return map;
  }, [flagsData]);

  const previewMap = useMemo(() => {
    const map = new Map<number, { given_avg_pct?: number | null; team_given_avg?: number | null }>();
    preview?.items.forEach((item) => map.set(item.user_id, { given_avg_pct: item.given_avg_pct, team_given_avg: item.team_given_avg }));
    return map;
  }, [preview]);

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

    // Apply search filter (by name or team number)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((s) => {
        const nameMatch = s.user_name.toLowerCase().includes(query);
        const teamNum = userTeamMap.get(s.user_id);
        const teamMatch = teamNum != null && teamNum.toString().includes(query);
        return nameMatch || teamMatch;
      });
    }

    // Apply sort
    filtered.sort((a, b) => {
      let aVal: any = 0;
      let bVal: any = 0;

      switch (sortField) {
        case "team":
          aVal = userTeamMap.get(a.user_id) ?? 0;
          bVal = userTeamMap.get(b.user_id) ?? 0;
          break;
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
  }, [
    studentProgress,
    filterType,
    searchQuery,
    userTeamMap,
    sortField,
    sortDirection,
  ]);

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
    if (
      !confirm(
        "Weet je zeker dat je herinneringen wilt versturen naar alle studenten met onvolledige taken?",
      )
    ) {
      return;
    }
    try {
      const result = await dashboardService.sendReminders(evalIdNum);
      alert(
        `${result.message}\n\n` +
          `Aantal studenten: ${result.reminders_sent}\n` +
          `(Email functionaliteit wordt nog geïmplementeerd)`,
      );
    } catch (e) {
      console.error("Send reminders failed:", e);
      alert("Versturen van herinneringen mislukt. Probeer het opnieuw.");
    }
  };

  return (
    <>
      {!loading && !error && (
        <>
          {/* Student Progress Table */}
          <section className="space-y-3">
            {/* Filters + action buttons in one row */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex flex-wrap gap-3 items-center">
                <input
                  className="h-9 w-56 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Zoek op teamnummer of naam..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select
                  className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as FilterType)}
                >
                  <option value="all">Alle leerlingen</option>
                  <option value="not_started">🔴 Niet gestart</option>
                  <option value="partial">🟡 Deels voltooid</option>
                  <option value="completed">🟢 Voltooid</option>
                </select>
              </div>

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

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                   <thead className="bg-slate-50">
                    <tr>
                      {teamContext && teamContext.teams.length > 0 && (
                        <th
                          className="px-5 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide cursor-pointer hover:bg-slate-100"
                          onClick={() => handleSort("team")}
                        >
                          <div className="flex items-center gap-1">
                            Team
                            {sortField === "team" && (
                              <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                            )}
                          </div>
                        </th>
                      )}
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
                        <td
                          colSpan={
                            teamContext && teamContext.teams.length > 0 ? 9 : 8
                          }
                          className="px-4 py-8 text-center text-slate-500"
                        >
                          Geen studenten gevonden
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((student) => (
                        <tr
                          key={student.user_id}
                          className="bg-white hover:bg-slate-50"
                        >
                          {teamContext && teamContext.teams.length > 0 && (
                            <td className="px-4 py-3 text-sm">
                              {userTeamMap.get(student.user_id) != null ? (
                                <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                  {userTeamMap.get(student.user_id)}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">
                                  —
                                </span>
                              )}
                            </td>
                          )}
                          <td className="px-5 py-3 text-sm text-slate-800 font-medium">
                            {student.user_name}
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-600">
                            {student.class_name || "-"}
                          </td>
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
                            {(() => {
                              const spr = sprMap.get(student.user_id);
                              const prev = previewMap.get(student.user_id);
                              const hasSprHigh = spr != null && spr > 1.20;
                              const hasSprLow = spr != null && spr < 0.80 && spr > 0;
                              const hasLowGiven =
                                prev?.given_avg_pct != null &&
                                prev?.team_given_avg != null &&
                                prev.given_avg_pct < prev.team_given_avg * 0.70;

                              if (!hasSprHigh && !hasSprLow && !hasLowGiven) {
                                return <span>-</span>;
                              }
                              return (
                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                  {hasSprHigh && (
                                    <span
                                      className="cursor-default text-sm"
                                      title={`SPR: ${spr?.toFixed(2) ?? ""} — beoordeelt zichzelf aanzienlijk hoger dan peers`}
                                    >
                                      ⚠️
                                    </span>
                                  )}
                                  {hasSprLow && (
                                    <span
                                      className="cursor-default text-sm"
                                      title={`SPR: ${spr?.toFixed(2) ?? ""} — beoordeelt zichzelf lager dan peers`}
                                    >
                                      💡
                                    </span>
                                  )}
                                  {hasLowGiven && (
                                    <span
                                      className="cursor-default text-sm"
                                      title={`Geeft gem. ${prev?.given_avg_pct?.toFixed(0) ?? ""}% aan peers (teamgem: ${prev?.team_given_avg?.toFixed(0) ?? ""}%) — beoordeelt anderen opvallend laag`}
                                    >
                                      🔻
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
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
