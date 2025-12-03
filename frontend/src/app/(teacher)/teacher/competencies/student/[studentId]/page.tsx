"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useStudentDetail } from "@/hooks/useCompetencyOverview";
import { Loading, ErrorMessage } from "@/components";
import { CompetencyRadarChart, CATEGORY_COLORS } from "@/components/student/competency/CompetencyRadarChart";

export default function StudentCompetencyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId ? Number(params.studentId) : null;
  
  const { data: student, loading, error } = useStudentDetail(studentId);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!student) return <ErrorMessage message="Leerling niet gevonden" />;

  // Prepare radar chart data
  const radarItems = student.currentCategoryScores.map((cs) => ({
    name: cs.categoryName,
    value: cs.score || 0,
  }));

  // Helper functions
  const getScoreColor = (score: number | null): string => {
    if (score === null) return "bg-gray-100 text-gray-400";
    if (score >= 4) return "bg-green-100 text-green-700";
    if (score >= 3) return "bg-blue-100 text-blue-700";
    return "bg-orange-100 text-orange-700";
  };

  const getTrendColor = (delta: number | null): string => {
    if (delta === null || delta === 0) return "text-gray-500";
    if (delta > 0) return "text-green-600";
    return "text-red-600";
  };

  const getTrendArrow = (delta: number | null) => {
    if (delta === null || delta === 0) return "→";
    if (delta > 0) return "↑";
    return "↓";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      in_progress: { label: "Lopend", className: "bg-blue-100 text-blue-700" },
      achieved: { label: "Behaald", className: "bg-green-100 text-green-700" },
      not_achieved: { label: "Niet behaald", className: "bg-red-100 text-red-700" },
    };
    const config = statusMap[status] || { label: status, className: "bg-gray-100 text-gray-700" };
    return (
      <span className={`px-2 py-1 rounded-md text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  return (
    <>
      {/* Page Header - Standard teacher page style */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <Link href="/teacher/overview" className="hover:text-blue-600 transition-colors">
                Overzicht
              </Link>
              <span>/</span>
              <span>Competenties</span>
              <span>/</span>
              <span className="text-gray-900">{student.name}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              {student.name}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
              {student.className && (
                <span className="px-2 py-1 bg-gray-100 rounded-md">
                  Klas {student.className}
                </span>
              )}
              {student.email && <span>{student.email}</span>}
            </div>
          </div>
          <button
            onClick={() => router.back()}
            className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ← Terug
          </button>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <p className="text-xs text-gray-500 mb-1">Huidige score</p>
          <p className={`text-3xl font-bold ${getScoreColor(student.currentOverallScore)} bg-transparent`}>
            {student.currentOverallScore?.toFixed(1) || "–"}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <p className="text-xs text-gray-500 mb-1">Trend</p>
          <div className={`flex items-center gap-1 text-xl font-bold ${getTrendColor(student.trendDelta)}`}>
            <span>
              {student.trendDelta !== null
                ? (student.trendDelta > 0 ? "+" : "") + student.trendDelta.toFixed(1)
                : "–"}
            </span>
            <span className="text-2xl">{getTrendArrow(student.trendDelta)}</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <p className="text-xs text-gray-500 mb-1">Sterkste categorie</p>
          <p className="text-lg font-semibold text-green-700">
            {student.strongestCategory || "–"}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <p className="text-xs text-gray-500 mb-1">Aandachtspunt</p>
          <p className="text-lg font-semibold text-orange-700">
            {student.weakestCategory || "–"}
          </p>
        </div>
      </div>

      {/* Profile & Development */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart - Profile */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Competentieprofiel
          </h2>
          <div className="flex justify-center">
            <CompetencyRadarChart items={radarItems} size={280} />
          </div>
          {/* Legend */}
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            {student.currentCategoryScores.map((cat, index) => (
              <div key={cat.categoryId} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                />
                <span className="text-slate-600 truncate">{cat.categoryName}</span>
                <span className="font-medium text-slate-900">
                  {cat.score?.toFixed(1) || "–"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Development Over Time */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Ontwikkeling over tijd
          </h2>
          <div className="space-y-4">
            {student.scans.map((scan) => (
              <div key={scan.scanId} className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">{scan.scanLabel}</p>
                  <p className="text-xs text-gray-500">{formatDate(scan.scanDate)}</p>
                </div>
                <div className="flex-1">
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${((scan.overallScore || 0) / 5) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="w-12 text-right">
                  <span className="text-sm font-semibold text-gray-900">
                    {scan.overallScore?.toFixed(1) || "–"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-gray-500 text-center">
            Gemiddelde score per scan (schaal 1-5)
          </p>
        </div>
      </div>

      {/* Category Scores Per Scan */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Scores per categorie per scan
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide">
                  Scan
                </th>
                {student.currentCategoryScores.map((cat) => (
                  <th
                    key={cat.categoryId}
                    className="px-3 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide"
                  >
                    <div className="truncate max-w-[100px]" title={cat.categoryName}>
                      {cat.categoryName}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">
                  Gemiddeld
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {student.scans.map((scan) => (
                <tr key={scan.scanId} className="bg-white hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-800 font-medium">
                    {scan.scanLabel}
                    <div className="text-xs text-gray-400">{formatDate(scan.scanDate)}</div>
                  </td>
                  {scan.categoryScores.map((cs) => (
                    <td key={cs.categoryId} className="px-3 py-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-md text-sm font-semibold ${getScoreColor(
                          cs.score
                        )}`}
                      >
                        {cs.score?.toFixed(1) || "–"}
                      </span>
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-md text-sm font-bold ${getScoreColor(
                        scan.overallScore
                      )}`}
                    >
                      {scan.overallScore?.toFixed(1) || "–"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Learning Goals - Table format */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Leerdoelen ({student.learningGoals.length})
        </h2>
        {student.learningGoals.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide">
                    Categorie
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide min-w-[300px]">
                    Leerdoel
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">
                    Datum
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {student.learningGoals.map((goal) => (
                  <tr key={goal.id} className="bg-white hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm">
                      {goal.categoryName ? (
                        <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs">
                          {goal.categoryName}
                        </span>
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-800">
                      {goal.goalText}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(goal.status)}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">
                      {formatDate(goal.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>Geen leerdoelen gevonden voor deze leerling</p>
          </div>
        )}
      </div>

      {/* Reflections */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Reflecties ({student.reflections.length})
        </h2>
        {student.reflections.length > 0 ? (
          <div className="space-y-4">
            {student.reflections.map((reflection) => (
              <div
                key={reflection.id}
                className="p-4 bg-slate-50 rounded-xl border border-slate-200"
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs">
                      {reflection.scanLabel}
                    </span>
                    {reflection.categoryName && (
                      <span className="px-2 py-1 bg-slate-200 text-slate-700 rounded-md text-xs">
                        {reflection.categoryName}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDate(reflection.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-800">{reflection.reflectionText}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>Geen reflecties gevonden voor deze leerling</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 py-4 text-sm text-gray-500 border-t">
        <span className="font-medium">Legenda:</span>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-medium">
            ≥ 4.0
          </span>
          <span>Goed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium">
            3.0 - 3.9
          </span>
          <span>Voldoende</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-xs font-medium">
            &lt; 3.0
          </span>
          <span>Aandacht</span>
        </div>
      </div>
      </div>
    </>
  );
}
