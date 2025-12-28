"use client";

import React, { useState, useEffect } from "react";
import { peerEvaluationOverviewService } from "@/services/peer-evaluation-overview.service";
import type { ReflectionItem } from "@/services/peer-evaluation-overview.service";

interface ReflectionsSectionProps {
  studentId: number;
  courseId: number;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function ReflectionsSection({ studentId, courseId }: ReflectionsSectionProps) {
  const [reflections, setReflections] = useState<ReflectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReflections() {
      try {
        setLoading(true);
        const response = await peerEvaluationOverviewService.getReflections({
          courseId,
        });
        
        // Filter for this student
        const studentReflections = response.reflectionItems.filter(
          (r) => r.student_id === studentId
        );
        setReflections(studentReflections);
      } catch (error) {
        console.error("Error fetching reflections:", error);
        setReflections([]);
      } finally {
        setLoading(false);
      }
    }
    fetchReflections();
  }, [studentId, courseId]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Reflecties</h3>
        <div className="animate-pulse space-y-2">
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Reflecties</h3>
      
      {reflections.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Geen reflecties gevonden</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-[20%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Project
                </th>
                <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Datum
                </th>
                <th className="w-[55%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Reflectie
                </th>
                <th className="w-[10%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Woorden
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reflections.map((reflection) => (
                <tr key={reflection.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="line-clamp-2">
                      {reflection.project_name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {formatDate(reflection.date)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="line-clamp-3 whitespace-normal break-words">
                      {reflection.reflection_text}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-center">
                    {reflection.word_count}
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
