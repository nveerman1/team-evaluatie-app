"use client";

import React, { useState, useEffect } from "react";
import { competencyMonitorService } from "@/services/competency-monitor.service";
import type { LearningGoalSummary } from "@/dtos/competency-monitor.dto";

interface LearningObjectivesSectionProps {
  studentId: number;
  courseId: number;
}

function getStatusColor(status: string): string {
  const statusMap: Record<string, string> = {
    in_progress: "bg-blue-100 text-blue-700",
    achieved: "bg-green-100 text-green-700",
    not_achieved: "bg-red-100 text-red-700",
  };
  return statusMap[status] || "bg-gray-100 text-gray-700";
}

function getStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    in_progress: "Lopend",
    achieved: "Behaald",
    not_achieved: "Niet behaald",
  };
  return statusMap[status] || status;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function LearningObjectivesSection({ studentId, courseId }: LearningObjectivesSectionProps) {
  const [goals, setGoals] = useState<LearningGoalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function fetchGoals() {
      try {
        setLoading(true);
        
        // Fetch competency learning goals
        const allGoals = await competencyMonitorService.getLearningGoals({
          courseId,
        });
        
        // Filter for this student
        const studentGoals = allGoals.filter(g => g.studentId === studentId);
        
        setGoals(studentGoals);
      } catch (error) {
        console.error("Error fetching learning goals:", error);
        setGoals([]);
      } finally {
        setLoading(false);
      }
    }
    fetchGoals();
  }, [studentId, courseId]);

  // Filter goals based on search and status
  const filteredGoals = goals.filter(goal => {
    const matchesSearch = searchText === "" || 
      goal.goalText.toLowerCase().includes(searchText.toLowerCase()) ||
      (goal.categoryName && goal.categoryName.toLowerCase().includes(searchText.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || goal.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Leerdoelen</h3>
        <div className="animate-pulse space-y-2">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Leerdoelen</h3>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Zoek leerdoel..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Alle statussen</option>
            <option value="in_progress">Lopend</option>
            <option value="achieved">Behaald</option>
            <option value="not_achieved">Niet behaald</option>
          </select>
        </div>
      </div>
      
      {filteredGoals.length === 0 ? (
        <p className="text-gray-500 text-center py-4">
          {goals.length === 0 ? "Geen leerdoelen gevonden" : "Geen leerdoelen gevonden met deze filters"}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-[50%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Leerdoel
                </th>
                <th className="w-[20%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Competentie
                </th>
                <th className="w-[15%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Datum
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredGoals.map((goal) => (
                <tr key={goal.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="line-clamp-2 whitespace-normal break-words">
                      {goal.goalText}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div className="line-clamp-1">
                      {goal.categoryName || "-"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                        goal.status
                      )}`}
                    >
                      {getStatusLabel(goal.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(goal.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
