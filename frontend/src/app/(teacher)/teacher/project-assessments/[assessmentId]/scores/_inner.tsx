"use client";
import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ApiAuthError } from "@/lib/api";
import { projectAssessmentService } from "@/services";
import { ProjectAssessmentScoresOverview } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";

export default function ScoresOverviewInner() {
  const params = useParams();
  const assessmentId = Number(params?.assessmentId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProjectAssessmentScoresOverview | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("team");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [editingCell, setEditingCell] = useState<{
    teamNumber: number;
    criterionId: number;
  } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await projectAssessmentService.getScoresOverview(assessmentId);
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
  }, [assessmentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSaveScore(
    teamNumber: number,
    criterionId: number,
    newScore: number,
    comment?: string
  ) {
    if (!data) return;
    
    setSaving(true);
    try {
      await projectAssessmentService.batchUpdateScores(assessmentId, {
        scores: [
          {
            criterion_id: criterionId,
            score: newScore,
            comment: comment || null,
            team_number: teamNumber,
          },
        ],
      });
      
      // Reload data to get updated scores
      await loadData();
      setEditingCell(null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      alert(err?.response?.data?.detail || err?.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  function handleCellClick(teamNumber: number, criterionId: number, currentScore?: number) {
    setEditingCell({ teamNumber, criterionId });
    setEditValue(currentScore?.toString() || "");
  }

  function handleCellBlur() {
    if (editingCell && editValue && data) {
      const score = parseFloat(editValue);
      if (!isNaN(score) && score >= data.rubric_scale_min && score <= data.rubric_scale_max) {
        // Scores are stored as integers, so round the value
        const finalScore = Math.round(score);
        handleSaveScore(editingCell.teamNumber, editingCell.criterionId, finalScore);
      } else {
        setEditingCell(null);
      }
    } else {
      setEditingCell(null);
    }
  }

  function handleCellKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleCellBlur();
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  }

  function exportToCSV() {
    if (!data) return;

    const headers = ["Team", "Teamleden", ...data.criteria.map((c) => c.name), "Totaalscore", "Cijfer"];
    const rows = data.team_scores.map((team) => {
      const members = team.members.map((m) => m.name).join("; ");
      const scores = team.criterion_scores.map((cs) => cs.score?.toString() || "—");
      return [
        team.team_name,
        members,
        ...scores,
        team.total_score?.toFixed(1) || "—",
        team.grade?.toFixed(1) || "—",
      ];
    });

    const csvContent =
      headers.join(",") +
      "\n" +
      rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `scores-${data.assessment.title.replace(/[^a-z0-9]/gi, "_")}.csv`;
    link.click();
  }

  async function exportToXLSX() {
    if (!data) return;

    // Dynamically import xlsx only when needed (client-side only)
    const XLSX = await import("xlsx");

    // Prepare data for Excel
    const headers = ["Team", "Teamleden", ...data.criteria.map((c) => c.name), "Totaalscore", "Cijfer"];
    const rows = data.team_scores.map((team) => {
      const members = team.members.map((m) => m.name).join("; ");
      const scores = team.criterion_scores.map((cs) => cs.score !== null && cs.score !== undefined ? cs.score : "");
      return [
        team.team_name,
        members,
        ...scores,
        team.total_score !== null && team.total_score !== undefined ? team.total_score : "",
        team.grade !== null && team.grade !== undefined ? team.grade : "",
      ];
    });

    // Add statistics row
    const avgRow = [
      "Gemiddelde",
      "",
      ...data.criteria.map((c) => data.statistics.average_per_criterion[c.name] || ""),
      "",
      "",
    ];

    // Create worksheet
    const wsData = [headers, ...rows, [], avgRow];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    const colWidths = [
      { wch: 15 }, // Team
      { wch: 40 }, // Teamleden
      ...data.criteria.map(() => ({ wch: 15 })), // Criteria
      { wch: 12 }, // Totaalscore
      { wch: 10 }, // Cijfer
    ];
    ws["!cols"] = colWidths;

    // Create workbook and add worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Scores");

    // Generate file and trigger download
    XLSX.writeFile(wb, `scores-${data.assessment.title.replace(/[^a-z0-9]/gi, "_")}.xlsx`);
  }

  function getScoreColor(score: number | null | undefined, scale_min: number, scale_max: number): string {
    if (score === null || score === undefined) return "";
    
    const range = scale_max - scale_min;
    const normalized = (score - scale_min) / range;
    
    if (normalized < 0.4) return "bg-red-100 text-red-800";
    if (normalized < 0.7) return "bg-orange-100 text-orange-800";
    return "bg-green-100 text-green-800";
  }

  if (loading) return <Loading />;
  if (error && !data) return <ErrorMessage message={error} />;
  if (!data) return <ErrorMessage message="Geen data gevonden" />;

  // Filter teams based on search
  let filteredTeams = data.team_scores;
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filteredTeams = filteredTeams.filter((t) => {
      const teamMatch = t.team_name.toLowerCase().includes(query);
      const membersMatch = t.members.some((m) => m.name.toLowerCase().includes(query));
      return teamMatch || membersMatch;
    });
  }

  // Apply sorting
  const sortedTeams = [...filteredTeams].sort((a, b) => {
    let comparison = 0;
    
    if (sortBy === "team") {
      comparison = a.team_number - b.team_number;
    } else if (sortBy === "total") {
      const aScore = a.total_score || 0;
      const bScore = b.total_score || 0;
      comparison = aScore - bScore;
    } else if (sortBy === "grade") {
      const aGrade = a.grade || 0;
      const bGrade = b.grade || 0;
      comparison = aGrade - bGrade;
    } else if (sortBy === "updated") {
      const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      comparison = aTime - bTime;
    } else {
      // Sort by specific criterion
      const criterionId = parseInt(sortBy.replace("criterion-", ""), 10);
      const aScore = a.criterion_scores.find((cs) => cs.criterion_id === criterionId)?.score || 0;
      const bScore = b.criterion_scores.find((cs) => cs.criterion_id === criterionId)?.score || 0;
      comparison = aScore - bScore;
    }
    
    return sortOrder === "asc" ? comparison : -comparison;
  });

  return (
    <main className="max-w-[1600px] mx-auto p-6 space-y-6">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Link
            href={`/teacher/project-assessments/${assessmentId}/overview`}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Terug naar overzicht
          </Link>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">
              Scores – {data.assessment.title}
            </h1>
            <p className="text-gray-600">
              Rubric: {data.rubric_title} (schaal {data.rubric_scale_min}-
              {data.rubric_scale_max})
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={loadData}
              className="px-4 py-2 rounded-xl border hover:bg-gray-50"
              disabled={loading}
            >
              ⟳ Verversen
            </button>
            <button
              onClick={exportToCSV}
              className="px-4 py-2 rounded-xl border hover:bg-gray-50"
            >
              🧾 Exporteer CSV
            </button>
            <button
              onClick={exportToXLSX}
              className="px-4 py-2 rounded-xl border hover:bg-gray-50"
            >
              📥 Exporteer Excel
            </button>
          </div>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Zoeken:</label>
          <input
            type="text"
            className="border rounded-lg px-3 py-2 w-64"
            placeholder="Teamnaam of leerling..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Sorteer op:</label>
          <select
            className="border rounded-lg px-3 py-2"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="team">Teamnummer</option>
            <option value="total">Totaalscore</option>
            <option value="grade">Cijfer</option>
            <option value="updated">Laatste bewerking</option>
            {data.criteria.map((c) => (
              <option key={c.id} value={`criterion-${c.id}`}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="px-3 py-2 border rounded-lg hover:bg-gray-50"
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {/* Scores Table */}
      <section className="bg-white border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 sticky left-0 bg-gray-50">
                  Team
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 min-w-[200px]">
                  Teamleden
                </th>
                {data.criteria.map((criterion) => (
                  <th
                    key={criterion.id}
                    className="px-4 py-3 text-center text-sm font-medium text-gray-600 min-w-[100px]"
                  >
                    {criterion.name}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                  Totaal
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                  Cijfer
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Laatst bewerkt
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.length === 0 && (
                <tr>
                  <td
                    colSpan={data.criteria.length + 5}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Geen teams gevonden voor dit filter
                  </td>
                </tr>
              )}
              {sortedTeams.map((team) => (
                <tr
                  key={team.team_number}
                  className="border-b last:border-b-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium sticky left-0 bg-white">
                    <Link
                      href={`/teacher/project-assessments/${assessmentId}/edit?team=${team.team_number}`}
                      className="text-blue-600 hover:underline"
                    >
                      {team.team_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-600">
                      {team.members.map((m) => m.name).join(", ")}
                    </div>
                  </td>
                  {team.criterion_scores.map((cs) => {
                    const isEditing =
                      editingCell?.teamNumber === team.team_number &&
                      editingCell?.criterionId === cs.criterion_id;

                    return (
                      <td
                        key={cs.criterion_id}
                        className="px-4 py-3 text-center"
                      >
                        {isEditing ? (
                          <input
                            type="number"
                            min={data.rubric_scale_min}
                            max={data.rubric_scale_max}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={handleCellKeyDown}
                            autoFocus
                            className="w-16 px-2 py-1 border rounded text-center"
                            disabled={saving}
                          />
                        ) : (
                          <button
                            onClick={() =>
                              handleCellClick(
                                team.team_number,
                                cs.criterion_id,
                                cs.score || undefined
                              )
                            }
                            className={`px-3 py-1 rounded-lg hover:opacity-80 ${
                              cs.score !== null && cs.score !== undefined
                                ? getScoreColor(cs.score, data.rubric_scale_min, data.rubric_scale_max)
                                : "text-gray-400"
                            }`}
                            title={cs.comment || "Klik om score in te voeren"}
                          >
                            {cs.score !== null && cs.score !== undefined ? cs.score : "—"}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center font-medium">
                    {team.total_score !== null && team.total_score !== undefined
                      ? team.total_score.toFixed(1)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-center font-medium">
                    {team.grade !== null && team.grade !== undefined
                      ? team.grade.toFixed(1)
                      : "—"}
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
                </tr>
              ))}
            </tbody>
            {/* Statistics Footer */}
            {data.team_scores.length > 0 && (
              <tfoot className="bg-gray-50 border-t font-medium">
                <tr>
                  <td className="px-4 py-3 sticky left-0 bg-gray-50">
                    Gemiddelde
                  </td>
                  <td className="px-4 py-3"></td>
                  {data.criteria.map((criterion) => (
                    <td key={criterion.id} className="px-4 py-3 text-center">
                      {data.statistics.average_per_criterion[criterion.name]?.toFixed(1) || "—"}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center">
                    {(() => {
                      const validScores = data.team_scores
                        .filter(t => t.total_score !== null && t.total_score !== undefined)
                        .map(t => t.total_score as number);
                      if (validScores.length === 0) return "—";
                      const avg = validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
                      return avg.toFixed(1);
                    })()}
                  </td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* Statistics Summary */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-2xl p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-2">
            Hoogste score
          </h3>
          <p className="text-2xl font-semibold">
            {data.statistics.highest_score?.toFixed(1) || "—"}
          </p>
        </div>
        <div className="bg-white border rounded-2xl p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-2">
            Laagste score
          </h3>
          <p className="text-2xl font-semibold">
            {data.statistics.lowest_score?.toFixed(1) || "—"}
          </p>
        </div>
        <div className="bg-white border rounded-2xl p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-2">
            Openstaande beoordelingen
          </h3>
          <p className="text-2xl font-semibold">
            {data.statistics.pending_assessments}
          </p>
        </div>
      </section>
    </main>
  );
}
