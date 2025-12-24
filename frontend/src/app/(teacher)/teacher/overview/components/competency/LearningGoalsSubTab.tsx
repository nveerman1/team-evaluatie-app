"use client";

import { useState, useEffect } from "react";
import { useCompetencyLearningGoals } from "@/hooks/useCompetencyOverview";
import { Loading, ErrorMessage } from "@/components";
import type { CompetencyOverviewFilters } from "@/dtos/competency-monitor.dto";

interface LearningGoalsSubTabProps {
  filters: CompetencyOverviewFilters;
}

export function LearningGoalsSubTab({ filters }: LearningGoalsSubTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [expandedGoals, setExpandedGoals] = useState<Set<number>>(new Set());
  
  // Combine parent filters with local filters
  const combinedFilters = { ...filters, status: statusFilter || undefined };
  
  const { data: learningGoals, loading, error } = useCompetencyLearningGoals(combinedFilters);

  // Client-side filtering for search (to avoid refetch on every keystroke)
  const [filteredGoals, setFilteredGoals] = useState(learningGoals || []);
  
  useEffect(() => {
    if (!learningGoals) {
      setFilteredGoals([]);
      return;
    }
    
    if (!searchQuery.trim()) {
      setFilteredGoals(learningGoals);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = learningGoals.filter((goal) => 
      goal.goalText.toLowerCase().includes(query) ||
      goal.studentName.toLowerCase().includes(query) ||
      (goal.className && goal.className.toLowerCase().includes(query))
    );
    setFilteredGoals(filtered);
  }, [learningGoals, searchQuery]);

  const toggleExpand = (goalId: number) => {
    const newExpanded = new Set(expandedGoals);
    if (newExpanded.has(goalId)) {
      newExpanded.delete(goalId);
    } else {
      newExpanded.add(goalId);
    }
    setExpandedGoals(newExpanded);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      in_progress: { label: "Lopend", className: "bg-blue-100 text-blue-700" },
      achieved: { label: "Behaald", className: "bg-green-100 text-green-700" },
      not_achieved: { label: "Niet behaald", className: "bg-red-100 text-red-700" },
    };
    const config = statusMap[status] || { label: status, className: "bg-gray-100 text-gray-700" };
    return (
      <span className={`px-2 py-1 rounded-md text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
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
      {/* Search and Filter Bar */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">🔍 Zoeken</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Zoek in leerdoelen of leerlingnaam..."
              className="w-full px-3 py-2 text-sm border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg"
            >
              <option value="">Alle statussen</option>
              <option value="in_progress">Lopend</option>
              <option value="achieved">Behaald</option>
              <option value="not_achieved">Niet behaald</option>
            </select>
          </div>
        </div>
      </div>

      {/* Learning Goals Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {filteredGoals.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide">Leerling</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">Klas</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">Categorie</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide min-w-[300px]">Leerdoel</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">Laatst bijgewerkt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGoals.map((goal) => {
                  const isExpanded = expandedGoals.has(goal.id);
                  const goalText = goal.goalText;
                  const shouldTruncate = goalText.length > 100;
                  
                  return (
                    <tr key={goal.id} className="bg-white hover:bg-slate-50">
                      <td className="px-5 py-3 text-sm text-slate-800 font-medium">
                        {goal.studentName}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-600">
                        {goal.className || "–"}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-600">
                        {goal.categoryName ? (
                          <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs">
                            {goal.categoryName}
                          </span>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        <div>
                          {shouldTruncate && !isExpanded ? (
                            <>
                              {goalText.substring(0, 100)}...
                              <button
                                onClick={() => toggleExpand(goal.id)}
                                className="ml-1 text-blue-600 hover:underline text-xs"
                              >
                                Meer tonen
                              </button>
                            </>
                          ) : (
                            <>
                              {goalText}
                              {shouldTruncate && (
                                <button
                                  onClick={() => toggleExpand(goal.id)}
                                  className="ml-1 text-blue-600 hover:underline text-xs"
                                >
                                  Minder tonen
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(goal.status)}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-600">
                        {formatDate(goal.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500">
            <p>Geen leerdoelen gevonden</p>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-xs text-blue-600">Lopend</p>
          <p className="text-2xl font-bold text-blue-700">
            {learningGoals.filter((g) => g.status === "in_progress").length}
          </p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-xs text-green-600">Behaald</p>
          <p className="text-2xl font-bold text-green-700">
            {learningGoals.filter((g) => g.status === "achieved").length}
          </p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <p className="text-xs text-red-600">Niet behaald</p>
          <p className="text-2xl font-bold text-red-700">
            {learningGoals.filter((g) => g.status === "not_achieved").length}
          </p>
        </div>
      </div>
    </div>
  );
}
