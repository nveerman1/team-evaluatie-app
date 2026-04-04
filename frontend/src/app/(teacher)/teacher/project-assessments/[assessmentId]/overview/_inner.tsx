"use client";
import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ApiAuthError } from "@/lib/api";
import { projectAssessmentService } from "@/services";
import { ProjectAssessmentTeamOverview } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import { shortName } from "@/lib/format";

export default function ProjectAssessmentOverviewInner() {
  const params = useParams();
  const assessmentId = Number(params?.assessmentId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProjectAssessmentTeamOverview | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<
    "team" | "status" | "progress" | "updated"
  >("team");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [emailingTeam, setEmailingTeam] = useState<number | null>(null);
  const [emailingAll, setEmailingAll] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result =
        await projectAssessmentService.getTeamOverview(assessmentId);
      setData(result);
    } catch (e: unknown) {
      if (e instanceof ApiAuthError) {
        setError(e.originalMessage);
      } else {
        const err = e as {
          response?: { data?: { detail?: string } };
          message?: string;
        };
        setError(
          err?.response?.data?.detail || err?.message || "Laden mislukt",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportTeam = useCallback(
    async (teamNumber: number) => {
      try {
        const { blob, filename } = await projectAssessmentService.exportTeamRubric(
          assessmentId,
          teamNumber,
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        alert("Downloaden mislukt");
      }
    },
    [assessmentId],
  );

  const handleExportAll = useCallback(async () => {
    try {
      const { blob, filename } =
        await projectAssessmentService.exportAllRubrics(assessmentId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Downloaden mislukt");
    }
  }, [assessmentId]);

  const handleEmailTeam = useCallback(
    async (teamNumber: number) => {
      if (!confirm(`Rubric mailen naar alle leden van Team ${teamNumber}?`))
        return;
      setEmailingTeam(teamNumber);
      try {
        const result = await projectAssessmentService.emailTeamRubric(
          assessmentId,
          teamNumber,
        );
        const success = result.results.find((r) => r.team_number === teamNumber);
        if (success?.success) {
          alert(`Rubric verstuurd naar Team ${teamNumber}`);
        } else {
          alert(
            `Mailen mislukt: ${success?.error ?? "Onbekende fout"}`,
          );
        }
      } catch {
        alert("Mailen mislukt");
      } finally {
        setEmailingTeam(null);
      }
    },
    [assessmentId],
  );

  const handleEmailAll = useCallback(async () => {
    const teamNumbers = data!.teams
      .map((t) => t.team_number)
      .filter((n): n is number => n != null);
    if (!confirm(`Rubrics mailen naar alle ${teamNumbers.length} teams?`))
      return;
    setEmailingAll(true);
    try {
      const result = await projectAssessmentService.emailAllRubrics(
        assessmentId,
        teamNumbers,
      );
      const successCount = result.results.filter((r) => r.success).length;
      alert(
        `Rubrics verstuurd naar ${successCount} van ${teamNumbers.length} teams`,
      );
    } catch {
      alert("Mailen mislukt");
    } finally {
      setEmailingAll(false);
    }
  }, [assessmentId, data]);

  if (loading) return <Loading />;
  if (error && !data) return <ErrorMessage message={error} />;
  if (!data) return <ErrorMessage message="Geen data gevonden" />;

  // Filter teams based on status and search
  let filteredTeams = data.teams;

  // Apply status filter
  if (statusFilter !== "all") {
    filteredTeams = filteredTeams.filter((t) => {
      if (statusFilter === "not_started") return t.status === "not_started";
      if (statusFilter === "in_progress") return t.status === "in_progress";
      if (statusFilter === "completed") return t.status === "completed";
      return true;
    });
  }

  // Apply search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filteredTeams = filteredTeams.filter((t) => {
      const teamMatch = t.team_number?.toString().includes(query);
      const membersMatch = t.members.some((m) =>
        m.name.toLowerCase().includes(query),
      );
      return teamMatch || membersMatch;
    });
  }

  // Apply sorting
  const sortedTeams = [...filteredTeams].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case "team":
        comparison = (a.team_number || 0) - (b.team_number || 0);
        break;
      case "status":
        const statusOrder = { not_started: 0, in_progress: 1, completed: 2 };
        comparison = statusOrder[a.status] - statusOrder[b.status];
        break;
      case "progress":
        const aProgress =
          a.total_criteria > 0 ? a.scores_count / a.total_criteria : 0;
        const bProgress =
          b.total_criteria > 0 ? b.scores_count / b.total_criteria : 0;
        comparison = aProgress - bProgress;
        break;
      case "updated":
        const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        comparison = aTime - bTime;
        break;
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  return (
    <>
      {/* Search and Filters - styled like OMZA */}
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
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as "team" | "status" | "progress" | "updated",
              )
            }
          >
            <option value="team">Teamnummer</option>
            <option value="status">Status</option>
            <option value="progress">Voortgang</option>
            <option value="updated">Laatste bewerking</option>
          </select>
          <select
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Alle</option>
            <option value="not_started">⬜ Niet gestart</option>
            <option value="in_progress">⚠️ In progress</option>
            <option value="completed">✅ Afgerond</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm shadow-sm hover:bg-slate-50"
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>
          <button
            onClick={handleExportAll}
            className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm shadow-sm hover:bg-slate-50 inline-flex items-center gap-1.5"
            title="Alle rubrics downloaden als Word"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 text-slate-500"
            >
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L9 11.586V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
              <path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
            </svg>
            Alle rubrics
          </button>
          <button
            onClick={handleEmailAll}
            className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm shadow-sm hover:bg-slate-50 inline-flex items-center gap-1.5"
            title="Alle rubrics mailen naar teamleden"
            disabled={emailingAll}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 text-slate-500"
            >
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v.586l-7 4.667-7-4.667V4z" />
              <path d="M2 7.414V15a1 1 0 001 1h14a1 1 0 001-1V7.414l-7 4.667-7-4.667z" />
            </svg>
            {emailingAll ? "Bezig..." : "Alle rubrics mailen"}
          </button>
        </div>
      </div>

      {/* Teams Table - styled like OMZA */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide sticky left-0 bg-gray-50">
                  Team
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide min-w-[200px]">
                  Leden
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide w-[160px]">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide min-w-[150px]">
                  Voortgang
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide">
                  Laatste bewerking
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 tracking-wide">
                  Acties
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedTeams.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-gray-500"
                  >
                    Geen teams gevonden voor dit filter
                  </td>
                </tr>
              )}
              {sortedTeams.map((team) => (
                <tr
                  key={team.team_number || team.group_id}
                  className="bg-white hover:bg-gray-50"
                >
                  <td className="px-5 py-3 font-medium sticky left-0 bg-white">
                    <Link
                      href={`/teacher/project-assessments/${assessmentId}/edit?team=${team.team_number}`}
                      className="text-blue-600 hover:underline"
                    >
                      Team {team.team_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <div
                      className="text-sm text-gray-600 min-w-0 truncate"
                      title={team.members.map((m) => m.name).join(", ")}
                    >
                      {team.members.map((m) => shortName(m.name)).join(", ")}
                    </div>
                  </td>
                  <td className="px-4 py-3 w-[160px]">
                    {team.status === "completed" && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full border text-xs font-medium bg-green-100 text-green-800 whitespace-nowrap">
                        ✅ Gereed
                      </span>
                    )}
                    {team.status === "in_progress" && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full border text-xs font-medium bg-orange-100 text-orange-800 whitespace-nowrap">
                        ⚠️ In progress
                      </span>
                    )}
                    {team.status === "not_started" && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full border text-xs font-medium bg-gray-100 text-gray-600 whitespace-nowrap">
                        ⬜ Niet gestart
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-600 mb-1">
                      {team.scores_count}/{team.total_criteria} criteria
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${
                            team.total_criteria > 0
                              ? Math.min(
                                  100,
                                  (team.scores_count / team.total_criteria) *
                                    100,
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {team.updated_at ? (
                      <>
                        <div className="text-gray-900">
                          {new Date(team.updated_at).toLocaleDateString(
                            "nl-NL",
                          )}
                        </div>
                        {team.updated_by && (
                          <div className="text-xs text-gray-500">
                            {team.updated_by}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Link
                        href={`/teacher/project-assessments/${assessmentId}/edit?team=${team.team_number}`}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 shadow-sm inline-block"
                      >
                        {team.status === "not_started"
                          ? "Start beoordeling"
                          : team.status === "in_progress"
                            ? "Verder invullen"
                            : "Bekijk rubric"}
                      </Link>
                      <button
                        onClick={() =>
                          handleExportTeam(team.team_number as number)
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 shadow-sm"
                        title={`Download rubric Team ${team.team_number}`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="w-4 h-4"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 3a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L9 11.586V4a1 1 0 011-1z"
                            clipRule="evenodd"
                          />
                          <path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
                        </svg>
                      </button>
                      <button
                        onClick={() =>
                          handleEmailTeam(team.team_number as number)
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 shadow-sm"
                        title={`Mail rubric naar Team ${team.team_number}`}
                        disabled={emailingTeam === team.team_number}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="w-4 h-4"
                        >
                          <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v.586l-7 4.667-7-4.667V4z" />
                          <path d="M2 7.414V15a1 1 0 001 1h14a1 1 0 001-1V7.414l-7 4.667-7-4.667z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

