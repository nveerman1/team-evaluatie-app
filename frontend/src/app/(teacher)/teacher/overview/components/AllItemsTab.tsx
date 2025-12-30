"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { overviewService } from "@/services";
import { OverviewMatrixResponse, MatrixFilters, MatrixCell, MatrixColumn } from "@/dtos/overview.dto";
import { Loading } from "@/components";
import { formatDate } from "@/utils";
import OverviewFilters, { OverviewFilterValues } from "./OverviewFilters";
import EmptyState from "./EmptyState";

const FILTER_DEBOUNCE_MS = 300;

export default function AllItemsTab() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  const [matrixData, setMatrixData] = useState<OverviewMatrixResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [courses, setCourses] = useState<Array<{id: number; name: string}>>([]);
  
  // Extract unique classes from matrix data
  const availableClasses = useMemo(() => {
    if (!matrixData) return [];
    const classNames = Array.from(
      new Set(
        matrixData.rows
          .map(row => row.student_class)
          .filter((className): className is string => Boolean(className))
      )
    ).sort();
    return classNames.map(name => ({ id: name, name }));
  }, [matrixData]);
  
  // Initialize filters from URL
  const [filterValues, setFilterValues] = useState<OverviewFilterValues>({
    courseId: searchParams.get("subjectId") || undefined,
    period: searchParams.get("period") || undefined,
    classId: searchParams.get("classId") || undefined,
    searchQuery: searchParams.get("q") || undefined,
  });
  
  // Column visibility toggles
  const [showProject, setShowProject] = useState(true);
  const [showPeer, setShowPeer] = useState(true);
  const [showCompetency, setShowCompetency] = useState(true);

  // Sorting state
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Load courses on mount
  useEffect(() => {
    loadCourses();
  }, []);

  // Sync URL with filter values
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (filterValues.courseId) {
      params.set("subjectId", filterValues.courseId);
    } else {
      params.delete("subjectId");
    }
    
    if (filterValues.period) {
      params.set("period", filterValues.period);
    } else {
      params.delete("period");
    }
    
    if (filterValues.classId) {
      params.set("classId", filterValues.classId);
    } else {
      params.delete("classId");
    }
    
    if (filterValues.searchQuery) {
      params.set("q", filterValues.searchQuery);
    } else {
      params.delete("q");
    }
    
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [filterValues, pathname, router, searchParams]);

  // Handle filter changes and data loading with debounce
  // Empty state check: don't load data without a course selected
  useEffect(() => {
    if (!filterValues.courseId) {
      // Don't load data without a course selected
      setMatrixData(null);
      setLoading(false);
      return;
    }
    
    const timer = setTimeout(() => {
      loadData();
    }, FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filterValues, sortBy, sortOrder]);
  
  // Filter columns based on type toggles
  const filteredColumns = useMemo((): MatrixColumn[] => {
    if (!matrixData) return [];
    return matrixData.columns.filter((col) => {
      if (col.type === "project" && !showProject) return false;
      if (col.type === "peer" && !showPeer) return false;
      if (col.type === "competency" && !showCompetency) return false;
      return true;
    });
  }, [matrixData, showProject, showPeer, showCompetency]);

  const loadCourses = async () => {
    setLoadingCourses(true);
    try {
      const { courseService } = await import("@/services");
      const coursesData = await courseService.getCourses();
      setCourses(coursesData);
    } catch (error) {
      console.error("Error loading courses:", error);
    } finally {
      setLoadingCourses(false);
    }
  };

  const loadData = async () => {
    if (!filterValues.courseId) return;
    
    setLoading(true);
    try {
      const courseId = Number(filterValues.courseId);
      const filters: MatrixFilters = {
        course_id: !isNaN(courseId) ? courseId : undefined,
        class_name: filterValues.classId || undefined,
        student_name: filterValues.searchQuery || undefined,
        sort_by: sortBy || undefined,
        sort_order: sortOrder,
      };
      
      const response = await overviewService.getMatrix(filters);
      setMatrixData(response);
    } catch (error) {
      console.error("Error loading matrix data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleColumnSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      // Toggle sort order
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // New column, default to descending
      setSortBy(columnKey);
      setSortOrder("desc");
    }
  };

  const handleExportCSV = async () => {
    if (!filterValues.courseId) return;
    
    try {
      const courseId = Number(filterValues.courseId);
      const exportFilters: MatrixFilters = {
        course_id: !isNaN(courseId) ? courseId : undefined,
        class_name: filterValues.classId || undefined,
        student_name: filterValues.searchQuery || undefined,
        sort_by: sortBy || undefined,
        sort_order: sortOrder,
      };
      
      const blob = await overviewService.exportMatrixCSV(exportFilters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `overzicht-matrix-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error exporting CSV:", error);
    }
  };

  const getScoreColor = (score: number | null | undefined): string => {
    if (score === null || score === undefined) return "bg-gray-100 text-gray-400";
    
    // Assuming 1-10 scale (grades)
    if (score >= 8.0) return "bg-green-100 text-green-800";
    if (score >= 6.5) return "bg-yellow-100 text-yellow-800";
    if (score >= 5.5) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case "project": return "📊";
      case "peer": return "👥";
      case "competency": return "🎯";
      default: return "📄";
    }
  };

  const renderCell = (cell: MatrixCell | null, studentId: number, colKey: string) => {
    if (!cell) {
      return (
        <td key={colKey} className="px-3 py-2 text-center">
          <div className="w-full h-10 bg-slate-50 rounded flex items-center justify-center text-slate-300 text-xs">
            —
          </div>
        </td>
      );
    }

    const scoreColor = getScoreColor(cell.score);
    
    return (
      <td key={colKey} className="px-3 py-2 text-center">
        <Link
          href={cell.detail_url}
          className="group block"
          title={`${cell.title}\nCijfer: ${cell.score?.toFixed(1) || "—"}\nDatum: ${cell.date ? formatDate(cell.date) : "—"}\nDocent: ${cell.teacher_name || "—"}`}
        >
          <div className={`w-full h-10 rounded flex items-center justify-center ${scoreColor} group-hover:ring-2 group-hover:ring-blue-500 transition-all cursor-pointer`}>
            <div className="font-bold text-base">
              {cell.score !== null && cell.score !== undefined ? cell.score.toFixed(1) : "—"}
            </div>
          </div>
        </Link>
      </td>
    );
  };

  // Show empty state if no course selected
  if (!filterValues.courseId) {
    return (
      <div className="space-y-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Totaaloverzicht</h2>
          <p className="text-sm text-gray-600 mt-1">
            Alle beoordelingen in één overzicht
          </p>
        </div>
        <OverviewFilters
          filters={filterValues}
          onFiltersChange={setFilterValues}
          courses={courses}
          classes={availableClasses}
          loading={loadingCourses}
          showAcademicYear={false}
          showPeriod={true}
          showClass={true}
          showSearch={true}
        />
        <EmptyState />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Totaaloverzicht</h2>
          <p className="text-sm text-gray-600 mt-1">
            Alle beoordelingen in één overzicht
          </p>
        </div>
        <OverviewFilters
          filters={filterValues}
          onFiltersChange={setFilterValues}
          courses={courses}
          classes={availableClasses}
          loading={loadingCourses}
          showAcademicYear={false}
          showPeriod={true}
          showClass={true}
          showSearch={true}
        >
          {/* Column toggles */}
          <div className="flex gap-6 items-center pt-2">
            <span className="text-xs text-gray-600">Tonen:</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showProject}
                onChange={(e) => setShowProject(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm">📊 Projectbeoordeling</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPeer}
                onChange={(e) => setShowPeer(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm">👥 Peerevaluatie</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showCompetency}
                onChange={(e) => setShowCompetency(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm">🎯 Competentiescan</span>
            </label>
          </div>
        </OverviewFilters>
        <Loading />
      </div>
    );
  }

  if (!matrixData || matrixData.rows.length === 0) {
    return (
      <div className="space-y-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Totaaloverzicht</h2>
          <p className="text-sm text-gray-600 mt-1">
            Alle beoordelingen in één overzicht
          </p>
        </div>
        <OverviewFilters
          filters={filterValues}
          onFiltersChange={setFilterValues}
          courses={courses}
          classes={availableClasses}
          loading={loadingCourses}
          showAcademicYear={false}
          showPeriod={true}
          showClass={true}
          showSearch={true}
        >
          {/* Column toggles */}
          <div className="flex gap-6 items-center pt-2">
            <span className="text-xs text-gray-600">Tonen:</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showProject}
                onChange={(e) => setShowProject(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm">📊 Projectbeoordeling</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPeer}
                onChange={(e) => setShowPeer(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm">👥 Peerevaluatie</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showCompetency}
                onChange={(e) => setShowCompetency(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm">🎯 Competentiescan</span>
            </label>
          </div>
        </OverviewFilters>
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium mb-2">Geen gegevens gevonden</p>
          <p className="text-sm">Pas de filters aan om resultaten te zien</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title Section */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Totaaloverzicht</h2>
        <p className="text-sm text-gray-600 mt-1">
          Alle beoordelingen in één overzicht
        </p>
      </div>
      
      {/* Filters */}
      <OverviewFilters
        filters={filterValues}
        onFiltersChange={setFilterValues}
        courses={courses}
        classes={availableClasses}
        loading={loadingCourses}
        showAcademicYear={false}
        showPeriod={true}
        showClass={true}
        showSearch={true}
      >
        {/* Column toggles */}
        <div className="flex gap-6 items-center pt-2">
          <span className="text-xs text-gray-600">Tonen:</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showProject}
              onChange={(e) => setShowProject(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm">📊 Projectbeoordeling</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showPeer}
              onChange={(e) => setShowPeer(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm">👥 Peerevaluatie</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showCompetency}
              onChange={(e) => setShowCompetency(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm">🎯 Competentiescan</span>
          </label>
        </div>
      </OverviewFilters>

      {/* Header with summary and Export button */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {matrixData.total_students} leerlingen • {filteredColumns.length} evaluaties
        </div>
        <button
          onClick={handleExportCSV}
          className="px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-gray-100"
        >
          📥 Export
        </button>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              {/* Sticky student columns - sortable */}
              <th 
                className="sticky left-0 z-20 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide min-w-[200px] cursor-pointer hover:bg-slate-100"
                onClick={() => handleColumnSort("student")}
                title="Klik om te sorteren op naam"
              >
                <div className="flex items-center gap-1">
                  <span>Leerling</span>
                  {sortBy === "student" && (
                    <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>
                  )}
                </div>
              </th>
              <th className="sticky left-[200px] z-20 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide min-w-[120px]">
                Klas
              </th>
              
              {/* Dynamic evaluation columns - sortable */}
              {filteredColumns.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide cursor-pointer hover:bg-slate-100"
                  style={{ minWidth: "80px" }}
                  title={`${col.title}\n${col.date ? formatDate(col.date) : "Geen datum"}\nKlik om te sorteren`}
                  onClick={() => handleColumnSort(col.key)}
                >
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1">
                      <span>{getTypeIcon(col.type)}</span>
                      {sortBy === col.key && (
                        <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                    <span className="truncate max-w-[60px]">{col.title}</span>
                    <span className="text-[10px] text-gray-500">
                      {col.date ? formatDate(col.date) : "—"}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {matrixData.rows.map((row) => (
              <tr key={row.student_id} className="hover:bg-slate-50">
                {/* Sticky student info */}
                <td className="sticky left-0 z-10 bg-white px-4 py-2 text-sm font-medium text-slate-900 border-r border-slate-100 min-w-[200px]">
                  {row.student_name}
                </td>
                <td className="sticky left-[200px] z-10 bg-white px-4 py-2 text-sm text-slate-600 border-r border-slate-100 min-w-[120px]">
                  {row.student_class || "—"}
                </td>
                
                {/* Dynamic cells */}
                {filteredColumns.map((col) => 
                  renderCell(row.cells[col.key], row.student_id, col.key)
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend moved below the table */}
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-green-100 rounded"></div>
          <span>Hoog (≥8.0)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-yellow-100 rounded"></div>
          <span>Voldoende (6.5-7.9)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-orange-100 rounded"></div>
          <span>Matig (5.5-6.4)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-red-100 rounded"></div>
          <span>Onvoldoende (&lt;5.5)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-slate-50 rounded"></div>
          <span>Geen data</span>
        </div>
      </div>

      {/* Info text */}
      <div className="text-xs text-gray-500">
        💡 <strong>Tip:</strong> Klik op een cel om naar de detailweergave te gaan. Hover voor meer informatie.
      </div>
    </div>
  );
}
