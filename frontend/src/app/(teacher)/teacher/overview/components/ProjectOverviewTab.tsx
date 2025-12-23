"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  TrendingUp,
  FolderOpen,
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
import { projectOverviewService } from "@/services/project-overview.service";
import type {
  ProjectOverviewItem,
  CategoryTrendDataPoint,
} from "@/services/project-overview.service";
import { courseService } from "@/services/course.service";
import type { CourseLite } from "@/dtos/course.dto";

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
   CONSTANTS
   ========================================= */

const PERIODS = ["Alle periodes", "P1", "P2", "P3", "P4"];

const SCHOOL_YEARS = ["Alle schooljaren", "2024-2025", "2023-2024", "2022-2023"];

// Default color palette for categories - will be used for any categories
const CATEGORY_COLORS: Record<string, string> = {
  projectproces: "#3b82f6", // blue
  eindresultaat: "#10b981", // green
  communicatie: "#f59e0b", // amber
  samenwerking: "#8b5cf6", // purple
  kwaliteit: "#ec4899", // pink
  planning: "#14b8a6", // teal
  documentatie: "#f97316", // orange
  presentatie: "#6366f1", // indigo
};

// Fallback colors for unknown categories
const FALLBACK_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", 
  "#ec4899", "#14b8a6", "#f97316", "#6366f1"
];

/* =========================================
   HOOK: useProjectOverviewData
   ========================================= */

function useProjectOverviewData(filters: ProjectOverviewFilters) {
  const [projects, setProjects] = useState<ProjectOverviewItem[]>([]);
  const [trendData, setTrendData] = useState<CategoryTrendDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Call the real API endpoints
      const [projectsResponse, trendsResponse] = await Promise.all([
        projectOverviewService.getProjects({
          schoolYear: filters.schoolYear,
          courseId: filters.courseId,
          period: filters.period,
          statusFilter: filters.statusFilter,
          searchQuery: filters.searchQuery,
        }),
        projectOverviewService.getTrends({
          schoolYear: filters.schoolYear,
          courseId: filters.courseId,
          period: filters.period,
        }),
      ]);

      setProjects(projectsResponse.items);
      setTrendData(trendsResponse.trends);
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

          {/* AI Summary for this project */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-600" />
              AI-samenvatting
            </h3>
            {/* TODO: Fetch project-specific AI summary from backend */}
            <div className="bg-purple-50 rounded-lg p-4 text-sm text-gray-700">
              <p>
                Dit project laat goede resultaten zien op het gebied van samenwerking.
                Aandachtspunten zijn de planning en documentatie. Teams hebben effectief
                gecommuniceerd met de opdrachtgever.
              </p>
            </div>
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
          <table className="w-full min-w-[700px]">
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
                  key={project.assessmentId}
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
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
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
  trendData: CategoryTrendDataPoint[];
  loading: boolean;
}

function CategoryTrendChart({ trendData, loading }: CategoryTrendChartProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Get all unique categories from trend data
  const allCategories = useMemo(() => {
    const categoriesSet = new Set<string>();
    trendData.forEach((d) => {
      Object.keys(d.scores).forEach((cat) => categoriesSet.add(cat));
    });
    return Array.from(categoriesSet);
  }, [trendData]);

  // Assign colors to categories dynamically
  const getCategoryColor = (category: string, index: number) => {
    if (CATEGORY_COLORS[category]) {
      return CATEGORY_COLORS[category];
    }
    // Use fallback colors for unknown categories
    return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  };

  const chartData = useMemo(() => {
    const labels = trendData.map((d) => d.projectLabel);

    const datasets = allCategories
      .filter((cat) => selectedCategory === "all" || selectedCategory === cat)
      .map((cat, index) => {
        const color = getCategoryColor(cat, index);
        return {
          label: cat.charAt(0).toUpperCase() + cat.slice(1), // Capitalize first letter
          data: trendData.map((d) => d.scores[cat] || null),
          borderColor: color,
          backgroundColor: color + "40",
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
        };
      });

    return { labels, datasets };
  }, [trendData, selectedCategory, allCategories]);

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
      // Capitalize first letter of category name
      const categoryName = highest[0].charAt(0).toUpperCase() + highest[0].slice(1);
      insightsList.push(
        `Hoogste gemiddelde categorie: ${categoryName} (${highest[1].toFixed(1)})`
      );
    }
    if (lowest && lowest[0] !== highest?.[0]) {
      // Capitalize first letter of category name
      const categoryName = lowest[0].charAt(0).toUpperCase() + lowest[0].slice(1);
      insightsList.push(
        `Laagste gemiddelde categorie: ${categoryName} (${lowest[1].toFixed(1)})`
      );
    }
    // TODO: Add more sophisticated insights from backend/AI
    insightsList.push("Trend analyse: Scores tonen een lichte stijging over de afgelopen periodes");

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
        {allCategories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === category
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {category.charAt(0).toUpperCase() + category.slice(1)}
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
        {/* TODO: Backend/AI could generate smarter insights */}
        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
          {insights.map((insight, idx) => (
            <li key={idx}>{insight}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* =========================================
   MAIN COMPONENT: PROJECT OVERVIEW TAB
   ========================================= */

export default function ProjectOverviewTab() {
  const [filters, setFilters] = useState<ProjectOverviewFilters>({
    schoolYear: SCHOOL_YEARS[0],
    courseId: "",
    period: PERIODS[0],
    searchQuery: "",
    statusFilter: "all",
  });

  const [selectedProject, setSelectedProject] = useState<ProjectOverviewItem | null>(null);
  const [courses, setCourses] = useState<CourseLite[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);

  const { projects, trendData, loading, error } = useProjectOverviewData(filters);

  // Fetch courses on mount
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const coursesData = await courseService.listCourses({ is_active: true });
        setCourses(coursesData.items || []);
      } catch (e) {
        console.error("Failed to fetch courses:", e);
      } finally {
        setCoursesLoading(false);
      }
    };
    fetchCourses();
  }, []);

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
              {SCHOOL_YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
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
              disabled={coursesLoading}
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
