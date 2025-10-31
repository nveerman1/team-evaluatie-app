"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ApiAuthError } from "@/lib/api";
import { projectAssessmentService } from "@/services";
import { ProjectAssessmentTeamOverview } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";

export default function ProjectAssessmentOverviewInner() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = Number(params?.assessmentId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProjectAssessmentTeamOverview | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const result = await projectAssessmentService.getTeamOverview(assessmentId);
        setData(result);
      } catch (e: any) {
        if (e instanceof ApiAuthError) {
          setError(e.originalMessage);
        } else {
          setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
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

  // Filter teams based on status
  const filteredTeams =
    statusFilter === "all"
      ? data.teams
      : data.teams.filter((t) => {
          if (statusFilter === "not_started") return t.status === "not_started";
          if (statusFilter === "in_progress") return t.status === "in_progress";
          if (statusFilter === "completed") return t.status === "completed";
          return true;
        });

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Link
            href="/teacher/project-assessments"
            className="text-gray-500 hover:text-gray-700"
          >
            ← Terug naar overzicht
          </Link>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              Beoordeling: {data.assessment.title}
            </h1>
            <p className="text-gray-600">
              Rubric: {data.rubric_title} (schaal {data.rubric_scale_min}-
              {data.rubric_scale_max})
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/teacher/project-assessments/${assessmentId}/reflections`}
              className="px-4 py-2 rounded-xl border hover:bg-gray-50"
            >
              📝 Reflecties bekijken
            </Link>
            <button
              onClick={() => alert("Export functionaliteit komt binnenkort")}
              className="px-4 py-2 rounded-xl border hover:bg-gray-50"
            >
              🧾 Exporteer CSV
            </button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border">
        <label className="text-sm font-medium">Filter op status:</label>
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
              {filteredTeams.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Geen teams gevonden voor dit filter
                  </td>
                </tr>
              )}
              {filteredTeams.map((team) => (
                <tr key={team.group_id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{team.group_name}</div>
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
                      href={`/teacher/project-assessments/${assessmentId}/edit`}
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
    </main>
  );
}
