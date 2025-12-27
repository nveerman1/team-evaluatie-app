"use client";

import React, { useState, useMemo, Suspense } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useAggregatedFeedback, type AggregatedFeedbackItem, type AggregatedFeedbackFilters } from "@/hooks/useAggregatedFeedback";

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
};

type PeerfeedbackTableProps = {
  filters: AggregatedFeedbackFilters;
  searchQuery?: string;
  typeFilter?: "all" | "self" | "peer";
};

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

export function PeerfeedbackTable({ filters, searchQuery = "", typeFilter = "all" }: PeerfeedbackTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'student_name',
    direction: 'asc'
  });
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  
  // Use aggregated feedback hook
  const { data, loading, error } = useAggregatedFeedback(filters);

  // Filter by search query and type filter
  const filteredData = useMemo(() => {
    if (!data?.feedbackItems) return [];
    
    let items = data.feedbackItems;
    
    // Apply type filter
    if (typeFilter !== "all") {
      items = items.filter(item => item.feedback_type === typeFilter);
    }
    
    // Apply search query
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      items = items.filter(item =>
        item.student_name.toLowerCase().includes(searchLower) ||
        (item.from_student_name || "").toLowerCase().includes(searchLower) ||
        item.project_name.toLowerCase().includes(searchLower) ||
        item.combined_feedback.toLowerCase().includes(searchLower)
      );
    }
    
    return items;
  }, [data?.feedbackItems, searchQuery, typeFilter]);

  // Sorted data
  const sortedData = useMemo(() => {
    const items = [...filteredData];
    items.sort((a, b) => {
      let aVal: any = a[sortConfig.key as keyof typeof a];
      let bVal: any = b[sortConfig.key as keyof typeof b];
      
      // Handle date sorting
      if (sortConfig.key === 'date') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      
      // Handle OMZA score sorting (O, M, Z, A)
      if (['score_O', 'score_M', 'score_Z', 'score_A'].includes(sortConfig.key)) {
        aVal = aVal || 0;
        bVal = bVal || 0;
      }
      
      // Handle string sorting
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return items;
  }, [filteredData, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIndicator = (key: string) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  const toggleRow = (id: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Get color for OMZA scores (1-5 scale)
  const getScoreColor = (score: number | null | undefined) => {
    if (!score) return "text-slate-400";
    if (score >= 4.5) return "text-green-600 font-semibold";
    if (score >= 3.5) return "text-green-500 font-medium";
    if (score >= 2.5) return "text-amber-500";
    if (score >= 1.5) return "text-orange-500";
    return "text-red-500 font-semibold";
  };

  if (error) {
    return (
      <div className="text-red-500 p-4 bg-red-50 rounded-lg">
        Fout bij laden: {error}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
        <h3 className="text-base font-semibold text-slate-900 leading-6">
          Peerfeedback ({sortedData.length} resultaten)
        </h3>
        <p className="text-sm text-slate-600">Peer evaluaties geaggregeerd per beoordeling met OMZA scores</p>
      </div>

      <Suspense fallback={<div className="p-6"><TableSkeleton /></div>}>
        {loading ? (
          <div className="p-6"><TableSkeleton /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th 
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide min-w-[140px] cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort('student_name')}
                  >
                    Leerling{getSortIndicator('student_name')}
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide min-w-[120px] cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort('project_name')}
                  >
                    Project/Scan{getSortIndicator('project_name')}
                  </th>
                  <th 
                    className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort('feedback_type')}
                  >
                    Type{getSortIndicator('feedback_type')}
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide min-w-[100px] cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort('from_student_name')}
                  >
                    Van{getSortIndicator('from_student_name')}
                  </th>
                  <th 
                    className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort('score_O')}
                  >
                    O{getSortIndicator('score_O')}
                  </th>
                  <th 
                    className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort('score_M')}
                  >
                    M{getSortIndicator('score_M')}
                  </th>
                  <th 
                    className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort('score_Z')}
                  >
                    Z{getSortIndicator('score_Z')}
                  </th>
                  <th 
                    className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort('score_A')}
                  >
                    A{getSortIndicator('score_A')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide min-w-[200px]">
                    Feedback
                  </th>
                  <th 
                    className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort('date')}
                  >
                    Datum{getSortIndicator('date')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedData.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                      Geen feedback gevonden
                    </td>
                  </tr>
                ) : (
                  sortedData.map((item) => {
                    const isExpanded = expandedRows.has(item.allocation_id);
                    return (
                      <React.Fragment key={item.allocation_id}>
                        <tr 
                          className="hover:bg-slate-50 cursor-pointer"
                          onClick={() => toggleRow(item.allocation_id)}
                        >
                          <td className="px-4 py-3 text-sm text-slate-800">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                              {item.student_name}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-800">
                            {item.project_name}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              item.feedback_type === 'self' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                            }`}>
                              {item.feedback_type === 'self' ? 'Self' : 'Peer'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-800">
                            {item.from_student_name || '–'}
                          </td>
                          <td className={`px-4 py-3 text-center text-sm font-medium ${getScoreColor(item.score_O)}`}>
                            {item.score_O ? item.score_O.toFixed(1) : '–'}
                          </td>
                          <td className={`px-4 py-3 text-center text-sm font-medium ${getScoreColor(item.score_M)}`}>
                            {item.score_M ? item.score_M.toFixed(1) : '–'}
                          </td>
                          <td className={`px-4 py-3 text-center text-sm font-medium ${getScoreColor(item.score_Z)}`}>
                            {item.score_Z ? item.score_Z.toFixed(1) : '–'}
                          </td>
                          <td className={`px-4 py-3 text-center text-sm font-medium ${getScoreColor(item.score_A)}`}>
                            {item.score_A ? item.score_A.toFixed(1) : '–'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-800 max-w-md">
                            <p className="line-clamp-2">{item.combined_feedback}</p>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-slate-600">
                            {new Date(item.date).toLocaleDateString("nl-NL", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric"
                            })}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50">
                            <td colSpan={10} className="px-4 py-4">
                              <div className="space-y-3">
                                <div className="text-xs font-semibold text-slate-500 uppercase mb-3">
                                  Individuele Criteria:
                                </div>
                                {item.criteria_details.length === 0 ? (
                                  <p className="text-sm text-slate-500">Geen criteria details beschikbaar</p>
                                ) : (
                                  <div className="space-y-2">
                                    {item.criteria_details.map((criterion, idx) => (
                                      <div key={idx} className="bg-white rounded-lg p-3 border border-slate-200">
                                        <div className="flex items-start gap-3">
                                          <div className="flex-shrink-0">
                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold ${
                                              criterion.category === 'O' ? 'bg-blue-100 text-blue-700' :
                                              criterion.category === 'M' ? 'bg-green-100 text-green-700' :
                                              criterion.category === 'Z' ? 'bg-amber-100 text-amber-700' :
                                              'bg-violet-100 text-violet-700'
                                            }`}>
                                              {criterion.category}
                                            </span>
                                          </div>
                                          <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="text-sm font-medium text-slate-800">{criterion.criterion_name}</span>
                                              {criterion.score !== null && criterion.score !== undefined && (
                                                <span className={`text-sm font-semibold ${getScoreColor(criterion.score)}`}>
                                                  {criterion.score.toFixed(1)}
                                                </span>
                                              )}
                                            </div>
                                            {criterion.feedback && (
                                              <p className="text-sm text-slate-600 mt-1">{criterion.feedback}</p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </Suspense>
    </div>
  );
}
