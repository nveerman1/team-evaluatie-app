"use client";

import { useState, useMemo } from "react";
import { useCompetencyReflections, useCompetencyFilterOptions } from "@/hooks/useCompetencyOverview";
import { Loading, ErrorMessage } from "@/components";
import type { CompetencyOverviewFilters } from "@/dtos/competency-monitor.dto";

export function ReflectionsSubTab() {
  const [filters, setFilters] = useState<CompetencyOverviewFilters>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedReflections, setExpandedReflections] = useState<Set<number>>(new Set());
  
  // Memoize filters to prevent infinite re-renders
  const memoizedFilters = useMemo(() => ({ ...filters, searchQuery }), [filters, searchQuery]);
  
  const { data: filterOptions, loading: filterLoading } = useCompetencyFilterOptions();
  const { data: reflections, loading, error } = useCompetencyReflections(memoizedFilters);

  const toggleExpand = (reflectionId: number) => {
    const newExpanded = new Set(expandedReflections);
    if (newExpanded.has(reflectionId)) {
      newExpanded.delete(reflectionId);
    } else {
      newExpanded.add(reflectionId);
    }
    setExpandedReflections(newExpanded);
  };

  const formatDate = (dateStr: string) => {
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">🔍 Zoeken</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Zoek in reflecties..."
              className="w-full px-3 py-2 text-sm border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Klas</label>
            <select
              value={filters.className || ""}
              onChange={(e) => setFilters({ ...filters, className: e.target.value || undefined })}
              className="w-full px-3 py-2 text-sm border rounded-lg"
            >
              <option value="">Alle klassen</option>
              {filterOptions?.classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Categorie</label>
            <select
              value={filters.categoryId || ""}
              onChange={(e) => setFilters({ ...filters, categoryId: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full px-3 py-2 text-sm border rounded-lg"
            >
              <option value="">Alle categorieën</option>
              {filterOptions?.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Scan</label>
            <select
              value={filters.scanRange || ""}
              onChange={(e) => setFilters({ ...filters, scanRange: e.target.value as CompetencyOverviewFilters["scanRange"] || undefined })}
              className="w-full px-3 py-2 text-sm border rounded-lg"
            >
              <option value="">Alle scans</option>
              {filterOptions?.scans.map((s) => (
                <option key={s.id} value={s.id.toString()}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Reflections Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {reflections.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide">Leerling</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">Klas</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">Categorie</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">Scan</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">Datum</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide min-w-[350px]">Reflectie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reflections.map((reflection) => {
                  const isExpanded = expandedReflections.has(reflection.id);
                  const text = reflection.reflectionText;
                  const shouldTruncate = text.length > 150;
                  
                  return (
                    <tr key={reflection.id} className="bg-white hover:bg-slate-50">
                      <td className="px-5 py-3 text-sm text-slate-800 font-medium">
                        {reflection.studentName}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-600">
                        {reflection.className || "–"}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-600">
                        {reflection.categoryName ? (
                          <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs">
                            {reflection.categoryName}
                          </span>
                        ) : (
                          <span className="text-slate-400">Algemeen</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-600">
                        <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs">
                          {reflection.scanLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-600">
                        {formatDate(reflection.createdAt)}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        <div>
                          {shouldTruncate && !isExpanded ? (
                            <>
                              {text.substring(0, 150)}...
                              <button
                                onClick={() => toggleExpand(reflection.id)}
                                className="ml-1 text-blue-600 hover:underline text-xs"
                              >
                                Meer tonen
                              </button>
                            </>
                          ) : (
                            <>
                              {text}
                              {shouldTruncate && (
                                <button
                                  onClick={() => toggleExpand(reflection.id)}
                                  className="ml-1 text-blue-600 hover:underline text-xs"
                                >
                                  Minder tonen
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500">
            <p>Geen reflecties gevonden</p>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
        <p className="text-sm text-slate-600">
          <span className="font-semibold">{reflections.length}</span> reflecties gevonden
        </p>
        <p className="text-xs text-slate-500">
          💡 Reflecties helpen docenten inzicht te krijgen in het leerproces van studenten
        </p>
      </div>
    </div>
  );
}
