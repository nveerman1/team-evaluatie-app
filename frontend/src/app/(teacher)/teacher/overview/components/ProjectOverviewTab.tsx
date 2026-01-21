"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  TrendingUp,
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
import type { CategoryTrendData, ProjectTeamScore } from "@/dtos/overview.dto";
import OverviewFilters, { OverviewFilterValues } from "./OverviewFilters";
import EmptyState from "./EmptyState";

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

// Table configuration - removed Status and Acties columns
const TABLE_COLUMNS_COUNT = 9; // Total number of columns in the project table

// Helper function for score color coding
function getScoreColor(score: number | null | undefined): string {
  if (!score) return "bg-slate-100 text-slate-400";
  if (score >= 8.0) return "bg-emerald-100 text-emerald-700";
  if (score >= 7.0) return "bg-green-100 text-green-700";
  if (score >= 6.0) return "bg-amber-100 text-amber-700";
  if (score >= 5.5) return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700";
}

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
        averageScoreOverall: p.average_score_overall ?? null,
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
  }, [filters.courseId, filters.period, filters.schoolYear]);

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
}

function ProjectTable({
  projects,
  loading,
}: ProjectTableProps) {
  const [sortField, setSortField] = useState<SortField>("projectName");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [teamScores, setTeamScores] = useState<Record<number, ProjectTeamScore[]>>({});
  const [loadingTeams, setLoadingTeams] = useState<Set<number>>(new Set());

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const toggleRow = async (projectId: number) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(projectId)) {
      newExpandedRows.delete(projectId);
    } else {
      newExpandedRows.add(projectId);
      // Load team scores if not already loaded
      if (!teamScores[projectId] && !loadingTeams.has(projectId)) {
        setLoadingTeams(prev => {
          const newSet = new Set(prev);
          newSet.add(projectId);
          return newSet;
        });
        try {
          const data = await overviewService.getProjectTeams(projectId);
          setTeamScores(prev => ({ ...prev, [projectId]: data.teams }));
        } catch (error) {
          console.error("Failed to load team scores:", error);
        } finally {
          setLoadingTeams(prev => {
            const newSet = new Set(prev);
            newSet.delete(projectId);
            return newSet;
          });
        }
      }
    }
    setExpandedRows(newExpandedRows);
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

  return (
    <div className="space-y-4">
      {/* Table */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th
                  className="sticky left-0 z-20 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide min-w-[200px] cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort("projectName")}
                >
                  Project <SortIcon field="projectName" />
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">
                  Vak
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">
                  Opdrachtgever
                </th>
                <th
                  className="px-3 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort("periodLabel")}
                >
                  Periode <SortIcon field="periodLabel" />
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">
                  Teams
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide min-w-[90px]">
                  Projectproces
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide min-w-[90px]">
                  Eindresultaat
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide min-w-[90px]">
                  Communicatie
                </th>
                <th
                  className="px-3 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide cursor-pointer hover:bg-slate-100 min-w-[90px]"
                  onClick={() => handleSort("averageScoreOverall")}
                >
                  Gem. score <SortIcon field="averageScoreOverall" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedProjects.map((project) => {
                const isExpanded = expandedRows.has(project.projectId);
                const projectTeams = teamScores[project.projectId] || [];
                const isLoadingTeams = loadingTeams.has(project.projectId);
                // Create unique key combining projectId, year, and period to handle duplicate project IDs
                const uniqueKey = `${project.projectId}-${project.year}-${project.periodLabel}`;

                return (
                  <React.Fragment key={uniqueKey}>
                    <tr
                      className="bg-white hover:bg-slate-50 cursor-pointer"
                      onClick={() => toggleRow(project.projectId)}
                    >
                      <td className="sticky left-0 z-10 bg-white px-4 py-2 text-sm text-slate-900 font-medium border-r border-slate-100">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                          <span>{project.projectName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-slate-600">
                        {project.courseName || "—"}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-slate-600">
                        {project.clientName || "—"}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-slate-600">
                        {project.periodLabel}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-slate-600">
                        {project.numTeams}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-md text-sm font-semibold tabular-nums ${getScoreColor(project.averageScoresByCategory.projectproces)}`}>
                          {project.averageScoresByCategory.projectproces?.toFixed(1) || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-md text-sm font-semibold tabular-nums ${getScoreColor(project.averageScoresByCategory.eindresultaat)}`}>
                          {project.averageScoresByCategory.eindresultaat?.toFixed(1) || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-md text-sm font-semibold tabular-nums ${getScoreColor(project.averageScoresByCategory.communicatie)}`}>
                          {project.averageScoresByCategory.communicatie?.toFixed(1) || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-md text-sm font-semibold tabular-nums ${getScoreColor(project.averageScoreOverall)}`}>
                          {project.averageScoreOverall?.toFixed(1) || "—"}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={TABLE_COLUMNS_COUNT} className="bg-slate-50 px-0 py-0">
                          <div className="px-6 py-4">
                            {isLoadingTeams ? (
                              <div className="flex items-center justify-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-900"></div>
                                <span className="ml-2 text-sm text-slate-600">Teamscores laden...</span>
                              </div>
                            ) : projectTeams.length > 0 ? (
                              <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-slate-700 mb-3">Teamscores</h4>
                                <table className="min-w-full divide-y divide-slate-200 text-sm bg-white rounded-lg overflow-hidden">
                                  <thead className="bg-slate-100">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Team</th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Teamleden</th>
                                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Projectproces</th>
                                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Eindresultaat</th>
                                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Communicatie</th>
                                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Gem. score</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {projectTeams
                                      .sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0))
                                      .map((team) => (
                                        <tr key={team.team_number} className="hover:bg-slate-50">
                                          <td className="px-3 py-2 text-sm font-medium text-slate-900">
                                            {team.team_name || `Team ${team.team_number}`}
                                          </td>
                                          <td className="px-3 py-2 text-sm text-slate-600">
                                            <div className="max-w-xs truncate" title={team.team_members.join(", ")}>
                                              {team.team_members.length > 0 ? team.team_members.join(", ") : "—"}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded text-xs font-semibold tabular-nums ${getScoreColor(team.category_scores.projectproces)}`}>
                                              {team.category_scores.projectproces?.toFixed(1) || "—"}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded text-xs font-semibold tabular-nums ${getScoreColor(team.category_scores.eindresultaat)}`}>
                                              {team.category_scores.eindresultaat?.toFixed(1) || "—"}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded text-xs font-semibold tabular-nums ${getScoreColor(team.category_scores.communicatie)}`}>
                                              {team.category_scores.communicatie?.toFixed(1) || "—"}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded text-xs font-semibold tabular-nums ${getScoreColor(team.overall_score)}`}>
                                              {team.overall_score?.toFixed(1) || "—"}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500 text-center py-4">Geen teamscores beschikbaar</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {sortedProjects.length === 0 && (
                <tr>
                  <td colSpan={TABLE_COLUMNS_COUNT} className="px-4 py-8 text-center text-slate-500">
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
    const labels = trendData.map((d) => d.project_label);
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
          label: (context: {
            dataIndex: number;
            dataset: { label?: string };
            parsed: { y: number | null };
          }) => {
            const dataIndex = context.dataIndex;
            const datasetLabel = context.dataset.label || "";
            const value = context.parsed.y;
            
            // Get the trend data point for this data index
            const trendPoint = trendData[dataIndex];
            if (!trendPoint) {
              return `${datasetLabel}: ${value !== null ? value.toFixed(1) : "—"}`;
            }

            // Find category key that matches this dataset
            const categoryKey = Object.keys(CATEGORY_LABELS).find(
              key => CATEGORY_LABELS[key] === datasetLabel
            );
            
            if (!categoryKey || !trendPoint.statistics[categoryKey]) {
              return `${datasetLabel}: ${value !== null ? value.toFixed(1) : "—"}`;
            }

            const stats = trendPoint.statistics[categoryKey];
            
            // Build tooltip with statistics
            const lines = [
              `${datasetLabel}: ${value !== null ? value.toFixed(1) : "—"}`,
              `Mediaan: ${stats.median?.toFixed(1) || "—"}`,
              `Spreiding (P25-P75): ${stats.p25?.toFixed(1) || "—"} - ${stats.p75?.toFixed(1) || "—"}`,
              `Min-Max: ${stats.min?.toFixed(1) || "—"} - ${stats.max?.toFixed(1) || "—"}`,
              `Teams: ${stats.count_teams || 0}`,
            ];
            
            return lines;
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

    const insightsList = [];

    // Calculate category averages
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

    // Find project with largest spreiding (highest IQR)
    let maxSpreadProject = null;
    let maxSpreadValue = 0;
    let minSpreadProject = null;
    let minSpreadValue = Infinity;

    trendData.forEach((d) => {
      // Calculate average IQR across categories for this project
      const iqrs = Object.values(d.statistics).map(s => s.iqr).filter(iqr => iqr !== null && iqr !== undefined) as number[];
      if (iqrs.length > 0) {
        const avgIqr = iqrs.reduce((a, b) => a + b, 0) / iqrs.length;
        if (avgIqr > maxSpreadValue) {
          maxSpreadValue = avgIqr;
          maxSpreadProject = d.project_label;
        }
        if (avgIqr < minSpreadValue) {
          minSpreadValue = avgIqr;
          minSpreadProject = d.project_label;
        }
      }
    });

    if (maxSpreadProject) {
      insightsList.push(
        `Grootste spreiding: ${maxSpreadProject} (IQR ${maxSpreadValue.toFixed(1)})`
      );
    }
    if (minSpreadProject && minSpreadProject !== maxSpreadProject) {
      insightsList.push(
        `Meest consistente project: ${minSpreadProject} (IQR ${minSpreadValue.toFixed(1)})`
      );
    }

    // Find category with most variation across all projects
    const categoryIqrs: Record<string, number[]> = {};
    trendData.forEach((d) => {
      Object.entries(d.statistics).forEach(([cat, stats]) => {
        if (stats.iqr !== null && stats.iqr !== undefined) {
          if (!categoryIqrs[cat]) categoryIqrs[cat] = [];
          categoryIqrs[cat].push(stats.iqr);
        }
      });
    });

    const avgIqrByCategory: Record<string, number> = {};
    Object.entries(categoryIqrs).forEach(([cat, iqrs]) => {
      avgIqrByCategory[cat] = iqrs.reduce((a, b) => a + b, 0) / iqrs.length;
    });

    const sortedByVariation = Object.entries(avgIqrByCategory).sort(([, a], [, b]) => b - a);
    if (sortedByVariation.length > 0) {
      const [mostVariedCat, avgIqr] = sortedByVariation[0];
      insightsList.push(
        `Categorie met meeste variatie: ${CATEGORY_LABELS[mostVariedCat] || mostVariedCat} (gem. IQR ${avgIqr.toFixed(1)})`
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
        <>
          <div className="h-72">
            <Line data={chartData} options={chartOptions} />
          </div>
          
          {/* Stat Chips - Show statistics for selected category */}
          {selectedCategory !== "all" && trendData.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {(() => {
                // Calculate overall stats for selected category across all projects
                const categoryStats = trendData
                  .map(d => d.statistics[selectedCategory])
                  .filter(s => s && s.mean !== null && s.mean !== undefined);
                
                if (categoryStats.length === 0) return null;
                
                const avgMean = categoryStats.reduce((sum, s) => sum + (s.mean || 0), 0) / categoryStats.length;
                const avgMedian = categoryStats.reduce((sum, s) => sum + (s.median || 0), 0) / categoryStats.length;
                const avgIqr = categoryStats.reduce((sum, s) => sum + (s.iqr || 0), 0) / categoryStats.length;
                
                // Find overall min and max
                const allMins = categoryStats.map(s => s.min).filter(v => v !== null) as number[];
                const allMaxs = categoryStats.map(s => s.max).filter(v => v !== null) as number[];
                const overallMin = allMins.length > 0 ? Math.min(...allMins) : null;
                const overallMax = allMaxs.length > 0 ? Math.max(...allMaxs) : null;
                
                return (
                  <>
                    <div className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                      Gem: {avgMean.toFixed(1)}
                    </div>
                    <div className="px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                      Mediaan: {avgMedian.toFixed(1)}
                    </div>
                    <div className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full text-xs font-medium">
                      Spreiding (IQR): {avgIqr.toFixed(1)}
                    </div>
                    {overallMin !== null && overallMax !== null && (
                      <div className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                        Min–Max: {overallMin.toFixed(1)}–{overallMax.toFixed(1)}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </>
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  // Initialize filter values from URL
  const [filterValues, setFilterValues] = useState<OverviewFilterValues>({
    academicYear: searchParams.get("year") || undefined,
    courseId: searchParams.get("subjectId") || undefined,
    period: searchParams.get("period") || PERIODS[0],
    searchQuery: searchParams.get("q") || undefined,
  });
  
  const [filters, setFilters] = useState<ProjectOverviewFilters>({
    schoolYear: filterValues.academicYear || "",
    courseId: filterValues.courseId || "",
    period: filterValues.period || PERIODS[0],
  });

  const [academicYears, setAcademicYears] = useState<Array<{label: string; id: number}>>([]);
  const [courses, setCourses] = useState<Array<{id: number; name: string}>>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const { projects, trendData, loading, error } = useProjectOverviewData(filters);
  
  // Sync URL with filter values
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (filterValues.academicYear) {
      params.set("year", filterValues.academicYear);
    } else {
      params.delete("year");
    }
    
    if (filterValues.courseId) {
      params.set("subjectId", filterValues.courseId);
    } else {
      params.delete("subjectId");
    }
    
    if (filterValues.period && filterValues.period !== PERIODS[0]) {
      params.set("period", filterValues.period);
    } else {
      params.delete("period");
    }
    
    if (filterValues.searchQuery) {
      params.set("q", filterValues.searchQuery);
    } else {
      params.delete("q");
    }
    
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [filterValues, pathname, router, searchParams]);
  
  // Update internal filters when filterValues change
  useEffect(() => {
    setFilters({
      schoolYear: filterValues.academicYear || "",
      courseId: filterValues.courseId || "",
      period: filterValues.period || PERIODS[0],
    });
  }, [filterValues]);

  // Fetch academic years and courses on mount
  useEffect(() => {
    const fetchOptions = async () => {
      setLoadingOptions(true);
      try {
        const [years, coursesData] = await Promise.all([
          overviewService.getAcademicYears(),
          overviewService.getCourses(),
        ]);
        setAcademicYears(years);
        setCourses(coursesData);
        
        // Only set default if no year is selected AND years are available
        // This respects the URL as single source of truth
        if (years.length > 0 && !filterValues.academicYear && !searchParams.get("year")) {
          setFilterValues(prev => ({
            ...prev,
            academicYear: years[0].label,
          }));
        }
      } catch (e) {
        console.error("Failed to fetch options:", e);
      } finally {
        setLoadingOptions(false);
      }
    };
    fetchOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const handleFilterChange = (newFilters: OverviewFilterValues) => {
    setFilterValues(newFilters);
  };
  
  // Map periods to the format expected by OverviewFilters
  const periodOptions = PERIODS.map(p => ({ value: p, label: p }));

  // Show empty state if no course selected
  if (!filterValues.courseId) {
    return (
      <div className="space-y-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Projecten</h2>
          <p className="text-sm text-gray-600 mt-1">
            Overzicht van projectbeoordelingen en trends
          </p>
        </div>
        <OverviewFilters
          filters={filterValues}
          onFiltersChange={handleFilterChange}
          academicYears={academicYears}
          courses={courses}
          periods={periodOptions}
          loading={loadingOptions}
          showAcademicYear={true}
          showPeriod={true}
          showClass={false}
          showSearch={true}
        />
        <EmptyState />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Projecten</h2>
          <p className="text-sm text-gray-600 mt-1">
            Overzicht van projectbeoordelingen en trends
          </p>
        </div>
        <OverviewFilters
          filters={filterValues}
          onFiltersChange={handleFilterChange}
          academicYears={academicYears}
          courses={courses}
          periods={periodOptions}
          loading={loadingOptions}
          showAcademicYear={true}
          showPeriod={true}
          showClass={false}
          showSearch={true}
        />
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Fout bij het laden van gegevens</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title Section */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Projecten</h2>
        <p className="text-sm text-gray-600 mt-1">
          Overzicht van projectbeoordelingen en trends
        </p>
      </div>
      
      {/* Global Filter Bar */}
      <OverviewFilters
        filters={filterValues}
        onFiltersChange={handleFilterChange}
        academicYears={academicYears}
        courses={courses}
        periods={periodOptions}
        loading={loadingOptions}
        showAcademicYear={true}
        showPeriod={true}
        showClass={false}
        showSearch={true}
      />

      {/* Project Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-base font-semibold text-slate-900 leading-6">Projecten</h3>
          <p className="text-sm text-slate-600">
            Klik op een project om teamscores te bekijken
          </p>
        </div>
        <ProjectTable
          projects={projects}
          loading={loading}
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
    </div>
  );
}
