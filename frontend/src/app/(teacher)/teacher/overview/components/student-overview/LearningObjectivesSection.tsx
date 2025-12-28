"use client";

import React, { useState, useEffect } from "react";
import { getLearningObjectivesOverview, listLearningObjectives } from "@/services/learning-objective.service";
import type { LearningObjectiveDto, LearningObjectiveOverviewResponse } from "@/dtos/learning-objective.dto";

interface LearningObjectivesSectionProps {
  studentId: number;
  courseId: number;
}

function getScoreColor(score: number | null): string {
  if (score === null) return "bg-gray-100 text-gray-400";
  if (score >= 4) return "bg-green-100 text-green-800";
  if (score >= 3) return "bg-yellow-100 text-yellow-800";
  if (score >= 2) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

function formatScore(score: number | null): string {
  if (score === null) return "-";
  return score.toFixed(1);
}

export function LearningObjectivesSection({ studentId, courseId }: LearningObjectivesSectionProps) {
  const [objectives, setObjectives] = useState<LearningObjectiveDto[]>([]);
  const [studentProgress, setStudentProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // Fetch all objectives
        const objResponse = await listLearningObjectives({
          limit: 100,
          include_teacher_objectives: true,
          include_course_objectives: true,
        });
        setObjectives(objResponse.items);
        
        // Fetch overview data
        const overviewResponse = await getLearningObjectivesOverview({
          course_id: courseId,
          include_teacher_objectives: true,
          include_course_objectives: true,
        });
        
        // Find this student's data - check both student_id and id fields
        const student = overviewResponse.students.find(
          (s: any) => s.student_id === studentId || s.id === studentId
        );
        
        console.log("Learning objectives - looking for student:", studentId);
        console.log("Learning objectives - found students:", overviewResponse.students.map((s: any) => ({ id: s.id, student_id: s.student_id, name: s.student_name })));
        console.log("Learning objectives - matched student:", student);
        
        setStudentProgress(student || null);
      } catch (error) {
        console.error("Error fetching learning objectives:", error);
        setObjectives([]);
        setStudentProgress(null);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
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
      
      {objectives.length === 0 || !studentProgress ? (
        <p className="text-gray-500 text-center py-4">Geen leerdoelen gevonden</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-[40%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Leerdoel
                </th>
                <th className="w-[30%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Domein
                </th>
                <th className="w-[15%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Score
                </th>
                <th className="w-[15%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Voortgang
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {objectives.map((objective) => {
                const progress = studentProgress.objectives?.find(
                  (o: any) => o.objective_id === objective.id
                );
                
                return (
                  <tr key={objective.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="line-clamp-2 whitespace-normal break-words">
                        {objective.title}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="line-clamp-1">
                        {objective.domain || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreColor(
                          progress?.average_score || null
                        )}`}
                      >
                        {formatScore(progress?.average_score || null)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">
                      {progress?.assessment_count || 0}x
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
