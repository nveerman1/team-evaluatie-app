"use client";

import { useState, useEffect } from "react";
import { useCompetencyReflections } from "@/hooks/useCompetencyOverview";
import { Loading, ErrorMessage } from "@/components";
import type { CompetencyOverviewFilters } from "@/dtos/competency-monitor.dto";

interface ReflectionsSubTabProps {
  filters: CompetencyOverviewFilters;
}

export function ReflectionsSubTab({ filters }: ReflectionsSubTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedReflections, setExpandedReflections] = useState<Set<number>>(new Set());
  
  const { data: reflections, loading, error } = useCompetencyReflections(filters);

  // Client-side filtering for search (to avoid refetch on every keystroke)
  const [filteredReflections, setFilteredReflections] = useState(reflections || []);
  
  useEffect(() => {
    if (!reflections) {
      setFilteredReflections([]);
      return;
    }
    
    if (!searchQuery.trim()) {
      setFilteredReflections(reflections);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = reflections.filter((reflection) => 
      reflection.reflectionText.toLowerCase().includes(query) ||
      reflection.studentName.toLowerCase().includes(query) ||
      (reflection.className && reflection.className.toLowerCase().includes(query))
    );
    setFilteredReflections(filtered);
  }, [reflections, searchQuery]);

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

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div>
          <label className="block text-xs text-gray-600 mb-1">🔍 Zoeken</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Zoek in reflecties of leerlingnaam..."
            className="w-full px-3 py-2 text-sm border rounded-lg"
          />
        </div>
      </div>

      {/* Reflections Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {filteredReflections.length > 0 ? (
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
                {filteredReflections.map((reflection) => {
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
