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
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Leerdoelen</h3>
      
      {goals.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Geen leerdoelen gevonden</p>
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
              {goals.map((goal) => (
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
