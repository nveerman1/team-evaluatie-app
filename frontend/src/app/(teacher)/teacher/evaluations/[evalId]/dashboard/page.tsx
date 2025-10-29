"use client";

import Link from "next/link";
import { useNumericEvalId } from "@/utils";
import { useDashboardData } from "@/hooks";
import { Tile, Loading, ErrorMessage } from "@/components";
import { useState, useMemo } from "react";
import { dashboardService } from "@/services/dashboard.service";

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
  const { kpis, flags, studentProgress, loading, error } =
    useDashboardData(evalIdNum);

  const evalId = evalIdNum?.toString() ?? "";

  // State for sorting and filtering
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filterType, setFilterType] = useState<FilterType>("all");

  // Filtered and sorted students
  const filteredStudents = useMemo(() => {
    if (!studentProgress?.items) return [];

    let filtered = [...studentProgress.items];

    // Apply filter
    if (filterType === "completed") {
      filtered = filtered.filter((s) => s.total_progress_percent === 100);
    } else if (filterType === "partial") {
      filtered = filtered.filter(
        (s) => s.total_progress_percent > 0 && s.total_progress_percent < 100,
      );
    } else if (filterType === "not_started") {
      filtered = filtered.filter((s) => s.total_progress_percent === 0);
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
          aVal = a.peer_reviews_received;
          bVal = b.peer_reviews_received;
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
  }, [studentProgress, filterType, sortField, sortDirection]);

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

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Evaluatie — Dashboard</h1>
        <div className="flex gap-2">
          {evalIdNum != null ? (
            <>
              <Link
                href={`/teacher/evaluations/${evalId}/grades`}
                className="px-3 py-2 rounded-xl border"
              >
                Cijfers
              </Link>
              <Link
                href={`/teacher/evaluations/${evalId}/feedback`}
                className="px-3 py-2 rounded-xl border"
              >
                Feedback
              </Link>
              <Link
                href={`/teacher/evaluations/${evalId}/reflections`}
                className="px-3 py-2 rounded-xl border"
              >
                Reflecties
              </Link>
              <Link
                href={`/teacher/evaluations/${evalId}/settings`}
                className="px-3 py-2 rounded-xl border"
              >
                Instellingen
              </Link>
            </>
          ) : (
            <>
              <span className="px-3 py-2 rounded-xl border opacity-60 cursor-not-allowed">
                Cijfers
              </span>
              <span className="px-3 py-2 rounded-xl border opacity-60 cursor-not-allowed">
                Feedback
              </span>
              <span className="px-3 py-2 rounded-xl border opacity-60 cursor-not-allowed">
                Reflecties
              </span>
              <span className="px-3 py-2 rounded-xl border opacity-60 cursor-not-allowed">
                Instellingen
              </span>
            </>
          )}
        </div>
      </header>

      {loading && <Loading />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && (
        <>
          {/* KPI tiles */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Tile label="Self-reviews" value={kpis?.selfreviews_present ?? 0} />
            <Tile label="Peer-reviews" value={kpis?.reviewers_total ?? 0} />
            <Tile label="Reflecties" value={kpis?.reflections_count ?? 0} />
            <Tile label="Totaal studenten" value={kpis?.students_total ?? 0} />
          </section>

          {/* Student Progress Table */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Voortgang per leerling
              </h2>
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
              >
                📥 Export naar CSV
              </button>
            </div>

            {/* Filters */}
            <div className="flex gap-2 items-center">
              <label className="text-sm font-medium">Filter:</label>
              <button
                onClick={() => setFilterType("all")}
                className={`px-3 py-1 rounded-lg text-sm ${
                  filterType === "all"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                Alle leerlingen
              </button>
              <button
                onClick={() => setFilterType("not_started")}
                className={`px-3 py-1 rounded-lg text-sm ${
                  filterType === "not_started"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                Niet gestart
              </button>
              <button
                onClick={() => setFilterType("partial")}
                className={`px-3 py-1 rounded-lg text-sm ${
                  filterType === "partial"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                Deels voltooid
              </button>
              <button
                onClick={() => setFilterType("completed")}
                className={`px-3 py-1 rounded-lg text-sm ${
                  filterType === "completed"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                Voltooid
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("name")}
                    >
                      Naam {sortField === "name" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("class")}
                    >
                      Klas {sortField === "class" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("self_assessment")}
                    >
                      Zelfbeoordeling{" "}
                      {sortField === "self_assessment" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("peer_reviews")}
                    >
                      Peer reviews{" "}
                      {sortField === "peer_reviews" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("reflection")}
                    >
                      Reflectie{" "}
                      {sortField === "reflection" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("progress")}
                    >
                      Totaal %{" "}
                      {sortField === "progress" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("last_activity")}
                    >
                      Laatste activiteit{" "}
                      {sortField === "last_activity" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Signaal
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        Geen studenten gevonden
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => (
                      <tr key={student.user_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          {student.user_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {student.class_name || "-"}
                        </td>
                        <td className="px-4 py-3 text-center text-lg">
                          {getStatusIcon(student.self_assessment_status)}
                        </td>
                        <td className="px-4 py-3 text-center text-sm">
                          {student.peer_reviews_received}/
                          {student.peer_reviews_expected}
                        </td>
                        <td className="px-4 py-3 text-center text-lg">
                          {getStatusIcon(student.reflection_status)}
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-medium">
                          {student.total_progress_percent}%
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-600">
                          {formatLastActivity(student.last_activity)}
                        </td>
                        <td className="px-4 py-3 text-center text-sm">
                          {student.flags.length > 0 ? (
                            <span
                              className="cursor-help"
                              title={student.flags.join(", ")}
                            >
                              ⚠️
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
          </section>

          {/* Flags */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Signalen / Flags</h2>
            {!flags || flags.length === 0 ? (
              <div className="text-gray-500">Geen signalen.</div>
            ) : (
              <ul className="space-y-2">
                {flags.map((f, idx) => (
                  <li key={idx} className="p-3 border rounded-xl">
                    <div className="text-sm text-gray-500">{f.type}</div>
                    <div className="font-medium">{f.message}</div>
                    {f.student && (
                      <div className="text-sm text-gray-600">
                        Student: {f.student}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {evalIdNum == null && (
        <p className="text-sm text-gray-500">
          Geen geldige evaluatie geselecteerd. Open het dashboard via een
          bestaande evaluatie.
        </p>
      )}
    </main>
  );
}
