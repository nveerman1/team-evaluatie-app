"use client";

import { useState, Suspense, useEffect } from "react";
import {
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  TrendingUp,
  Search,
  Filter,
  MessageSquare,
  Users,
  LayoutDashboard,
} from "lucide-react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { usePeerOverview, type PeerOverviewFilters } from "@/hooks/usePeerOverview";
import { useFeedbackData, type FeedbackFilters } from "@/hooks/useFeedbackData";
import { overviewService } from "@/services/overview.service";
import { projectService } from "@/services/project.service";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

/* =========================================
   LOADING SKELETON COMPONENTS
   ========================================= */

function ChartSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-64 bg-gray-200 rounded-lg"></div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-10 bg-gray-200 rounded"></div>
      <div className="h-10 bg-gray-200 rounded"></div>
      <div className="h-10 bg-gray-200 rounded"></div>
      <div className="h-10 bg-gray-200 rounded"></div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-32 bg-gray-200 rounded-lg"></div>
    </div>
  );
}

/* =========================================
   TAB 1: DASHBOARD & TRENDS
   ========================================= */

function DashboardTab({ filters }: { filters: PeerOverviewFilters }) {
  const { data, loading, error } = usePeerOverview(filters);

  if (error) {
    return (
      <div className="text-red-500 p-4 bg-red-50 rounded-lg">
        Fout bij laden: {error}
      </div>
    );
  }

  // Chart configuration
  const chartData = {
    labels: data?.trendData.map((d) => d.date) || [],
    datasets: [
      {
        label: "Organiseren",
        data: data?.trendData.map((d) => d.organiseren) || [],
        borderColor: "#3b82f6",
        backgroundColor: "#3b82f680",
        tension: 0.3,
      },
      {
        label: "Meedoen",
        data: data?.trendData.map((d) => d.meedoen) || [],
        borderColor: "#10b981",
        backgroundColor: "#10b98180",
        tension: 0.3,
      },
      {
        label: "Zelfvertrouwen",
        data: data?.trendData.map((d) => d.zelfvertrouwen) || [],
        borderColor: "#f59e0b",
        backgroundColor: "#f59e0b80",
        tension: 0.3,
      },
      {
        label: "Autonomie",
        data: data?.trendData.map((d) => d.autonomie) || [],
        borderColor: "#8b5cf6",
        backgroundColor: "#8b5cf680",
        tension: 0.3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
      },
    },
    scales: {
      y: {
        min: 1,
        max: 5,
        ticks: {
          stepSize: 0.5,
        },
      },
    },
  };

  const getTrendIcon = (trend: "up" | "down" | "neutral") => {
    if (trend === "up") return <ArrowUp className="w-4 h-4 text-green-600" />;
    if (trend === "down") return <ArrowDown className="w-4 h-4 text-red-600" />;
    return <span className="w-4 h-4 text-gray-400">—</span>;
  };

  const getScoreColor = (score: number | null): string => {
    if (score === null) return "bg-gray-100 text-gray-400";
    if (score >= 4) return "bg-green-100 text-green-700";
    if (score >= 3) return "bg-blue-100 text-blue-700";
    return "bg-orange-100 text-orange-700";
  };

  const getTrendDelta = (trend: "up" | "down" | "neutral"): number | null => {
    // TODO: Calculate actual delta from previous evaluation
    // For now, return estimated values based on trend
    if (trend === "up") return 0.2;
    if (trend === "down") return -0.2;
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Section 1: OMZA Trends Line Chart */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          OMZA Trends over tijd
        </h3>
        <Suspense fallback={<ChartSkeleton />}>
          {loading ? (
            <ChartSkeleton />
          ) : (
            <div className="h-64">
              <Line data={chartData} options={chartOptions} />
            </div>
          )}
        </Suspense>
        {/* Legend with colored dots */}
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>Organiseren</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Meedoen</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span>Zelfvertrouwen</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-violet-500"></div>
            <span>Autonomie</span>
          </div>
        </div>
      </div>

      {/* Section 2: Leerling Heatmap */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-base font-semibold text-slate-900 leading-6">Leerling Heatmap</h3>
          <p className="text-sm text-slate-600">OMZA-scores per leerling</p>
        </div>
        <Suspense fallback={<div className="p-6"><TableSkeleton /></div>}>
          {loading ? (
            <div className="p-6"><TableSkeleton /></div>
          ) : (
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
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide min-w-[90px]">
                      <span className="block">Organiseren</span>
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide min-w-[90px]">
                      <span className="block">Meedoen</span>
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide min-w-[90px]">
                      <span className="block">Zelfvertrouwen</span>
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide min-w-[90px]">
                      <span className="block">Autonomie</span>
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide min-w-[90px]">
                      Self vs Peer
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.heatmapData.map((student) => (
                    <tr key={student.student_id} className="bg-white hover:bg-slate-50">
                      <td className="sticky left-0 z-10 bg-white px-4 py-2 text-sm text-slate-900 font-medium border-r border-slate-100">
                        {student.student_name}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-slate-600">
                        {student.class_name || "–"}
                      </td>
                      {/* Organiseren */}
                      <td className="px-3 py-2 text-left">
                        {student.scores.organiseren ? (
                          <div className="flex items-center gap-1">
                            <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-md text-sm font-semibold tabular-nums ${getScoreColor(student.scores.organiseren.current)}`}>
                              {student.scores.organiseren.current.toFixed(1)}
                            </span>
                            {getTrendDelta(student.scores.organiseren.trend) !== null && (
                              <span className={`text-[10px] font-medium tabular-nums ${getTrendDelta(student.scores.organiseren.trend)! > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {getTrendDelta(student.scores.organiseren.trend)! > 0 ? '+' : ''}{getTrendDelta(student.scores.organiseren.trend)!.toFixed(1)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">–</span>
                        )}
                      </td>
                      {/* Meedoen */}
                      <td className="px-3 py-2 text-left">
                        {student.scores.meedoen ? (
                          <div className="flex items-center gap-1">
                            <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-md text-sm font-semibold tabular-nums ${getScoreColor(student.scores.meedoen.current)}`}>
                              {student.scores.meedoen.current.toFixed(1)}
                            </span>
                            {getTrendDelta(student.scores.meedoen.trend) !== null && (
                              <span className={`text-[10px] font-medium tabular-nums ${getTrendDelta(student.scores.meedoen.trend)! > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {getTrendDelta(student.scores.meedoen.trend)! > 0 ? '+' : ''}{getTrendDelta(student.scores.meedoen.trend)!.toFixed(1)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">–</span>
                        )}
                      </td>
                      {/* Zelfvertrouwen */}
                      <td className="px-3 py-2 text-left">
                        {student.scores.zelfvertrouwen ? (
                          <div className="flex items-center gap-1">
                            <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-md text-sm font-semibold tabular-nums ${getScoreColor(student.scores.zelfvertrouwen.current)}`}>
                              {student.scores.zelfvertrouwen.current.toFixed(1)}
                            </span>
                            {getTrendDelta(student.scores.zelfvertrouwen.trend) !== null && (
                              <span className={`text-[10px] font-medium tabular-nums ${getTrendDelta(student.scores.zelfvertrouwen.trend)! > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {getTrendDelta(student.scores.zelfvertrouwen.trend)! > 0 ? '+' : ''}{getTrendDelta(student.scores.zelfvertrouwen.trend)!.toFixed(1)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">–</span>
                        )}
                      </td>
                      {/* Autonomie */}
                      <td className="px-3 py-2 text-left">
                        {student.scores.autonomie ? (
                          <div className="flex items-center gap-1">
                            <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-md text-sm font-semibold tabular-nums ${getScoreColor(student.scores.autonomie.current)}`}>
                              {student.scores.autonomie.current.toFixed(1)}
                            </span>
                            {getTrendDelta(student.scores.autonomie.trend) !== null && (
                              <span className={`text-[10px] font-medium tabular-nums ${getTrendDelta(student.scores.autonomie.trend)! > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {getTrendDelta(student.scores.autonomie.trend)! > 0 ? '+' : ''}{getTrendDelta(student.scores.autonomie.trend)!.toFixed(1)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">–</span>
                        )}
                      </td>
                      {/* Self vs Peer */}
                      <td className="px-3 py-2 text-center">
                        <span className={`text-sm font-medium tabular-nums ${
                          (student.self_vs_peer_diff || 0) > 0.3
                            ? "text-red-600"
                            : (student.self_vs_peer_diff || 0) < -0.3
                            ? "text-amber-600"
                            : "text-slate-600"
                        }`}>
                          {student.self_vs_peer_diff !== undefined
                            ? ((student.self_vs_peer_diff || 0) > 0 ? "+" : "") + student.self_vs_peer_diff.toFixed(1)
                            : "–"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Suspense>
      </div>

      {/* Section 3: KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Suspense fallback={<CardSkeleton />}>
          {loading ? (
            <>
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </>
          ) : (
            <>
              {/* Grootste stijgers */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowUp className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold text-gray-900">Grootste stijgers</h4>
                </div>
                <div className="space-y-2">
                  {data?.kpiData.grootsteStijgers.map((student, idx) => (
                    <div
                      key={student.student_id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-700">
                        {idx + 1}. {student.student_name}
                      </span>
                      <span className="text-green-600 font-medium">
                        +{student.value.toFixed(1)}
                      </span>
                    </div>
                  ))}
                  {data?.kpiData.grootsteStijgers.length === 0 && (
                    <span className="text-gray-400 text-sm">Geen data</span>
                  )}
                </div>
              </div>

              {/* Grootste dalers */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowDown className="w-5 h-5 text-red-600" />
                  <h4 className="font-semibold text-gray-900">Grootste dalers</h4>
                </div>
                <div className="space-y-2">
                  {data?.kpiData.grootsteDalers.map((student, idx) => (
                    <div
                      key={student.student_id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-700">
                        {idx + 1}. {student.student_name}
                      </span>
                      <span className="text-red-600 font-medium">
                        {student.value.toFixed(1)}
                      </span>
                    </div>
                  ))}
                  {data?.kpiData.grootsteDalers.length === 0 && (
                    <span className="text-gray-400 text-sm">Geen data</span>
                  )}
                </div>
              </div>

              {/* Structureel lage scores */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h4 className="font-semibold text-gray-900">Structureel laag</h4>
                </div>
                <div className="space-y-2">
                  {data?.kpiData.structureelLaag.map((student, idx) => (
                    <div
                      key={student.student_id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-700">
                        {idx + 1}. {student.student_name}
                      </span>
                      <span className="text-amber-600 font-medium">
                        {student.value.toFixed(1)}
                      </span>
                    </div>
                  ))}
                  {data?.kpiData.structureelLaag.length === 0 && (
                    <span className="text-gray-400 text-sm">Geen data</span>
                  )}
                </div>
              </div>

              {/* Inconsistenties */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-violet-600" />
                  <h4 className="font-semibold text-gray-900">Inconsistenties</h4>
                </div>
                <p className="text-xs text-gray-500 mb-2">Self vs peer verschil</p>
                <div className="space-y-2">
                  {data?.kpiData.inconsistenties.map((student, idx) => (
                    <div
                      key={student.student_id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-700">
                        {idx + 1}. {student.student_name}
                      </span>
                      <span className="text-violet-600 font-medium">
                        Δ{student.value.toFixed(1)}
                      </span>
                    </div>
                  ))}
                  {data?.kpiData.inconsistenties.length === 0 && (
                    <span className="text-gray-400 text-sm">Geen data</span>
                  )}
                </div>
              </div>
            </>
          )}
        </Suspense>
      </div>
    </div>
  );
}

/* =========================================
   TAB 2: FEEDBACKVERZAMELING
   ========================================= */

function FeedbackTab({ parentFilters }: { parentFilters: PeerOverviewFilters }) {
  const [localFilters, setLocalFilters] = useState<Omit<FeedbackFilters, 'courseId' | 'projectId'>>({});
  
  // Merge parent filters (courseId, projectId) with local filters (category, sentiment, etc.)
  const mergedFilters: FeedbackFilters = {
    courseId: parentFilters.courseId,
    projectId: parentFilters.projectId,
    ...localFilters,
  };
  
  const { data, loading, error } = useFeedbackData(mergedFilters);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positief":
        return "ring-green-200 bg-green-50 text-green-700";
      case "kritiek":
        return "ring-red-200 bg-red-50 text-red-700";
      case "waarschuwing":
        return "ring-amber-200 bg-amber-50 text-amber-700";
      default:
        return "ring-slate-200 bg-slate-50 text-slate-700";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "organiseren":
        return "ring-blue-200 bg-blue-50 text-blue-700";
      case "meedoen":
        return "ring-green-200 bg-green-50 text-green-700";
      case "zelfvertrouwen":
        return "ring-amber-200 bg-amber-50 text-amber-700";
      case "autonomie":
        return "ring-violet-200 bg-violet-50 text-violet-700";
      default:
        return "ring-slate-200 bg-slate-50 text-slate-700";
    }
  };

  if (error) {
    return (
      <div className="text-red-500 p-4 bg-red-50 rounded-lg">
        Fout bij laden: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="bg-slate-50 rounded-xl p-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Category filter */}
          <div>
            <label className="block text-xs text-slate-600 mb-1">OMZA Categorie</label>
            <select
              className="px-3 py-2 text-sm border rounded-lg min-w-[150px]"
              value={localFilters.category || ""}
              onChange={(e) =>
                setLocalFilters({ ...localFilters, category: e.target.value || undefined })
              }
            >
              <option value="">Alle categorieën</option>
              <option value="organiseren">Organiseren</option>
              <option value="meedoen">Meedoen</option>
              <option value="zelfvertrouwen">Zelfvertrouwen</option>
              <option value="autonomie">Autonomie</option>
            </select>
          </div>

          {/* Sentiment filter */}
          <div>
            <label className="block text-xs text-slate-600 mb-1">Sentiment</label>
            <select
              className="px-3 py-2 text-sm border rounded-lg min-w-[150px]"
              value={localFilters.sentiment || ""}
              onChange={(e) =>
                setLocalFilters({ ...localFilters, sentiment: e.target.value || undefined })
              }
            >
              <option value="">Alle sentimenten</option>
              <option value="positief">Positief</option>
              <option value="kritiek">Kritiek</option>
              <option value="waarschuwing">Waarschuwing</option>
            </select>
          </div>

          {/* Search text */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-slate-600 mb-1">Zoeken in feedback</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Zoek op trefwoord..."
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
                value={localFilters.searchText || ""}
                onChange={(e) =>
                  setLocalFilters({ ...localFilters, searchText: e.target.value || undefined })
                }
              />
            </div>
          </div>

          {/* Risk behavior toggle */}
          <div className="flex items-center gap-2 mt-5">
            <input
              type="checkbox"
              id="riskOnly"
              className="w-4 h-4 rounded border-slate-300"
              checked={localFilters.riskOnly || false}
              onChange={(e) =>
                setLocalFilters({ ...localFilters, riskOnly: e.target.checked || undefined })
              }
            />
            <label htmlFor="riskOnly" className="text-sm text-slate-700">
              Alleen risico-gedrag
            </label>
          </div>

          {/* Clear filters button */}
          <button
            onClick={() => setLocalFilters({})}
            className="px-3 py-2 border rounded-lg text-sm hover:bg-slate-100 mt-5"
          >
            Filters wissen
          </button>
        </div>
      </div>

      {/* Feedback Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-base font-semibold text-slate-900 leading-6">
            Feedback ({data?.totalCount || 0} resultaten)
          </h3>
          <p className="text-sm text-slate-600">Verzamelde feedback uit peer evaluaties</p>
        </div>

        <Suspense fallback={<div className="p-6"><TableSkeleton /></div>}>
          {loading ? (
            <div className="p-6"><TableSkeleton /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide min-w-[120px]">
                      Student
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide min-w-[120px]">
                      Project/Scan
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">
                      Categorie
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">
                      Sentiment
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide">
                      Feedback
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">
                      Datum
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.feedbackItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Geen feedback gevonden voor de geselecteerde filters
                      </td>
                    </tr>
                  ) : (
                    data?.feedbackItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-800">
                          {item.student_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-800">
                          {item.project_name}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs ring-1 ${getCategoryColor(item.category)}`}>
                            {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs ring-1 ${getSentimentColor(item.sentiment)}`}>
                            {item.sentiment.charAt(0).toUpperCase() + item.sentiment.slice(1)}
                          </span>
                          {item.is_risk_behavior && (
                            <span className="ml-1 text-red-600" title="Risico gedrag">⚠️</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-800 max-w-md">
                          <p className="line-clamp-2">{item.text}</p>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-slate-600">
                          {new Date(item.date).toLocaleDateString("nl-NL", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric"
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Suspense>
      </div>
    </div>
  );
}

/* =========================================
   MAIN COMPONENT: PEEREVALUATIES TAB
   ========================================= */

export default function PeerevaluatiesTab() {
  const [activeSubTab, setActiveSubTab] = useState("dashboard");
  const [filters, setFilters] = useState<PeerOverviewFilters>({
    period: "6months",
  });
  const [courses, setCourses] = useState<Array<{id: number; name: string}>>([]);
  const [projects, setProjects] = useState<Array<{id: number; title: string}>>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Fetch active courses on mount
  useEffect(() => {
    const fetchCourses = async () => {
      setLoadingCourses(true);
      try {
        const data = await overviewService.getCourses();
        setCourses(data);
      } catch (error) {
        console.error("Failed to fetch courses:", error);
      } finally {
        setLoadingCourses(false);
      }
    };
    fetchCourses();
  }, []);

  // Fetch projects when course changes
  useEffect(() => {
    if (!filters.courseId) {
      setProjects([]);
      return;
    }
    
    const fetchProjects = async () => {
      setLoadingProjects(true);
      try {
        const response = await projectService.listProjects({
          course_id: filters.courseId,
          per_page: 100,
        });
        setProjects(response.items || []);
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      } finally {
        setLoadingProjects(false);
      }
    };
    fetchProjects();
  }, [filters.courseId]);

  const subTabs = [
    { id: "dashboard", label: "Dashboard & Trends", icon: LayoutDashboard },
    { id: "feedback", label: "Feedbackverzameling", icon: MessageSquare },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title & Subtitle */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Peerevaluaties – Overzicht
        </h2>
        <p className="text-gray-600 mt-1">
          Inzicht in ontwikkeling, trends en feedback uit meerdere scans.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Course dropdown */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Selecteer vak</label>
            <select
              className="w-full px-3 py-2 border rounded-lg text-sm"
              value={filters.courseId || ""}
              onChange={(e) =>
                setFilters({ ...filters, courseId: e.target.value ? parseInt(e.target.value) : undefined, projectId: undefined })
              }
              disabled={loadingCourses}
            >
              <option value="">Alle vakken</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>

          {/* Project dropdown */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Selecteer project/evaluatiegroep
            </label>
            <select
              className="w-full px-3 py-2 border rounded-lg text-sm"
              value={filters.projectId || ""}
              onChange={(e) =>
                setFilters({ ...filters, projectId: e.target.value ? parseInt(e.target.value) : undefined })
              }
              disabled={!filters.courseId || loadingProjects}
            >
              <option value="">Alle projecten</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>

          {/* Period dropdown */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Periode</label>
            <select
              className="w-full px-3 py-2 border rounded-lg text-sm"
              value={filters.period || "6months"}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  period: e.target.value as "3months" | "6months" | "year",
                })
              }
            >
              <option value="3months">Laatste 3 maanden</option>
              <option value="6months">Laatste 6 maanden</option>
              <option value="year">Hele jaar</option>
            </select>
          </div>

          {/* Student search */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Zoek leerling</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Naam leerling..."
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
                value={filters.studentName || ""}
                onChange={(e) =>
                  setFilters({ ...filters, studentName: e.target.value || undefined })
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8" aria-label="Peerevaluaties tabs">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2
                  ${
                    activeSubTab === tab.id
                      ? "border-black text-black"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
                aria-current={activeSubTab === tab.id ? "page" : undefined}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeSubTab === "dashboard" && <DashboardTab filters={filters} />}
        {activeSubTab === "feedback" && <FeedbackTab parentFilters={filters} />}
      </div>
    </div>
  );
}
