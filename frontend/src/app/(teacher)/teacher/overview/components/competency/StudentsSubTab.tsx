"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useCompetencyStudents, useCompetencyFilterOptions } from "@/hooks/useCompetencyOverview";
import { Loading, ErrorMessage } from "@/components";
import type { CompetencyOverviewFilters } from "@/dtos/competency-monitor.dto";

type SortField = "name" | "score" | "trend" | "className";
type SortOrder = "asc" | "desc";

export function StudentsSubTab() {
  const [filters, setFilters] = useState<CompetencyOverviewFilters>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  
  // Memoize filters to prevent infinite re-renders
  const memoizedFilters = useMemo(() => ({ ...filters, searchQuery }), [filters, searchQuery]);
  
  const { data: filterOptions, loading: filterLoading } = useCompetencyFilterOptions();
  const { data: students, loading, error } = useCompetencyStudents(memoizedFilters);

  // Sort students
  const sortedStudents = useMemo(() => {
    if (!students) return [];
    
    return [...students].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "className":
          comparison = (a.className || "").localeCompare(b.className || "");
          break;
        case "score":
          comparison = (a.lastOverallScore || 0) - (b.lastOverallScore || 0);
          break;
        case "trend":
          comparison = (a.trendDelta || 0) - (b.trendDelta || 0);
          break;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [students, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? " ↑" : " ↓";
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

  const getScoreColor = (score: number | null): string => {
    if (score === null) return "bg-gray-100 text-gray-400";
    if (score >= 4) return "bg-green-100 text-green-700";
    if (score >= 3) return "bg-blue-100 text-blue-700";
    return "bg-orange-100 text-orange-700";
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "–";
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (filterLoading || loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-600 mb-1">🔍 Zoeken</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Zoek op naam..."
              className="w-full px-3 py-2 text-sm border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Academisch Jaar</label>
            <select
              value={filters.academicYearId || ""}
              onChange={(e) => setFilters({ ...filters, academicYearId: e.target.value ? Number(e.target.value) : undefined })}
              className="px-3 py-2 text-sm border rounded-lg min-w-[150px]"
            >
              <option value="">Alle jaren</option>
              {filterOptions?.academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>{ay.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Vak</label>
            <select
              value={filters.courseId || ""}
              onChange={(e) => setFilters({ ...filters, courseId: e.target.value ? Number(e.target.value) : undefined })}
              className="px-3 py-2 text-sm border rounded-lg min-w-[150px]"
            >
              <option value="">Alle vakken</option>
              {filterOptions?.courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {sortedStudents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th 
                    className="px-5 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("name")}
                  >
                    Leerling{getSortIndicator("name")}
                  </th>
                  <th 
                    className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("className")}
                  >
                    Klas{getSortIndicator("className")}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">
                    Laatste scan
                  </th>
                  <th 
                    className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("score")}
                  >
                    Gemiddelde{getSortIndicator("score")}
                  </th>
                  <th 
                    className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("trend")}
                  >
                    Trend{getSortIndicator("trend")}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">
                    Sterkste categorie
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">
                    Zwakste categorie
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedStudents.map((student) => (
                  <tr key={student.studentId} className="bg-white hover:bg-slate-50">
                    <td className="px-5 py-3 text-sm text-slate-800 font-medium">
                      <Link
                        href={`/teacher/competencies/student/${student.studentId}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {student.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">
                      {student.className || "–"}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">
                      {formatDate(student.lastScanDate)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-md text-sm font-semibold ${getScoreColor(student.lastOverallScore)}`}>
                        {student.lastOverallScore?.toFixed(1) || "–"}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-center text-sm font-medium ${getTrendColor(student.trendDelta)}`}>
                      {student.trendDelta !== null 
                        ? (student.trendDelta > 0 ? "+" : "") + student.trendDelta.toFixed(1)
                        : "–"
                      }
                      {" "}{getTrendArrow(student.trendDelta)}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">
                      {student.strongestCategory ? (
                        <span className="inline-flex items-center px-2 py-1 bg-green-50 text-green-700 rounded-md text-xs">
                          {student.strongestCategory}
                        </span>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">
                      {student.weakestCategory ? (
                        <span className="inline-flex items-center px-2 py-1 bg-orange-50 text-orange-700 rounded-md text-xs">
                          {student.weakestCategory}
                        </span>
                      ) : (
                        "–"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500">
            <p>Geen leerlingen gevonden</p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-xs text-gray-500">
        💡 <strong>Tip:</strong> Klik op de kolomkop om te sorteren. Klik op een leerlingnaam voor details.
      </div>
    </div>
  );
}
