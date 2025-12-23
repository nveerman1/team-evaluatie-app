"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  TrendingUp,
  BarChart3,
  FolderOpen,
  Award,
  ExternalLink,
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
import { overviewService } from "@/services/overview.service";
import type { CategoryTrendData } from "@/dtos/overview.dto";

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
   TYPES
   ========================================= */

interface ProjectOverviewItem {
  projectId: number;
  projectName: string;
  courseName: string;
  clientName: string;
  periodLabel: string;
  year: number;
  numTeams: number;
  averageScoreOverall: number | null;
  averageScoresByCategory: Record<string, number>;
  status: "active" | "completed";
}

interface ProjectOverviewFilters {
  schoolYear: string;
  courseId: string;
  period: string;
  searchQuery: string;
  statusFilter: string;
}

type SortField = "projectName" | "periodLabel" | "averageScoreOverall";
type SortOrder = "asc" | "desc";

/* =========================================
   MOCK DATA - for constants only
   ========================================= */

const COURSES = [
];

const PERIODS = ["Alle periodes", "P1", "P2", "P3", "P4"];

const CATEGORY_COLORS: Record<string, string> = {
  projectproces: "#3b82f6", // blue
  eindresultaat: "#10b981", // green
  communicatie: "#f59e0b", // amber
};

const CATEGORY_LABELS: Record<string, string> = {
  projectproces: "Projectproces",
  eindresultaat: "Eindresultaat",
  communicatie: "Communicatie",
};

// Table configuration
const TABLE_COLUMNS_COUNT = 11; // Total number of columns in the project table

/* =========================================
   HOOK: useProjectOverviewData
   ========================================= */

function useProjectOverviewData(filters: ProjectOverviewFilters) {
  const [projects, setProjects] = useState<ProjectOverviewItem[]>([]);
  const [trendData, setTrendData] = useState<CategoryTrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch projects from API
      const projectsResponse = await overviewService.getProjectOverview({
        schoolYear: filters.schoolYear,
        courseId: filters.courseId,
        period: filters.period,
        statusFilter: filters.statusFilter,
        searchQuery: filters.searchQuery,
      });

      // Fetch trends from API
      const trendsResponse = await overviewService.getProjectTrends({
        schoolYear: filters.schoolYear,
        courseId: filters.courseId,
      });

      // Map API response to component format
      const mappedProjects: ProjectOverviewItem[] = projectsResponse.projects.map((p) => ({
        projectId: p.project_id,
        projectName: p.project_name,
        courseName: p.course_name || "",
        clientName: p.client_name || "",
        periodLabel: p.period_label,
        year: p.year,
        numTeams: p.num_teams,
        averageScoreOverall: p.average_score_overall,
        averageScoresByCategory: p.average_scores_by_category,
        status: p.status,
      }));

      setProjects(mappedProjects);
      setTrendData(trendsResponse.trend_data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fout bij het laden van projectgegevens");
    } finally {
      setLoading(false);
    }
  }, [filters.courseId, filters.period, filters.schoolYear, filters.statusFilter, filters.searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { projects, trendData, loading, error, refresh: fetchData };
}

/* =========================================
   SKELETON COMPONENTS
   ========================================= */

function KpiSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-24 bg-gray-200 rounded-xl"></div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-12 bg-gray-200 rounded"></div>
      <div className="h-12 bg-gray-200 rounded"></div>
      <div className="h-12 bg-gray-200 rounded"></div>
      <div className="h-12 bg-gray-200 rounded"></div>
      <div className="h-12 bg-gray-200 rounded"></div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-64 bg-gray-200 rounded-lg"></div>
    </div>
  );
}

function TextSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-full"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
    </div>
  );
}

/* =========================================
   KPI CARDS COMPONENT
   ========================================= */

interface KpiCardsProps {
  projects: ProjectOverviewItem[];
  loading: boolean;
}

function KpiCards({ projects, loading }: KpiCardsProps) {
  const kpis = useMemo(() => {
    const completedProjects = projects.filter((p) => p.status === "completed");
    const projectsWithScores = completedProjects.filter((p) => p.averageScoreOverall !== null);

    // Calculate overall average
    const avgOverall =
      projectsWithScores.length > 0
        ? projectsWithScores.reduce((sum, p) => sum + (p.averageScoreOverall || 0), 0) /
          projectsWithScores.length
        : null;

    // Count completed assessments
    const completedCount = completedProjects.length;

    // Find most assessed category
    const categoryCounts: Record<string, number> = {};
    projectsWithScores.forEach((p) => {
      Object.keys(p.averageScoresByCategory).forEach((cat) => {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
    });
    const mostAssessedCategory = Object.entries(categoryCounts).sort(
      ([, a], [, b]) => b - a
    )[0]?.[0];

    return {
      avgOverall,
      completedCount,
      mostAssessedCategory: mostAssessedCategory
        ? CATEGORY_LABELS[mostAssessedCategory] || mostAssessedCategory
        : "—",
    };
  }, [projects]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Average Score Card */}
      <div className="bg-slate-50 rounded-xl p-4 border border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <span className="text-sm text-gray-600">Gem. projectscores</span>
        </div>
        <div className="text-2xl font-bold text-gray-900">
          {kpis.avgOverall !== null ? kpis.avgOverall.toFixed(1) : "—"}
          <span className="text-lg font-normal text-gray-500"> / 10</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">Gemiddelde over alle projecten</p>
      </div>

      {/* Completed Assessments Card */}
      <div className="bg-slate-50 rounded-xl p-4 border border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <Award className="w-5 h-5 text-green-600" />
          <span className="text-sm text-gray-600">Afgeronde beoordelingen</span>
        </div>
        <div className="text-2xl font-bold text-gray-900">{kpis.completedCount}</div>
        <p className="text-xs text-gray-500 mt-1">Projectbeoordelingen afgerond</p>
      </div>

      {/* Most Assessed Category Card */}
      <div className="bg-slate-50 rounded-xl p-4 border border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <FolderOpen className="w-5 h-5 text-purple-600" />
          <span className="text-sm text-gray-600">Meest beoordeeld</span>
        </div>
        <div className="text-lg font-bold text-gray-900 truncate">
          {kpis.mostAssessedCategory}
        </div>
        <p className="text-xs text-gray-500 mt-1">Meest beoordeelde categorie</p>
      </div>
    </div>
  );
}

/* =========================================
   PROJECT DETAIL DRAWER
   ========================================= */

interface ProjectDetailDrawerProps {
  project: ProjectOverviewItem | null;
  onClose: () => void;
}

function ProjectDetailDrawer({ project, onClose }: ProjectDetailDrawerProps) {
  if (!project) return null;

  const getScoreColor = (score: number) => {
    if (score >= 8) return "bg-green-100 text-green-800";
    if (score >= 6.5) return "bg-yellow-100 text-yellow-800";
    if (score >= 5.5) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-gray-900">{project.projectName}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Sluiten"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Project Meta Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Projectinformatie
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Vak:</span>
                <span className="ml-2 text-gray-900">{project.courseName}</span>
              </div>
              <div>
                <span className="text-gray-500">Opdrachtgever:</span>
                <span className="ml-2 text-gray-900">{project.clientName}</span>
              </div>
              <div>
                <span className="text-gray-500">Periode:</span>
                <span className="ml-2 text-gray-900">{project.periodLabel}</span>
              </div>
              <div>
                <span className="text-gray-500">Teams:</span>
                <span className="ml-2 text-gray-900">{project.numTeams}</span>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>
                <span
                  className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                    project.status === "active"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  {project.status === "active" ? "Actief" : "Afgerond"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Gem. score:</span>
                <span className="ml-2 text-gray-900 font-semibold">
                  {project.averageScoreOverall?.toFixed(1) || "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Category Scores */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Scores per categorie
            </h3>
            {Object.keys(project.averageScoresByCategory).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(project.averageScoresByCategory).map(([cat, score]) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <span className="text-sm text-gray-700">
                      {CATEGORY_LABELS[cat] || cat}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(
                        score
                      )}`}
                    >
                      {score.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">
                Nog geen beoordelingen beschikbaar
              </p>
            )}
          </div>

          {/* Action Button */}
          <div className="pt-4 border-t border-gray-200">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors">
              <ExternalLink className="w-4 h-4" />
              Open project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================
   PROJECT TABLE COMPONENT
   ========================================= */

interface ProjectTableProps {
  projects: ProjectOverviewItem[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onSelectProject: (project: ProjectOverviewItem) => void;
}

function ProjectTable({
  projects,
  loading,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onSelectProject,
}: ProjectTableProps) {
  const [sortField, setSortField] = useState<SortField>("projectName");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;

      switch (sortField) {
        case "projectName":
          aVal = a.projectName.toLowerCase();
          bVal = b.projectName.toLowerCase();
          break;
        case "periodLabel":
          aVal = a.periodLabel;
          bVal = b.periodLabel;
          break;
        case "averageScoreOverall":
          aVal = a.averageScoreOverall;
          bVal = b.averageScoreOverall;
          break;
        default:
          return 0;
      }

      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [projects, sortField, sortOrder]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? (
      <ChevronUp className="w-4 h-4 inline-block ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline-block ml-1" />
    );
  };

  const getStatusBadge = (status: "active" | "completed") => {
    return status === "active" ? (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        Actief
      </span>
    ) : (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Afgerond
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Table Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Zoek op project of opdrachtgever..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            className="px-3 py-2 border rounded-lg text-sm"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="all">Alle statussen</option>
            <option value="active">Actief</option>
            <option value="completed">Afgerond</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="overflow-x-auto border rounded-xl">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("projectName")}
                >
                  Project <SortIcon field="projectName" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Vak
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Opdrachtgever
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("periodLabel")}
                >
                  Periode <SortIcon field="periodLabel" />
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Teams
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider">
                  Projectproces
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-green-700 uppercase tracking-wider">
                  Eindresultaat
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-amber-700 uppercase tracking-wider">
                  Communicatie
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("averageScoreOverall")}
                >
                  Gem. score <SortIcon field="averageScoreOverall" />
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Acties
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {sortedProjects.map((project) => (
                <tr
                  key={project.projectId}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => onSelectProject(project)}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {project.projectName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{project.courseName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{project.clientName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{project.periodLabel}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-center">
                    {project.numTeams}
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    <span className="font-medium text-blue-700">
                      {project.averageScoresByCategory.projectproces?.toFixed(1) || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    <span className="font-medium text-green-700">
                      {project.averageScoresByCategory.eindresultaat?.toFixed(1) || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    <span className="font-medium text-amber-700">
                      {project.averageScoresByCategory.communicatie?.toFixed(1) || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    <span className="font-semibold text-gray-900">
                      {project.averageScoreOverall?.toFixed(1) || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">{getStatusBadge(project.status)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProject(project);
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
              {sortedProjects.length === 0 && (
                <tr>
                  <td colSpan={TABLE_COLUMNS_COUNT} className="px-4 py-8 text-center text-gray-500">
                    Geen projecten gevonden
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* =========================================
   CATEGORY TREND CHART COMPONENT
   ========================================= */

interface CategoryTrendChartProps {
  trendData: CategoryTrendData[];
  loading: boolean;
}

function CategoryTrendChart({ trendData, loading }: CategoryTrendChartProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const chartData = useMemo(() => {
    const labels = trendData.map((d) => d.projectLabel);
    const categories = Object.keys(CATEGORY_COLORS);

    const datasets = categories
      .filter((cat) => selectedCategory === "all" || selectedCategory === cat)
      .map((cat) => ({
        label: CATEGORY_LABELS[cat] || cat,
        data: trendData.map((d) => d.scores[cat] || null),
        borderColor: CATEGORY_COLORS[cat],
        backgroundColor: CATEGORY_COLORS[cat] + "40",
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
      }));

    return { labels, datasets };
  }, [trendData, selectedCategory]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
      },
      tooltip: {
        callbacks: {
          label: (context: { dataset: { label?: string }; parsed: { y: number | null } }) => {
            const label = context.dataset.label || "";
            const value = context.parsed.y;
            return `${label}: ${value !== null ? value.toFixed(1) : "—"}`;
          },
        },
      },
    },
    scales: {
      y: {
        min: 0,
        max: 10,
        ticks: {
          stepSize: 1,
        },
        title: {
          display: true,
          text: "Score",
        },
      },
      x: {
        title: {
          display: true,
          text: "Project / Periode",
        },
      },
    },
  };

  // Compute insights
  const insights = useMemo(() => {
    if (trendData.length === 0) return [];

    const categoryAverages: Record<string, number[]> = {};
    trendData.forEach((d) => {
      Object.entries(d.scores).forEach(([cat, score]) => {
        if (!categoryAverages[cat]) categoryAverages[cat] = [];
        categoryAverages[cat].push(score);
      });
    });

    const avgByCategory: Record<string, number> = {};
    Object.entries(categoryAverages).forEach(([cat, scores]) => {
      avgByCategory[cat] = scores.reduce((a, b) => a + b, 0) / scores.length;
    });

    const sortedCategories = Object.entries(avgByCategory).sort(([, a], [, b]) => b - a);
    const highest = sortedCategories[0];
    const lowest = sortedCategories[sortedCategories.length - 1];

    const insightsList = [];
    if (highest) {
      insightsList.push(
        `Hoogste gemiddelde categorie: ${CATEGORY_LABELS[highest[0]] || highest[0]} (${highest[1].toFixed(1)})`
      );
    }
    if (lowest && lowest[0] !== highest?.[0]) {
      insightsList.push(
        `Laagste gemiddelde categorie: ${CATEGORY_LABELS[lowest[0]] || lowest[0]} (${lowest[1].toFixed(1)})`
      );
    }

    return insightsList;
  }, [trendData]);

  return (
    <div className="space-y-4">
      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selectedCategory === "all"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Alle categorieën
        </button>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === key
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      {loading ? (
        <ChartSkeleton />
      ) : (
        <div className="h-72">
          <Line data={chartData} options={chartOptions} />
        </div>
      )}

      {/* Insights */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-600" />
          Inzichten
        </h4>
        {insights.length > 0 ? (
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            {insights.map((insight, idx) => (
              <li key={idx}>{insight}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 italic">
            Nog geen inzichten beschikbaar. Data wordt weergegeven zodra er beoordelingen zijn.
          </p>
        )}
      </div>
    </div>
  );
}

/* =========================================
   MAIN COMPONENT: PROJECT OVERVIEW TAB
   ========================================= */

export default function ProjectOverviewTab() {
  const [filters, setFilters] = useState<ProjectOverviewFilters>({
    schoolYear: "",
    courseId: "",
    period: PERIODS[0],
    searchQuery: "",
    statusFilter: "all",
  });

  const [selectedProject, setSelectedProject] = useState<ProjectOverviewItem | null>(null);
  const [academicYears, setAcademicYears] = useState<Array<{label: string; id: number}>>([]);
  const [courses, setCourses] = useState<Array<{id: number; name: string}>>([]);

  const { projects, trendData, loading, error } = useProjectOverviewData(filters);

  // Fetch academic years and courses on mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [years, coursesData] = await Promise.all([
          overviewService.getAcademicYears(),
          overviewService.getCourses(),
        ]);
        setAcademicYears(years);
        setCourses(coursesData);
        
        // Set default school year to the first one if available
        if (years.length > 0) {
          setFilters(prev => {
            if (!prev.schoolYear) {
              return { ...prev, schoolYear: years[0].label };
            }
            return prev;
          });
        }
      } catch (e) {
        console.error("Failed to fetch options:", e);
      }
    };
    fetchOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const handleFilterChange = <K extends keyof ProjectOverviewFilters>(
    key: K,
    value: ProjectOverviewFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-medium">Fout bij het laden van gegevens</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Projectbeoordelingen — Overzicht
          </h2>
          <p className="text-gray-600 mt-1">
            Inzicht in projecten, rubriccategorieën en trends
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* School Year */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Schooljaar</label>
            <select
              className="px-3 py-2 border rounded-lg text-sm"
              value={filters.schoolYear}
              onChange={(e) => handleFilterChange("schoolYear", e.target.value)}
            >
              {academicYears.map((year) => (
                <option key={year.id} value={year.label}>
                  {year.label}
                </option>
              ))}
            </select>
          </div>

          {/* Course */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Vak</label>
            <select
              className="px-3 py-2 border rounded-lg text-sm"
              value={filters.courseId}
              onChange={(e) => handleFilterChange("courseId", e.target.value)}
            >
              <option value="">Alle vakken</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>

          {/* Period */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Periode</label>
            <select
              className="px-3 py-2 border rounded-lg text-sm"
              value={filters.period}
              onChange={(e) => handleFilterChange("period", e.target.value)}
            >
              {PERIODS.map((period) => (
                <option key={period} value={period}>
                  {period}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <KpiCards projects={projects} loading={loading} />

      {/* Project Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-blue-600" />
          Projecten
        </h3>
        <ProjectTable
          projects={projects}
          loading={loading}
          searchQuery={filters.searchQuery}
          onSearchChange={(query) => handleFilterChange("searchQuery", query)}
          statusFilter={filters.statusFilter}
          onStatusFilterChange={(status) => handleFilterChange("statusFilter", status)}
          onSelectProject={setSelectedProject}
        />
      </div>

      {/* Category Trend Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Trends per rubriccategorie
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Gemiddelde scores per categorie over meerdere projecten
        </p>
        <CategoryTrendChart trendData={trendData} loading={loading} />
      </div>

      {/* Project Detail Drawer */}
      {selectedProject && (
        <ProjectDetailDrawer
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  );
}
