"use client";
import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ApiAuthError } from "@/lib/api";
import { projectAssessmentService } from "@/services";
import { ProjectAssessmentScoresOverview, ProjectAssessmentStudentsOverview } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";

type ViewMode = "teams" | "students";

export default function ScoresOverviewInner() {
  const params = useParams();
  const assessmentId = Number(params?.assessmentId);

  const [viewMode, setViewMode] = useState<ViewMode>("teams");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProjectAssessmentScoresOverview | null>(null);
  const [studentsData, setStudentsData] = useState<ProjectAssessmentStudentsOverview | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("team");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [editingCell, setEditingCell] = useState<{
    teamNumber: number;
    criterionId: number;
  } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const loadTeamsData = useCallback(async () => {
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

  const loadStudentsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await projectAssessmentService.getStudentsOverview(assessmentId);
      setStudentsData(result);
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
    if (viewMode === "teams") {
      loadTeamsData();
    } else {
      loadStudentsData();
    }
  }, [viewMode, loadTeamsData, loadStudentsData]);

  async function handleSaveScore(
    teamNumber: number,
    criterionId: number,
    newScore: number,
    comment?: string
  ) {
    if (!data && !studentsData) return;
    
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
      if (viewMode === "teams") {
        await loadTeamsData();
      } else {
        await loadStudentsData();
      }
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
    if (editingCell && editValue && currentData) {
      const score = parseFloat(editValue);
      if (!isNaN(score) && score >= currentData.rubric_scale_min && score <= currentData.rubric_scale_max) {
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
    if (viewMode === "teams" && data) {
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
      link.download = `scores-teams-${data.assessment.title.replace(/[^a-z0-9]/gi, "_")}.csv`;
      link.click();
    } else if (viewMode === "students" && studentsData) {
      const headers = ["Leerling", "Klas", "Team", ...studentsData.criteria.map((c) => c.name), "Totaalscore", "Cijfer", "Laatst bewerkt"];
      const rows = studentsData.student_scores.map((student) => {
        const scores = student.criterion_scores.map((cs) => cs.score?.toString() || "—");
        return [
          student.student_name,
          student.class_name || "—",
          student.team_name || "—",
          ...scores,
          student.total_score?.toFixed(1) || "—",
          student.grade?.toFixed(1) || "—",
          student.updated_at ? new Date(student.updated_at).toLocaleDateString("nl-NL") : "—",
        ];
      });

      const csvContent =
        headers.join(",") +
        "\n" +
        rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `scores-students-${studentsData.assessment.title.replace(/[^a-z0-9]/gi, "_")}.csv`;
      link.click();
    }
  }

  async function exportToXLSX() {
    // Dynamically import xlsx only when needed (client-side only)
    const XLSX = await import("xlsx");

    if (viewMode === "teams" && data) {
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
      XLSX.writeFile(wb, `scores-teams-${data.assessment.title.replace(/[^a-z0-9]/gi, "_")}.xlsx`);
    } else if (viewMode === "students" && studentsData) {
      // Prepare data for Excel - students view
      const headers = ["Leerling", "Klas", "Team", ...studentsData.criteria.map((c) => c.name), "Totaalscore", "Cijfer", "Laatst bewerkt"];
      const rows = studentsData.student_scores.map((student) => {
        const scores = student.criterion_scores.map((cs) => cs.score !== null && cs.score !== undefined ? cs.score : "");
        return [
          student.student_name,
          student.class_name || "",
          student.team_name || "",
          ...scores,
          student.total_score !== null && student.total_score !== undefined ? student.total_score : "",
          student.grade !== null && student.grade !== undefined ? student.grade : "",
          student.updated_at ? new Date(student.updated_at).toLocaleDateString("nl-NL") : "",
        ];
      });

      // Add statistics row
      const avgRow = [
        "Gemiddelde",
        "",
        "",
        ...studentsData.criteria.map((c) => studentsData.statistics.average_per_criterion[c.name] || ""),
        "",
        studentsData.statistics.average_grade || "",
        "",
      ];

      // Create worksheet
      const wsData = [headers, ...rows, [], avgRow];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Set column widths
      const colWidths = [
        { wch: 25 }, // Leerling
        { wch: 10 }, // Klas
        { wch: 15 }, // Team
        ...studentsData.criteria.map(() => ({ wch: 15 })), // Criteria
        { wch: 12 }, // Totaalscore
        { wch: 10 }, // Cijfer
        { wch: 15 }, // Laatst bewerkt
      ];
      ws["!cols"] = colWidths;

      // Create workbook and add worksheet
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Leerlingen");

      // Generate file and trigger download
      XLSX.writeFile(wb, `scores-students-${studentsData.assessment.title.replace(/[^a-z0-9]/gi, "_")}.xlsx`);
    }
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
  if (error && !data && !studentsData) return <ErrorMessage message={error} />;
  
  const currentData = viewMode === "teams" ? data : studentsData;
  if (!currentData) return <ErrorMessage message="Geen data gevonden" />;

  // Filter and sort based on view mode
  let filteredItems: any[] = [];
  
  if (viewMode === "teams" && data) {
    // Filter teams based on search
    filteredItems = data.team_scores;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredItems = filteredItems.filter((t) => {
        const teamMatch = t.team_name.toLowerCase().includes(query);
        const membersMatch = t.members.some((m: any) => m.name.toLowerCase().includes(query));
        return teamMatch || membersMatch;
      });
    }

    // Apply sorting for teams
    filteredItems = [...filteredItems].sort((a, b) => {
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
        const aScore = a.criterion_scores.find((cs: any) => cs.criterion_id === criterionId)?.score || 0;
        const bScore = b.criterion_scores.find((cs: any) => cs.criterion_id === criterionId)?.score || 0;
        comparison = aScore - bScore;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });
  } else if (viewMode === "students" && studentsData) {
    // Filter students based on search
    filteredItems = studentsData.student_scores;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredItems = filteredItems.filter((s) => {
        const nameMatch = s.student_name.toLowerCase().includes(query);
        const teamMatch = s.team_name?.toLowerCase().includes(query);
        const classMatch = s.class_name?.toLowerCase().includes(query);
        return nameMatch || teamMatch || classMatch;
      });
    }

    // Apply sorting for students
    filteredItems = [...filteredItems].sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === "name") {
        comparison = a.student_name.localeCompare(b.student_name);
      } else if (sortBy === "class") {
        const aClass = a.class_name || "";
        const bClass = b.class_name || "";
        comparison = aClass.localeCompare(bClass);
      } else if (sortBy === "team") {
        const aTeam = a.team_number || 0;
        const bTeam = b.team_number || 0;
        comparison = aTeam - bTeam;
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
        const aScore = a.criterion_scores.find((cs: any) => cs.criterion_id === criterionId)?.score || 0;
        const bScore = b.criterion_scores.find((cs: any) => cs.criterion_id === criterionId)?.score || 0;
        comparison = aScore - bScore;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }

  return (
    <>
      {/* Action buttons - aligned right */}
      <div className="flex items-center justify-between">
        {/* View Mode Toggle - styled like Tabelweergave button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setViewMode("teams");
              setSortBy("team");
              setSearchQuery("");
            }}
            className={`px-4 py-2 rounded-xl border font-medium shadow-sm ${
              viewMode === "teams"
                ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Teams
          </button>
          <button
            onClick={() => {
              setViewMode("students");
              setSortBy("name");
              setSearchQuery("");
            }}
            className={`px-4 py-2 rounded-xl border font-medium shadow-sm ${
              viewMode === "students"
                ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Leerlingen
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => viewMode === "teams" ? loadTeamsData() : loadStudentsData()}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            disabled={loading}
          >
            ⟳ Verversen
          </button>
          <button
            onClick={exportToCSV}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            📄 CSV
          </button>
        </div>
      </div>

      {/* Search and Filters - styled like OMZA */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            className="h-9 w-56 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={viewMode === "teams" ? "Zoek op teamnaam of leerling..." : "Zoek op naam, team of klas..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            {viewMode === "teams" ? (
              <>
                <option value="team">Teamnummer</option>
                <option value="total">Totaalscore</option>
                <option value="grade">Cijfer</option>
                {data && data.criteria.map((c) => (
                  <option key={c.id} value={`criterion-${c.id}`}>
                    {c.name}
                  </option>
                ))}
              </>
            ) : (
              <>
                <option value="name">Naam</option>
                <option value="class">Klas</option>
                <option value="team">Team</option>
                <option value="grade">Cijfer</option>
                <option value="total">Totaalscore</option>
                {studentsData && studentsData.criteria.map((c) => (
                  <option key={c.id} value={`criterion-${c.id}`}>
                    {c.name}
                  </option>
                ))}
              </>
            )}
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm shadow-sm hover:bg-slate-50"
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {/* Scores Table - styled like OMZA */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          {viewMode === "teams" && data && (() => {
            // Group criteria by category
            const grouped = data.criteria.reduce((acc, c) => {
              const cat = c.category || "Overig";
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(c);
              return acc;
            }, {} as Record<string, typeof data.criteria>);
            const categories = Object.keys(grouped);

            return (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                {/* Category header row */}
                <tr>
                  <th rowSpan={2} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide sticky left-0 bg-gray-50">
                    Team
                  </th>
                  <th rowSpan={2} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide min-w-[200px]">
                    Teamleden
                  </th>
                  {categories.map((category) => (
                    <th
                      key={category}
                      colSpan={grouped[category].length}
                      className="px-4 py-2 text-center text-xs font-semibold text-gray-700 bg-gray-100 border-l border-r border-gray-200"
                    >
                      {category}
                    </th>
                  ))}
                  <th rowSpan={2} className="px-4 py-3 text-center text-xs font-semibold text-gray-500 tracking-wide border-l border-gray-200">
                    Totaal
                  </th>
                  <th rowSpan={2} className="px-4 py-3 text-center text-xs font-semibold text-gray-500 tracking-wide">
                    Cijfer
                  </th>
                </tr>
                {/* Criterion header row */}
                <tr>
                  {data.criteria.map((criterion) => (
                    <th
                      key={criterion.id}
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 min-w-[100px] border-t border-gray-200"
                    >
                      {criterion.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={data.criteria.length + 4}
                      className="px-5 py-8 text-center text-gray-500"
                    >
                      Geen teams gevonden voor dit filter
                    </td>
                  </tr>
                )}
                {filteredItems.map((team: typeof data.team_scores[0]) => (
                <tr
                  key={team.team_number}
                  className="bg-white hover:bg-gray-50"
                >
                  <td className="px-5 py-3 font-medium sticky left-0 bg-white">
                    <Link
                      href={`/teacher/project-assessments/${assessmentId}/edit?team=${team.team_number}`}
                      className="text-blue-600 hover:underline"
                    >
                      {team.team_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
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
                            className="w-16 px-2 py-1 border rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={saving}
                          />
                        ) : (
                          <button
                            onClick={() =>
                              handleCellClick(
                                team.team_number,
                                cs.criterion_id,
                                cs.score !== null ? cs.score : undefined
                              )
                            }
                            className={`px-3 py-1 rounded-full border text-xs font-medium transition ${
                              cs.score !== null && cs.score !== undefined
                                ? getScoreColor(cs.score, data.rubric_scale_min, data.rubric_scale_max)
                                : "border-gray-200 text-gray-400 bg-gray-50"
                            }`}
                            title={cs.comment || "Klik om score in te voeren"}
                          >
                            {cs.score !== null && cs.score !== undefined ? cs.score : "—"}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center font-medium text-gray-900">
                    {team.total_score !== null && team.total_score !== undefined
                      ? team.total_score.toFixed(1)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-center font-medium text-gray-900">
                    {team.grade !== null && team.grade !== undefined
                      ? team.grade.toFixed(1)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Statistics Footer */}
            {data.team_scores.length > 0 && (
              <tfoot className="bg-gray-50 border-t border-gray-200 font-medium">
                <tr>
                  <td className="px-5 py-3 sticky left-0 bg-gray-50 text-xs font-semibold text-gray-700">
                    Gemiddelde
                  </td>
                  <td className="px-5 py-3"></td>
                  {data.criteria.map((criterion) => (
                    <td key={criterion.id} className="px-4 py-3 text-center text-sm">
                      {data.statistics.average_per_criterion[criterion.name]?.toFixed(1) || "—"}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center text-sm">
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
                </tr>
              </tfoot>
            )}
            </table>
            );
          })()}

          {viewMode === "students" && studentsData && (() => {
            // Group criteria by category
            const grouped = studentsData.criteria.reduce((acc, c) => {
              const cat = c.category || "Overig";
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(c);
              return acc;
            }, {} as Record<string, typeof studentsData.criteria>);
            const categories = Object.keys(grouped);

            return (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                {/* Category header row */}
                <tr>
                  <th rowSpan={2} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide sticky left-0 bg-gray-50">
                    Team
                  </th>
                  <th rowSpan={2} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide min-w-[200px]">
                    Leerling
                  </th>
                  <th rowSpan={2} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide min-w-[80px]">
                    Klas
                  </th>
                  {categories.map((category) => (
                    <th
                      key={category}
                      colSpan={grouped[category].length}
                      className="px-4 py-2 text-center text-xs font-semibold text-gray-700 bg-gray-100 border-l border-r border-gray-200"
                    >
                      {category}
                    </th>
                  ))}
                  <th rowSpan={2} className="px-4 py-3 text-center text-xs font-semibold text-gray-500 tracking-wide border-l border-gray-200">
                    Totaal
                  </th>
                  <th rowSpan={2} className="px-4 py-3 text-center text-xs font-semibold text-gray-500 tracking-wide">
                    Cijfer
                  </th>
                </tr>
                {/* Criterion header row */}
                <tr>
                  {studentsData.criteria.map((criterion) => (
                    <th
                      key={criterion.id}
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 min-w-[100px] border-t border-gray-200"
                    >
                      {criterion.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={studentsData.criteria.length + 5}
                      className="px-5 py-8 text-center text-gray-500"
                    >
                      Geen leerlingen gevonden voor dit filter
                    </td>
                  </tr>
                )}
                {filteredItems.map((student: typeof studentsData.student_scores[0]) => (
                  <tr
                    key={student.student_id}
                    className="bg-white hover:bg-gray-50"
                  >
                    <td className="px-5 py-3 sticky left-0 bg-white">
                      {student.team_name ? (
                        <Link
                          href={`/teacher/project-assessments/${assessmentId}/edit?team=${student.team_number}`}
                          className="text-blue-600 hover:underline"
                        >
                          {student.team_name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {student.student_name}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">
                      {student.class_name || "—"}
                    </td>
                    {student.criterion_scores.map((cs) => {
                      const isEditing =
                        editingCell?.teamNumber === student.team_number &&
                        editingCell?.criterionId === cs.criterion_id;

                      return (
                        <td
                          key={cs.criterion_id}
                          className="px-4 py-3 text-center"
                        >
                          {isEditing ? (
                            <input
                              type="number"
                              min={studentsData.rubric_scale_min}
                              max={studentsData.rubric_scale_max}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleCellBlur}
                              onKeyDown={handleCellKeyDown}
                              autoFocus
                              className="w-16 px-2 py-1 border rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={saving}
                            />
                          ) : (
                            <button
                              onClick={() => {
                                if (student.team_number !== null && student.team_number !== undefined) {
                                  handleCellClick(
                                    student.team_number,
                                    cs.criterion_id,
                                    cs.score !== null ? cs.score : undefined
                                  );
                                }
                              }}
                              className={`px-3 py-1 rounded-full border text-xs font-medium transition ${
                                cs.score !== null && cs.score !== undefined
                                  ? getScoreColor(cs.score, studentsData.rubric_scale_min, studentsData.rubric_scale_max)
                                  : "border-gray-200 text-gray-400 bg-gray-50"
                              }`}
                              title={cs.comment || "Klik om score in te voeren"}
                            >
                              {cs.score !== null && cs.score !== undefined ? cs.score : "—"}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center font-medium text-gray-900">
                      {student.total_score !== null && student.total_score !== undefined
                        ? student.total_score.toFixed(1)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-gray-900">
                      {student.grade !== null && student.grade !== undefined
                        ? student.grade.toFixed(1)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Statistics Footer */}
              {studentsData.student_scores.length > 0 && (
                <tfoot className="bg-gray-50 border-t border-gray-200 font-medium">
                  <tr>
                    <td className="px-5 py-3 sticky left-0 bg-gray-50"></td>
                    <td className="px-5 py-3 text-xs font-semibold text-gray-700">
                      Gemiddelde
                    </td>
                    <td className="px-3 py-3"></td>
                    {studentsData.criteria.map((criterion) => (
                      <td key={criterion.id} className="px-4 py-3 text-center text-sm">
                        {studentsData.statistics.average_per_criterion[criterion.name]?.toFixed(1) || "—"}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center text-sm"></td>
                    <td className="px-4 py-3 text-center text-sm">
                      {studentsData.statistics.average_grade?.toFixed(1) || "—"}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
            );
          })()}
        </div>
      </div>

      {/* Statistics Summary - styled like OMZA KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {viewMode === "teams" && data && (
          <>
            <div className="rounded-xl border border-blue-100 bg-white/70 p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-500 mb-1">
                Gemiddeld cijfer
              </h3>
              <p className="text-2xl font-bold text-gray-900">
                {data.statistics.average_grade?.toFixed(1) || "—"}
              </p>
            </div>
            <div className="rounded-xl border border-green-100 bg-white/70 p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-500 mb-1">
                Hoogste cijfer
              </h3>
              <p className="text-2xl font-bold text-green-600">
                {data.statistics.highest_grade?.toFixed(1) || "—"}
              </p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-white/70 p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-500 mb-1">
                Laagste cijfer
              </h3>
              <p className="text-2xl font-bold text-amber-600">
                {data.statistics.lowest_grade?.toFixed(1) || "—"}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white/70 p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-500 mb-1">
                Openstaand
              </h3>
              <p className="text-2xl font-bold text-gray-900">
                {data.statistics.pending_assessments}
              </p>
            </div>
          </>
        )}
        {viewMode === "students" && studentsData && (
          <>
            <div className="rounded-xl border border-blue-100 bg-white/70 p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-500 mb-1">
                Gemiddeld cijfer
              </h3>
              <p className="text-2xl font-bold text-gray-900">
                {studentsData.statistics.average_grade?.toFixed(1) || "—"}
              </p>
            </div>
            <div className="rounded-xl border border-green-100 bg-white/70 p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-500 mb-1">
                Hoogste cijfer
              </h3>
              <p className="text-2xl font-bold text-green-600">
                {studentsData.statistics.highest_grade?.toFixed(1) || "—"}
              </p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-white/70 p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-500 mb-1">
                Laagste cijfer
              </h3>
              <p className="text-2xl font-bold text-amber-600">
                {studentsData.statistics.lowest_grade?.toFixed(1) || "—"}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white/70 p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-500 mb-1">
                Openstaand
              </h3>
              <p className="text-2xl font-bold text-gray-900">
                {studentsData.statistics.pending_assessments}
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
