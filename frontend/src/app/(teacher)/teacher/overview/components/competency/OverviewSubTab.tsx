"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useCompetencyOverview } from "@/hooks/useCompetencyOverview";
import { Loading, ErrorMessage } from "@/components";
import { CompetencyRadarChart, CATEGORY_COLORS } from "@/components/student/competency/CompetencyRadarChart";
import { SpreadChartCompact } from "@/components/teacher/competency/SpreadChartCompact";
import type { CompetencyOverviewFilters } from "@/dtos/competency-monitor.dto";
import { competencyMonitorService } from "@/services/competency-monitor.service";

interface OverviewSubTabProps {
  filters: CompetencyOverviewFilters;
}

interface StudentScanScore {
  scanId: number;
  scanLabel: string;
  scanDate: string;
  categoryScores: Record<number, number | null>;
}

interface StudentHistoricalData {
  studentId: number;
  studentName: string;
  className: string | null;
  scans: StudentScanScore[];
}

export function OverviewSubTab({ filters }: OverviewSubTabProps) {
  const { data, loading, error } = useCompetencyOverview(filters);
  const [chartMode, setChartMode] = useState<"average" | "spread" | "growth">("average");
  const [selectedScanId, setSelectedScanId] = useState<number | null>(null);
  const [selectedRadarScanId, setSelectedRadarScanId] = useState<number | null>(null);
  const [expandedStudents, setExpandedStudents] = useState<Set<number>>(new Set());
  const [studentHistoricalData, setStudentHistoricalData] = useState<Record<number, StudentHistoricalData>>({});
  const [loadingStudentData, setLoadingStudentData] = useState<Record<number, boolean>>({});
  const [radarChartKey, setRadarChartKey] = useState(0);

  // Increment key whenever selected scan changes to force re-render
  useEffect(() => {
    setRadarChartKey(Date.now());
  }, [selectedRadarScanId]);

  // Prepare selected scan data for radar chart
  const selectedRadarScan = useMemo(() => {
    if (!data?.scans || data.scans.length === 0) return null;
    
    const foundScan = selectedRadarScanId !== null
      ? data.scans.find(s => s.scanId === selectedRadarScanId)
      : data.scans[0];
    
    return foundScan || data.scans[0];
  }, [data?.scans, selectedRadarScanId]);

  // Prepare radar chart data - use selectedRadarScanId if available, otherwise use latest
  const radarData = useMemo(() => {
    if (!selectedRadarScan) return [];
    
    return selectedRadarScan.categoryAverages
      .filter((cat) => cat.averageScore != null && !isNaN(cat.averageScore))
      .map((cat) => ({
        name: cat.categoryName,
        value: cat.averageScore,
      }));
  }, [selectedRadarScan]);

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

  const toggleStudentRow = async (studentId: number) => {
    const newExpanded = new Set(expandedStudents);
    if (newExpanded.has(studentId)) {
      newExpanded.delete(studentId);
    } else {
      newExpanded.add(studentId);
      
      // Fetch historical data if not already loaded
      if (!studentHistoricalData[studentId] && !loadingStudentData[studentId]) {
        setLoadingStudentData(prev => ({ ...prev, [studentId]: true }));
        
        try {
          const histData = await competencyMonitorService.getStudentHistoricalScores(
            studentId,
            filters.courseId
          );
          
          if (histData) {
            setStudentHistoricalData(prev => ({ ...prev, [studentId]: histData }));
          }
        } catch (error) {
          console.error(`Failed to fetch historical data for student ${studentId}:`, error);
        } finally {
          setLoadingStudentData(prev => ({ ...prev, [studentId]: false }));
        }
      }
    }
    setExpandedStudents(newExpanded);
  };

  return (
    <div className="space-y-6 text-slate-900">
      {/* KPI Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Gemiddelde score</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">
            {data.classAverageScore?.toFixed(1) || "–"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Trend vs vorige scan</p>
          <div className="mt-1 flex items-center gap-2">
            <span className={`text-2xl font-semibold tabular-nums ${getTrendColor(data.classTrendDelta)}`}>
              {data.classTrendDelta !== null ? (data.classTrendDelta > 0 ? "+" : "") + data.classTrendDelta.toFixed(1) : "–"}
            </span>
            <span className="text-xl">{getTrendArrow(data.classTrendDelta)}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm">
          <p className="text-xs font-medium text-green-600">Vooruitgang</p>
          <p className="mt-1 text-2xl font-semibold text-green-700 tabular-nums">{data.studentsImproved}</p>
          <p className="text-xs text-green-600 mt-1">leerlingen</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <p className="text-xs font-medium text-red-600">Achteruitgang</p>
          <p className="mt-1 text-2xl font-semibold text-red-700 tabular-nums">{data.studentsDeclined}</p>
          <p className="text-xs text-red-600 mt-1">leerlingen</p>
        </div>
      </section>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900 leading-6">Klasprofiel per categorie</h3>
              <p className="text-sm text-slate-600">
                {selectedRadarScan
                  ? `Gemiddelde scores van ${selectedRadarScan.label}`
                  : 'Gemiddelde scores van de laatste scan'}
              </p>
            </div>
            {/* Scan Selector Dropdown */}
            {data.scans.length > 0 && (
              <select
                className="text-xs border rounded-md px-2 py-1"
                value={selectedRadarScanId || ""}
                onChange={(e) => setSelectedRadarScanId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Laatste scan</option>
                {data.scans.map((scan) => (
                  <option key={scan.scanId} value={scan.scanId}>
                    {scan.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex justify-center mt-4">
            <CompetencyRadarChart 
              key={radarChartKey}
              items={radarData} 
              size={280} 
              maxValue={5} 
            />
          </div>
          {/* Legend - Update to use selected scan data */}
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            {selectedRadarScan?.categoryAverages.map((cat, index) => (
              <div key={cat.categoryId} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                />
                <span className="text-slate-600 truncate">{cat.categoryName}</span>
                <span className="font-semibold text-slate-900 tabular-nums">{cat.averageScore.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Spread Chart - Compact visualization */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900 leading-6">Ontwikkeling over tijd</h3>
              <p className="text-sm text-slate-600">Gemiddelde + spreiding per scan</p>
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
          <div className="mt-4 rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Geselecteerde scan</div>
              <div className="flex items-center gap-2">
                <select
                  className="text-xs border rounded-md px-2 py-1"
                  value={selectedScan?.scanId || ""}
                  onChange={(e) => setSelectedScanId(Number(e.target.value))}
                >
                  {data.scans.map((scan) => (
                    <option key={scan.scanId} value={scan.scanId}>
                      {scan.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedScan && (
              <>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-slate-500">Gem.</div>
                    <div className="font-medium text-slate-900 tabular-nums">
                      {selectedScan.overallAverage.toFixed(2)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="text-slate-500">Mediaan</div>
                    <div className="font-medium text-slate-900 tabular-nums">
                      {selectedScan.median.toFixed(2)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="text-slate-500">P10–P90</div>
                    <div className="font-medium text-slate-900 tabular-nums">
                      {selectedScan.p10.toFixed(1)}–{selectedScan.p90.toFixed(1)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="text-slate-500">P25–P75</div>
                    <div className="font-medium text-slate-900 tabular-nums">
                      {selectedScan.p25.toFixed(1)}–{selectedScan.p75.toFixed(1)}
                    </div>
                  </div>
                </div>

                {spreadStatus && (
                  <div className="mt-2 text-xs text-slate-600">
                    Spreiding: <span className={`font-medium ${
                      spreadStatus.label === "Groot" ? "text-red-700" :
                      spreadStatus.label === "Aandacht" ? "text-orange-700" :
                      "text-green-700"
                    }`}>{spreadStatus.label}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-base font-semibold text-slate-900 leading-6">Klasoverzicht per categorie</h3>
          <p className="text-sm text-slate-600">Gemiddelde scores per leerling van de laatste scan - Klik op een rij om voorgaande scans te zien</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="sticky left-0 z-20 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide min-w-[140px]">
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
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.heatmapRows.map((row) => {
                const isExpanded = expandedStudents.has(row.studentId);
                
                return (
                  <React.Fragment key={row.studentId}>
                    <tr 
                      className="bg-white hover:bg-slate-50 cursor-pointer"
                      onClick={() => toggleStudentRow(row.studentId)}
                    >
                      <td className="sticky left-0 z-10 bg-white px-4 py-2 text-sm text-slate-900 font-medium border-r border-slate-100">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          )}
                          <span>{row.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-slate-600">
                        {row.className || "–"}
                      </td>
                      {data.categorySummaries.map((cat) => {
                        const score = row.scores[cat.id];
                        const delta = row.scoreDeltas[cat.id];
                        return (
                          <td key={cat.id} className="px-3 py-2 text-left">
                            {score !== null && score !== undefined ? (
                              <div className="flex items-center gap-1">
                                <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-md text-sm font-semibold tabular-nums ${getScoreColor(score)}`}>
                                  {score.toFixed(1)}
                                </span>
                                {delta !== null && delta !== undefined && delta !== 0 && (
                                  <span className={`text-[10px] font-medium tabular-nums ${delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
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
                    
                    {/* Expanded Row Content */}
                    {isExpanded && (
                      <tr className="bg-slate-50">
                        <td colSpan={data.categorySummaries.length + 2} className="px-4 py-3">
                          {loadingStudentData[row.studentId] ? (
                            <div className="text-center py-4">
                              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                              <p className="text-sm text-slate-600 mt-2">Laden van historische gegevens...</p>
                            </div>
                          ) : studentHistoricalData[row.studentId] ? (
                            <div className="overflow-x-auto">
                              <p className="text-xs text-slate-600 font-medium mb-2">
                                Historische scores van {row.name}
                              </p>
                              <table className="min-w-full text-sm">
                                <thead className="border-b border-slate-300">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Scan</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Datum</th>
                                    {data.categorySummaries.map((cat) => (
                                      <th key={cat.id} className="px-3 py-2 text-center text-xs font-semibold text-slate-600" title={cat.name}>
                                        {cat.name}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                  {studentHistoricalData[row.studentId].scans.map((scan: StudentScanScore) => (
                                    <tr key={scan.scanId} className="hover:bg-slate-100">
                                      <td className="px-3 py-2 text-slate-900 font-medium">{scan.scanLabel}</td>
                                      <td className="px-3 py-2 text-slate-600">
                                        {new Date(scan.scanDate).toLocaleDateString('nl-NL')}
                                      </td>
                                      {data.categorySummaries.map((cat) => {
                                        const score = scan.categoryScores[cat.id];
                                        return (
                                          <td key={cat.id} className="px-3 py-2 text-center">
                                            {score !== null && score !== undefined ? (
                                              <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded text-xs font-semibold ${getScoreColor(score)}`}>
                                                {score.toFixed(1)}
                                              </span>
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
                          ) : (
                            <div className="text-center py-4 text-slate-500">
                              <p className="text-sm">Geen historische gegevens beschikbaar voor deze leerling</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notable Students */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-base font-semibold text-slate-900 leading-6 mb-4">Opvallende leerlingen</h3>
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
                    <span className="text-sm text-slate-900">{student.name}</span>
                    {student.categoryName && (
                      <span className="block text-xs text-slate-600">{student.categoryName}</span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-green-600 tabular-nums">
                    +{student.trendDelta?.toFixed(1)}
                  </span>
                </Link>
              ))}
              {data.notableStudents.filter((s) => s.type === "strong_growth").length === 0 && (
                <p className="text-sm text-green-700">Geen leerlingen met sterke groei</p>
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
                    <span className="text-sm text-slate-900">{student.name}</span>
                    {student.categoryName && (
                      <span className="block text-xs text-slate-600">{student.categoryName}</span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-red-600 tabular-nums">
                    {student.trendDelta?.toFixed(1)}
                  </span>
                </Link>
              ))}
              {data.notableStudents.filter((s) => s.type === "decline").length === 0 && (
                <p className="text-sm text-red-700">Geen leerlingen met achteruitgang</p>
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
                    <span className="text-sm text-slate-900">{student.name}</span>
                    {student.categoryName && (
                      <span className="block text-xs text-slate-600">{student.categoryName}</span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-orange-600 tabular-nums">
                    {student.score?.toFixed(1)}
                  </span>
                </Link>
              ))}
              {data.notableStudents.filter((s) => s.type === "low_score").length === 0 && (
                <p className="text-sm text-orange-700">Geen leerlingen met lage scores</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-6 p-4 border border-slate-200 rounded-2xl bg-white shadow-sm">
        <span className="text-sm font-medium text-slate-700">Legenda:</span>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-sm font-medium tabular-nums">≥ 4.0</span>
          <span className="text-sm text-slate-600">Goed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-sm font-medium tabular-nums">3.0 - 3.9</span>
          <span className="text-sm text-slate-600">Voldoende</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-md text-sm font-medium tabular-nums">&lt; 3.0</span>
          <span className="text-sm text-slate-600">Aandacht</span>
        </div>
      </div>
    </div>
  );
}
