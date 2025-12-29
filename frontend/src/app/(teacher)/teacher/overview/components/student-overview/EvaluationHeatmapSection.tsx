"use client";

import React, { useState, useEffect } from "react";
import { peerEvaluationOverviewService } from "@/services/peer-evaluation-overview.service";
import { gradesService } from "@/services/grades.service";
import type { 
  StudentHeatmapRow,
  PeerEvaluationDetail 
} from "@/services/peer-evaluation-overview.service";
import type { GradePreviewItem } from "@/dtos/grades.dto";

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

function formatGrade(grade: number | null | undefined): string {
  if (grade === null || grade === undefined) return "-";
  return grade.toFixed(1);
}

// Render teacher emoticon matching Peerevaluaties tab style exactly
function renderTeacherEmoticon(score: number | null | undefined) {
  if (!score) return <span className="text-slate-300">–</span>;
  
  // 4-level system matching OMZA evaluation page: 1=best (🙂), 4=worst (!!)
  if (score === 1) {
    return (
      <span 
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-green-500 bg-green-100 text-[10px] font-medium text-green-700" 
        title="Gaat goed"
      >
        🙂
      </span>
    );
  }
  if (score === 2) {
    return (
      <span 
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-green-500 bg-green-100 text-[10px] font-medium text-green-700" 
        title="Voldoet aan verwachting"
      >
        ✓
      </span>
    );
  }
  if (score === 3) {
    return (
      <span 
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-400 bg-amber-100 text-[10px] font-medium text-amber-700" 
        title="Let op: verbeterpunt"
      >
        !
      </span>
    );
  }
  if (score === 4) {
    return (
      <span 
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-rose-500 bg-rose-100 text-[10px] font-medium text-rose-700" 
        title="Urgent: direct bespreken"
      >
        !!
      </span>
    );
  }
  return <span className="text-slate-300">–</span>;
}

interface EvaluationData extends PeerEvaluationDetail {
  gcf?: number | null;
  finalGrade?: number | null;
}

export function EvaluationHeatmapSection({ studentId, courseId, onEvaluationClick }: EvaluationHeatmapSectionProps) {
  const [studentData, setStudentData] = useState<StudentHeatmapRow | null>(null);
  const [evaluations, setEvaluations] = useState<EvaluationData[]>([]);
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
        
        if (student && student.evaluations && student.evaluations.length > 0) {
          // For each evaluation, try to fetch grade data
          const enrichedEvaluations = await Promise.all(
            student.evaluations.map(async (evaluation) => {
              try {
                // Fetch grade data for this evaluation
                const gradeData = await gradesService.previewGrades(evaluation.id);
                const studentGrade = gradeData.items.find((item: GradePreviewItem) => item.user_id === studentId);
                
                return {
                  ...evaluation,
                  gcf: studentGrade?.gcf ?? null,
                  finalGrade: studentGrade?.suggested_grade ?? null,
                };
              } catch (error) {
                console.error(`Error fetching grade for evaluation ${evaluation.id}:`, error);
                return {
                  ...evaluation,
                  gcf: null,
                  finalGrade: null,
                };
              }
            })
          );
          
          setEvaluations(enrichedEvaluations);
        } else {
          console.warn("No evaluations found for student:", {studentId, student});
          setEvaluations([]);
        }
      } catch (error) {
        console.error("Error fetching evaluation data:", error);
        setStudentData(null);
        setEvaluations([]);
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
      {evaluations.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Geen evaluaties gevonden</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-[20%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Evaluatie
                </th>
                <th className="w-[8%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  O
                </th>
                <th className="w-[8%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  M
                </th>
                <th className="w-[8%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Z
                </th>
                <th className="w-[8%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  A
                </th>
                <th className="w-[6%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  O
                </th>
                <th className="w-[6%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  M
                </th>
                <th className="w-[6%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Z
                </th>
                <th className="w-[6%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  A
                </th>
                <th className="w-[8%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider" title="Persoonlijke teambijdrage factor">
                  GCF
                </th>
                <th className="w-[8%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Eindcijfer
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {evaluations.map((evaluation) => (
                <tr
                  key={evaluation.id}
                  onClick={() => onEvaluationClick?.(evaluation.id)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3 text-sm">
                    <div className="line-clamp-1 text-gray-900">{evaluation.label}</div>
                    <div className="text-xs text-gray-500">{formatDate(evaluation.date)}</div>
                  </td>
                  {/* Peer scores */}
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
                  {/* Teacher emoticon scores */}
                  <td className="px-4 py-3 text-center">
                    {renderTeacherEmoticon(evaluation.teacher_scores?.['O'])}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {renderTeacherEmoticon(evaluation.teacher_scores?.['M'])}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {renderTeacherEmoticon(evaluation.teacher_scores?.['Z'])}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {renderTeacherEmoticon(evaluation.teacher_scores?.['A'])}
                  </td>
                  {/* GCF */}
                  <td className="px-4 py-3 text-center text-sm text-gray-700 font-medium">
                    {evaluation.gcf ? evaluation.gcf.toFixed(2) : "-"}
                  </td>
                  {/* Final Grade */}
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {formatGrade(evaluation.finalGrade)}
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
