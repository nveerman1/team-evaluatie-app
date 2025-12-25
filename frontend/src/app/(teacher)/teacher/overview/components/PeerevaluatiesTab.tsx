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

  const getTrendBg = (trend: "up" | "down" | "neutral") => {
    if (trend === "up") return "bg-green-100";
    if (trend === "down") return "bg-red-100";
    return "bg-gray-100";
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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          Leerling Heatmap
        </h3>
        <Suspense fallback={<TableSkeleton />}>
          {loading ? (
            <TableSkeleton />
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase sticky left-0 bg-gray-50 z-10">
                      Leerling
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                      Klas
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-blue-700 uppercase">
                      O
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-green-700 uppercase">
                      M
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-amber-700 uppercase">
                      Z
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-violet-700 uppercase">
                      A
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                      Self vs Peer
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data?.heatmapData.map((student) => (
                    <tr key={student.student_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">
                        {student.student_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-center">
                        {student.class_name}
                      </td>
                      <td className="px-2 py-2">
                        <div
                          className={`flex items-center justify-center gap-1 px-2 py-2 rounded ${getTrendBg(
                            student.scores.organiseren.trend
                          )}`}
                        >
                          <span className="font-medium">
                            {student.scores.organiseren.current.toFixed(1)}
                          </span>
                          {getTrendIcon(student.scores.organiseren.trend)}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div
                          className={`flex items-center justify-center gap-1 px-2 py-2 rounded ${getTrendBg(
                            student.scores.meedoen.trend
                          )}`}
                        >
                          <span className="font-medium">
                            {student.scores.meedoen.current.toFixed(1)}
                          </span>
                          {getTrendIcon(student.scores.meedoen.trend)}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div
                          className={`flex items-center justify-center gap-1 px-2 py-2 rounded ${getTrendBg(
                            student.scores.zelfvertrouwen.trend
                          )}`}
                        >
                          <span className="font-medium">
                            {student.scores.zelfvertrouwen.current.toFixed(1)}
                          </span>
                          {getTrendIcon(student.scores.zelfvertrouwen.trend)}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div
                          className={`flex items-center justify-center gap-1 px-2 py-2 rounded ${getTrendBg(
                            student.scores.autonomie.trend
                          )}`}
                        >
                          <span className="font-medium">
                            {student.scores.autonomie.current.toFixed(1)}
                          </span>
                          {getTrendIcon(student.scores.autonomie.trend)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-medium ${
                          (student.self_vs_peer_diff || 0) > 0.3
                            ? "text-red-600"
                            : (student.self_vs_peer_diff || 0) < -0.3
                            ? "text-amber-600"
                            : "text-gray-600"
                        }`}>
                          {student.self_vs_peer_diff !== undefined
                            ? ((student.self_vs_peer_diff || 0) > 0 ? "+" : "") + student.self_vs_peer_diff.toFixed(1)
                            : "—"}
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

function FeedbackTab() {
  const [filters, setFilters] = useState<FeedbackFilters>({});
  const { data, loading, error } = useFeedbackData(filters);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positief":
        return "bg-green-100 text-green-800";
      case "kritiek":
        return "bg-red-100 text-red-800";
      case "waarschuwing":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "organiseren":
        return "bg-blue-100 text-blue-800";
      case "meedoen":
        return "bg-green-100 text-green-800";
      case "zelfvertrouwen":
        return "bg-amber-100 text-amber-800";
      case "autonomie":
        return "bg-violet-100 text-violet-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Escape special regex characters to prevent ReDoS attacks
  const escapeRegex = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  // Escape HTML to prevent XSS
  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const highlightKeywords = (text: string, keywords: string[]) => {
    // First escape HTML in the original text
    let result = escapeHtml(text);
    keywords.forEach((keyword) => {
      // Escape special regex characters in keyword
      const escapedKeyword = escapeRegex(keyword);
      const regex = new RegExp(`(${escapedKeyword})`, "gi");
      result = result.replace(
        regex,
        '<mark class="bg-yellow-200 px-0.5 rounded">$1</mark>'
      );
    });
    return result;
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
      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT: Filters (40%) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-600" />
              Filters
            </h3>

            <div className="space-y-4">
              {/* Category filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  OMZA Categorie
                </label>
                <select
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  value={filters.category || ""}
                  onChange={(e) =>
                    setFilters({ ...filters, category: e.target.value || undefined })
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sentiment
                </label>
                <select
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  value={filters.sentiment || ""}
                  onChange={(e) =>
                    setFilters({ ...filters, sentiment: e.target.value || undefined })
                  }
                >
                  <option value="">Alle sentimenten</option>
                  <option value="positief">Positief</option>
                  <option value="kritiek">Kritiek</option>
                  <option value="waarschuwing">Waarschuwing</option>
                </select>
              </div>

              {/* Search text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zoeken in feedback
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Zoek op trefwoord..."
                    className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
                    value={filters.searchText || ""}
                    onChange={(e) =>
                      setFilters({ ...filters, searchText: e.target.value || undefined })
                    }
                  />
                </div>
              </div>

              {/* Risk behavior toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="riskOnly"
                  className="w-4 h-4 rounded border-gray-300"
                  checked={filters.riskOnly || false}
                  onChange={(e) =>
                    setFilters({ ...filters, riskOnly: e.target.checked || undefined })
                  }
                />
                <label htmlFor="riskOnly" className="text-sm text-gray-700">
                  Alleen risico-gedrag opmerkingen
                </label>
              </div>

              {/* Clear filters button */}
              <button
                onClick={() => setFilters({})}
                className="w-full px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"
              >
                Filters wissen
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: Feedback List (60%) */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              Feedback ({data?.totalCount || 0} resultaten)
            </h3>

            <Suspense fallback={<TableSkeleton />}>
              {loading ? (
                <TableSkeleton />
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {data?.feedbackItems.map((item) => (
                    <div
                      key={item.id}
                      className="border rounded-lg p-4 hover:bg-gray-50"
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(
                            item.category
                          )}`}
                        >
                          {item.category.charAt(0).toUpperCase() +
                            item.category.slice(1)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSentimentColor(
                            item.sentiment
                          )}`}
                        >
                          {item.sentiment}
                        </span>
                        {item.is_risk_behavior && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            ⚠️ Risico
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">{item.student_name}</span>
                        <span className="mx-2">•</span>
                        <span>{item.project_name}</span>
                        <span className="mx-2">•</span>
                        <span>
                          {new Date(item.date).toLocaleDateString("nl-NL")}
                        </span>
                      </div>
                      <p
                        className="text-sm text-gray-800"
                        dangerouslySetInnerHTML={{
                          __html: highlightKeywords(item.text, item.keywords),
                        }}
                      />
                    </div>
                  ))}
                  {data?.feedbackItems.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      Geen feedback gevonden voor de geselecteerde filters
                    </div>
                  )}
                </div>
              )}
            </Suspense>
          </div>
        </div>
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
        {activeSubTab === "feedback" && <FeedbackTab />}
      </div>
    </div>
  );
}
