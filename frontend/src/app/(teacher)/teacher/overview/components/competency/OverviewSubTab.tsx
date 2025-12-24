"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCompetencyOverview } from "@/hooks/useCompetencyOverview";
import { Loading, ErrorMessage } from "@/components";
import { CompetencyRadarChart, CATEGORY_COLORS } from "@/components/student/competency/CompetencyRadarChart";
import { SpreadChartCompact } from "@/components/teacher/competency/SpreadChartCompact";
import type { CompetencyOverviewFilters } from "@/dtos/competency-monitor.dto";

interface OverviewSubTabProps {
  filters: CompetencyOverviewFilters;
}

export function OverviewSubTab({ filters }: OverviewSubTabProps) {
  const { data, loading, error } = useCompetencyOverview(filters);
  const [chartMode, setChartMode] = useState<"average" | "spread" | "growth">("average");
  const [selectedScanId, setSelectedScanId] = useState<number | null>(null);

  // Prepare radar chart data
  const radarData = useMemo(() => {
    if (!data?.categorySummaries) return [];
    return data.categorySummaries
      .filter((cat) => cat.averageScore != null && !isNaN(cat.averageScore))
      .map((cat) => ({
        name: cat.name,
        value: cat.averageScore,
      }));
  }, [data]);

  // Select the latest scan by default
  const selectedScan = useMemo(() => {
    if (!data?.scans || data.scans.length === 0) return null;
    if (selectedScanId !== null) {
      return data.scans.find(s => s.scanId === selectedScanId) || data.scans[0];
    }
    return data.scans[0];
  }, [data, selectedScanId]);

  // Calculate spread status
  const getSpreadStatus = (scan: typeof selectedScan) => {
    if (!scan) return null;
    const spread = scan.p90 - scan.p10;
    if (spread > 2.5) return { label: "Groot", color: "text-orange-600" };
    if (spread > 1.5) return { label: "Aandacht", color: "text-yellow-600" };
    return { label: "Homogeen", color: "text-green-600" };
  };

  const spreadStatus = getSpreadStatus(selectedScan);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <ErrorMessage message="Geen data beschikbaar" />;

  const getScoreColor = (score: number | null): string => {
    if (score === null) return "bg-gray-100 text-gray-400";
    if (score >= 4) return "bg-green-100 text-green-700";
    if (score >= 3) return "bg-blue-100 text-blue-700";
    return "bg-orange-100 text-orange-700";
  };

  const getTrendArrow = (delta: number | null) => {
    if (delta === null || delta === 0) return <span className="text-gray-400">→</span>;
    if (delta > 0) return <span className="text-green-600">↑</span>;
    return <span className="text-red-600">↓</span>;
  };

  const getTrendColor = (delta: number | null): string => {
    if (delta === null || delta === 0) return "text-gray-500";
    if (delta > 0) return "text-green-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Gemiddelde score</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">
            {data.classAverageScore?.toFixed(1) || "–"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Trend vs vorige scan</p>
          <div className="mt-1 flex items-center gap-2">
            <span className={`text-3xl font-bold ${getTrendColor(data.classTrendDelta)}`}>
              {data.classTrendDelta !== null ? (data.classTrendDelta > 0 ? "+" : "") + data.classTrendDelta.toFixed(1) : "–"}
            </span>
            <span className="text-2xl">{getTrendArrow(data.classTrendDelta)}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm">
          <p className="text-xs text-green-600">Vooruitgang</p>
          <p className="mt-1 text-3xl font-bold text-green-700">{data.studentsImproved}</p>
          <p className="text-xs text-green-600 mt-1">leerlingen</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <p className="text-xs text-red-600">Achteruitgang</p>
          <p className="mt-1 text-3xl font-bold text-red-700">{data.studentsDeclined}</p>
          <p className="text-xs text-red-600 mt-1">leerlingen</p>
        </div>
      </section>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900">Klasprofiel per categorie</h3>
          <p className="text-sm text-slate-500 mb-4">Gemiddelde scores van de laatste scan</p>
          <div className="flex justify-center">
            <CompetencyRadarChart items={radarData} size={280} maxValue={5} />
          </div>
          {/* Legend */}
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            {data.categorySummaries.map((cat, index) => (
              <div key={cat.id} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                />
                <span className="text-slate-600 truncate">{cat.name}</span>
                <span className="font-medium text-slate-900">{cat.averageScore.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Spread Chart - Compact visualization */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Ontwikkeling over tijd</h3>
              <p className="text-sm text-slate-500">Gemiddelde + spreiding per scan (compact)</p>
            </div>
            {/* Segmented control for mode */}
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              <button
                onClick={() => setChartMode("average")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  chartMode === "average"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Gemiddelde
              </button>
              <button
                onClick={() => setChartMode("spread")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  chartMode === "spread"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Spreiding
              </button>
              <button
                onClick={() => setChartMode("growth")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  chartMode === "growth"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Groei
              </button>
            </div>
          </div>

          {/* Chart */}
          <div className="mt-4 mb-4">
            {data.scans.length > 0 ? (
              <SpreadChartCompact scans={data.scans} mode={chartMode} />
            ) : (
              <div className="h-[180px] flex items-center justify-center text-sm text-slate-400">
                Geen scan data beschikbaar
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-slate-600 mb-4 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Gemiddelde</span>
            </div>
            {chartMode === "spread" && (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2 bg-blue-500 opacity-15"></div>
                  <span>P25–P75</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2 bg-blue-500 opacity-10"></div>
                  <span>P10–P90</span>
                </div>
              </>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-slate-400 border-t-2 border-dashed border-slate-400"></div>
              <span>Mediaan</span>
            </div>
          </div>

          {/* Selected scan details */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-slate-700">Geselecteerde scan</label>
              <select
                value={selectedScan?.scanId || ""}
                onChange={(e) => setSelectedScanId(Number(e.target.value))}
                className="text-sm border border-slate-200 rounded-md px-2 py-1 bg-white"
              >
                {data.scans.map((scan) => (
                  <option key={scan.scanId} value={scan.scanId}>
                    {scan.label}
                  </option>
                ))}
              </select>
            </div>

            {selectedScan && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500">Gem.</span>
                  <div className="font-semibold text-slate-900">{selectedScan.overallAverage.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-slate-500">Mediaan</span>
                  <div className="font-semibold text-slate-900">{selectedScan.median.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-slate-500">P10–P90</span>
                  <div className="font-semibold text-slate-900">
                    {selectedScan.p10.toFixed(1)} – {selectedScan.p90.toFixed(1)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">P25–P75</span>
                  <div className="font-semibold text-slate-900">
                    {selectedScan.p25.toFixed(1)} – {selectedScan.p75.toFixed(1)}
                  </div>
                </div>
                {spreadStatus && (
                  <div className="col-span-2 pt-2 border-t border-slate-200">
                    <span className="text-slate-500">Spreiding: </span>
                    <span className={`font-semibold ${spreadStatus.color}`}>{spreadStatus.label}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-lg font-semibold text-slate-900">Klasoverzicht per categorie</h3>
          <p className="text-sm text-slate-500">Gemiddelde scores per leerling van de laatste scan - Klik op een leerling voor meer details</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="sticky left-0 z-20 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide min-w-[180px]">
                  Leerling
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">
                  Klas
                </th>
                {data.categorySummaries.map((cat) => (
                  <th
                    key={cat.id}
                    className="px-3 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide min-w-[90px]"
                    title={cat.name}
                  >
                    <span className="block truncate max-w-[80px]">{cat.name}</span>
                    {cat.trendDelta !== null && (
                      <span className={`block text-[10px] font-normal mt-0.5 ${getTrendColor(cat.trendDelta)}`}>
                        {cat.trendDelta > 0 ? '+' : ''}{cat.trendDelta.toFixed(1)}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.heatmapRows.map((row) => (
                <tr key={row.studentId} className="bg-white hover:bg-slate-50">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2 text-sm text-slate-800 font-medium border-r border-slate-100">
                    <Link
                      href={`/teacher/competencies/student/${row.studentId}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-center text-sm text-slate-600">
                    {row.className || "–"}
                  </td>
                  {data.categorySummaries.map((cat) => {
                    const score = row.scores[cat.id];
                    const delta = row.scoreDeltas[cat.id];
                    return (
                      <td key={cat.id} className="px-3 py-2 text-center">
                        {score !== null && score !== undefined ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-md text-sm font-semibold ${getScoreColor(score)}`}>
                              {score.toFixed(1)}
                            </span>
                            {delta !== null && delta !== undefined && (
                              <span className={`text-[10px] font-medium ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">–</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notable Students */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Opvallende leerlingen</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Strong Growth */}
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
              <span className="text-lg">📈</span> Sterke groei
            </h4>
            <div className="space-y-2">
              {data.notableStudents.filter((s) => s.type === "strong_growth").map((student, index) => (
                <Link
                  key={`strong-growth-${student.studentId}-${student.categoryName || index}`}
                  href={`/teacher/competencies/student/${student.studentId}`}
                  className="flex items-center justify-between p-2 bg-white rounded-lg hover:shadow-sm transition-shadow"
                >
                  <div className="flex-1">
                    <span className="text-sm text-slate-700">{student.name}</span>
                    {student.categoryName && (
                      <span className="block text-xs text-slate-500">{student.categoryName}</span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-green-600">
                    +{student.trendDelta?.toFixed(1)}
                  </span>
                </Link>
              ))}
              {data.notableStudents.filter((s) => s.type === "strong_growth").length === 0 && (
                <p className="text-sm text-green-600">Geen leerlingen met sterke groei</p>
              )}
            </div>
          </div>

          {/* Decline */}
          <div className="bg-red-50 rounded-xl p-4 border border-red-200">
            <h4 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
              <span className="text-lg">📉</span> Achteruitgang
            </h4>
            <div className="space-y-2">
              {data.notableStudents.filter((s) => s.type === "decline").map((student, index) => (
                <Link
                  key={`decline-${student.studentId}-${student.categoryName || index}`}
                  href={`/teacher/competencies/student/${student.studentId}`}
                  className="flex items-center justify-between p-2 bg-white rounded-lg hover:shadow-sm transition-shadow"
                >
                  <div className="flex-1">
                    <span className="text-sm text-slate-700">{student.name}</span>
                    {student.categoryName && (
                      <span className="block text-xs text-slate-500">{student.categoryName}</span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-red-600">
                    {student.trendDelta?.toFixed(1)}
                  </span>
                </Link>
              ))}
              {data.notableStudents.filter((s) => s.type === "decline").length === 0 && (
                <p className="text-sm text-red-600">Geen leerlingen met achteruitgang</p>
              )}
            </div>
          </div>

          {/* Low Scores */}
          <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
            <h4 className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-2">
              <span className="text-lg">⚠️</span> Lage scores
            </h4>
            <div className="space-y-2">
              {data.notableStudents.filter((s) => s.type === "low_score").map((student, index) => (
                <Link
                  key={`low-score-${student.studentId}-${student.categoryName || index}`}
                  href={`/teacher/competencies/student/${student.studentId}`}
                  className="flex items-center justify-between p-2 bg-white rounded-lg hover:shadow-sm transition-shadow"
                >
                  <div className="flex-1">
                    <span className="text-sm text-slate-700">{student.name}</span>
                    {student.categoryName && (
                      <span className="block text-xs text-slate-500">{student.categoryName}</span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-orange-600">
                    {student.score?.toFixed(1)}
                  </span>
                </Link>
              ))}
              {data.notableStudents.filter((s) => s.type === "low_score").length === 0 && (
                <p className="text-sm text-orange-600">Geen leerlingen met lage scores</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-6 p-4 border border-slate-200 rounded-2xl bg-white shadow-sm">
        <span className="text-sm font-medium text-slate-700">Legenda:</span>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-sm font-medium">≥ 4.0</span>
          <span className="text-sm text-slate-600">Goed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-sm font-medium">3.0 - 3.9</span>
          <span className="text-sm text-slate-600">Voldoende</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-md text-sm font-medium">&lt; 3.0</span>
          <span className="text-sm text-slate-600">Aandacht</span>
        </div>
      </div>
    </div>
  );
}
