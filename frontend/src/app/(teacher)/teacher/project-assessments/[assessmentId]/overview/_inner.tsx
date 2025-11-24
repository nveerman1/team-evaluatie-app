"use client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ApiAuthError } from "@/lib/api";
import { projectAssessmentService } from "@/services";
import { ProjectAssessmentTeamOverview } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";

export default function ProjectAssessmentOverviewInner() {
  const params = useParams();
  const assessmentId = Number(params?.assessmentId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProjectAssessmentTeamOverview | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"team" | "status" | "progress" | "updated">("team");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const result = await projectAssessmentService.getTeamOverview(assessmentId);
        setData(result);
      } catch (e: unknown) {
        if (e instanceof ApiAuthError) {
          setError(e.originalMessage);
        } else {
          const err = e as { response?: { data?: { detail?: string } }; message?: string };
          setError(err?.response?.data?.detail || err?.message || "Laden mislukt");
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [assessmentId]);

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
      const membersMatch = t.members.some(m => m.name.toLowerCase().includes(query));
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
        const aProgress = a.total_criteria > 0 ? a.scores_count / a.total_criteria : 0;
        const bProgress = b.total_criteria > 0 ? b.scores_count / b.total_criteria : 0;
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
      {/* Filters and Search */}
      <div className="flex items-center gap-4 bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Zoeken:</label>
          <input
            type="text"
            className="border rounded-lg px-3 py-2 w-64"
            placeholder="Teamnummer of naam..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Status:</label>
          <select
            className="border rounded-lg px-3 py-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Alle</option>
            <option value="not_started">⬜ Niet gestart</option>
            <option value="in_progress">⚠️ In progress</option>
            <option value="completed">✅ Afgerond</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Sorteer op:</label>
          <select
            className="border rounded-lg px-3 py-2"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="team">Teamnummer</option>
            <option value="status">Status</option>
            <option value="progress">Voortgang</option>
            <option value="updated">Laatste bewerking</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="px-3 py-2 border rounded-lg hover:bg-gray-50"
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {/* Teams Table */}
      <section className="bg-white border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Team
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Leden
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Voortgang
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Laatste bewerking
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                  Acties
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Geen teams gevonden voor dit filter
                  </td>
                </tr>
              )}
              {sortedTeams.map((team) => (
                <tr key={team.team_number || team.group_id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">Team {team.team_number}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-600">
                      {team.members.map((m) => m.name).join(", ")}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {team.status === "completed" && (
                      <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs">
                        ✅ Gereed
                      </span>
                    )}
                    {team.status === "in_progress" && (
                      <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs">
                        ⚠️ In progress
                      </span>
                    )}
                    {team.status === "not_started" && (
                      <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                        ⬜ Niet gestart
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      {team.scores_count}/{team.total_criteria} criteria
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${
                            team.total_criteria > 0
                              ? (team.scores_count / team.total_criteria) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {team.updated_at ? (
                      <>
                        {new Date(team.updated_at).toLocaleDateString("nl-NL")}
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
                    <Link
                      href={`/teacher/project-assessments/${assessmentId}/edit?team=${team.team_number}`}
                      className="px-3 py-1.5 rounded-lg border hover:bg-gray-100 text-sm inline-block"
                    >
                      {team.status === "not_started"
                        ? "Start beoordeling"
                        : team.status === "in_progress"
                        ? "Verder invullen"
                        : "Bekijk rubric"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
