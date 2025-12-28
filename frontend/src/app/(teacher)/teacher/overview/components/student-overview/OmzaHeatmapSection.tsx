"use client";

import React, { useState, useEffect } from "react";
import { peerEvaluationOverviewService } from "@/services/peer-evaluation-overview.service";
import type { 
  StudentHeatmapRow 
} from "@/services/peer-evaluation-overview.service";

interface EvaluationHeatmapSectionProps {
  studentId: number;
  courseId: number;
  onEvaluationClick?: (evaluationId: number) => void;
}

function getScoreColor(score: number | null): string {
  if (score === null) return "bg-gray-100 text-gray-400";
  if (score >= 4) return "bg-green-100 text-green-700";
  if (score >= 3) return "bg-blue-100 text-blue-700";
  return "bg-orange-100 text-orange-700";
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function EvaluationHeatmapSection({ studentId, courseId, onEvaluationClick }: EvaluationHeatmapSectionProps) {
  const [studentData, setStudentData] = useState<StudentHeatmapRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await peerEvaluationOverviewService.getDashboard({
          courseId,
        });

        // Find student in heatmap data
        const student = response.heatmapData.find(s => s.student_id === studentId);
        setStudentData(student || null);
      } catch (error) {
        console.error("Error fetching evaluation data:", error);
        setStudentData(null);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [studentId, courseId]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Evaluaties Heatmap</h3>
        <div className="animate-pulse space-y-2">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Evaluaties Heatmap</h3>
      {!studentData || !studentData.evaluations || studentData.evaluations.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Geen evaluaties gevonden</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-[40%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Evaluatie
                </th>
                <th className="w-[15%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  O
                </th>
                <th className="w-[15%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  M
                </th>
                <th className="w-[15%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Z
                </th>
                <th className="w-[15%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  A
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {studentData.evaluations.map((evaluation) => (
                <tr
                  key={evaluation.id}
                  onClick={() => onEvaluationClick?.(evaluation.id)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3 text-sm">
                    <div className="line-clamp-1 text-gray-900">{evaluation.label}</div>
                    <div className="text-xs text-gray-500">{formatDate(evaluation.date)}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getScoreColor(evaluation.scores['O'])}`}>
                      {evaluation.scores['O'] ? evaluation.scores['O'].toFixed(1) : "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getScoreColor(evaluation.scores['M'])}`}>
                      {evaluation.scores['M'] ? evaluation.scores['M'].toFixed(1) : "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getScoreColor(evaluation.scores['Z'])}`}>
                      {evaluation.scores['Z'] ? evaluation.scores['Z'].toFixed(1) : "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getScoreColor(evaluation.scores['A'])}`}>
                      {evaluation.scores['A'] ? evaluation.scores['A'].toFixed(1) : "-"}
                    </span>
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
