"use client";

import React, { useState, useEffect } from "react";
import { X, ChevronLeft } from "lucide-react";
import { peerEvaluationOverviewService } from "@/services/peer-evaluation-overview.service";
import type { 
  AggregatedFeedbackItem,
  TeacherFeedbackItem 
} from "@/services/peer-evaluation-overview.service";

interface FeedbackSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: number;
  courseId: number;
  initialEvaluationId?: number | null;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function FeedbackSidePanel({ 
  isOpen, 
  onClose, 
  studentId, 
  courseId,
  initialEvaluationId 
}: FeedbackSidePanelProps) {
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<number | null>(initialEvaluationId || null);
  const [peerEvaluations, setPeerEvaluations] = useState<AggregatedFeedbackItem[]>([]);
  const [teacherFeedback, setTeacherFeedback] = useState<TeacherFeedbackItem[]>([]);
  const [selectedFeedback, setSelectedFeedback] = useState<AggregatedFeedbackItem[]>([]);
  const [selectedTeacherFeedback, setSelectedTeacherFeedback] = useState<TeacherFeedbackItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch evaluation lists
  useEffect(() => {
    async function fetchEvaluationLists() {
      if (!isOpen) return;
      
      try {
        setLoading(true);
        const [peerResp, teacherResp] = await Promise.all([
          peerEvaluationOverviewService.getAggregatedFeedback({ courseId }),
          peerEvaluationOverviewService.getTeacherFeedback({ courseId }),
        ]);
        
        // Filter for this student
        const studentPeer = peerResp.feedbackItems.filter(f => f.student_id === studentId);
        const studentTeacher = teacherResp.feedbackItems.filter(f => f.student_id === studentId);
        
        setPeerEvaluations(studentPeer);
        setTeacherFeedback(studentTeacher);
      } catch (error) {
        console.error("Error fetching evaluations:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchEvaluationLists();
  }, [isOpen, studentId, courseId]);

  // Set initial evaluation if provided
  useEffect(() => {
    if (initialEvaluationId) {
      setSelectedEvaluationId(initialEvaluationId);
    }
  }, [initialEvaluationId]);

  // Load evaluation detail when selected
  useEffect(() => {
    if (selectedEvaluationId) {
      const peer = peerEvaluations.filter(p => p.evaluation_id === selectedEvaluationId);
      const teacher = teacherFeedback.find(t => t.evaluation_id === selectedEvaluationId);
      
      setSelectedFeedback(peer);
      setSelectedTeacherFeedback(teacher || null);
    }
  }, [selectedEvaluationId, peerEvaluations, teacherFeedback]);

  const handleBackToList = () => {
    setSelectedEvaluationId(null);
    setSelectedFeedback([]);
    setSelectedTeacherFeedback(null);
  };

  if (!isOpen) return null;

  // Group peer evaluations by evaluation_id for the list view
  const peerEvalGroups = peerEvaluations.reduce((acc, item) => {
    if (!acc[item.evaluation_id]) {
      acc[item.evaluation_id] = {
        evaluation_id: item.evaluation_id,
        project_name: item.project_name,
        date: item.date,
        count: 0,
      };
    }
    acc[item.evaluation_id].count++;
    return acc;
  }, {} as Record<number, { evaluation_id: number; project_name: string; date: string; count: number }>);

  const peerEvalList = Object.values(peerEvalGroups);

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />
      
      {/* Side Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl z-50 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {selectedEvaluationId ? "Evaluatie Detail" : "Feedback Overzicht"}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-4">
              <div className="animate-pulse h-20 bg-gray-200 rounded"></div>
              <div className="animate-pulse h-20 bg-gray-200 rounded"></div>
            </div>
          ) : selectedEvaluationId ? (
            /* Detail View */
            <div className="space-y-6">
              <button
                onClick={handleBackToList}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <ChevronLeft className="w-4 h-4" />
                Terug naar lijst
              </button>

              {/* Peer Feedback */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Peerfeedback</h3>
                {selectedFeedback.length === 0 ? (
                  <p className="text-gray-500 text-sm">Geen peerfeedback beschikbaar</p>
                ) : (
                  <div className="space-y-4">
                    {selectedFeedback.map((item, idx) => (
                      <div key={idx} className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-gray-900">
                            {item.feedback_type === "self" ? "Zelf" : `Van: ${item.from_student_name || "Anoniem"}`}
                          </div>
                          <div className="flex gap-2">
                            {item.score_O && (
                              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                O: {item.score_O.toFixed(1)}
                              </span>
                            )}
                            {item.score_M && (
                              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                                M: {item.score_M.toFixed(1)}
                              </span>
                            )}
                            {item.score_Z && (
                              <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded">
                                Z: {item.score_Z.toFixed(1)}
                              </span>
                            )}
                            {item.score_A && (
                              <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                                A: {item.score_A.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                        {item.combined_feedback && (
                          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                            {item.combined_feedback}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Teacher Feedback */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Docentfeedback</h3>
                {!selectedTeacherFeedback ? (
                  <p className="text-gray-500 text-sm">Geen docentfeedback beschikbaar</p>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex gap-2 flex-wrap">
                      {selectedTeacherFeedback.organiseren_score && (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          O: {selectedTeacherFeedback.organiseren_score}
                        </span>
                      )}
                      {selectedTeacherFeedback.meedoen_score && (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                          M: {selectedTeacherFeedback.meedoen_score}
                        </span>
                      )}
                      {selectedTeacherFeedback.zelfvertrouwen_score && (
                        <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded">
                          Z: {selectedTeacherFeedback.zelfvertrouwen_score}
                        </span>
                      )}
                      {selectedTeacherFeedback.autonomie_score && (
                        <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                          A: {selectedTeacherFeedback.autonomie_score}
                        </span>
                      )}
                    </div>
                    {selectedTeacherFeedback.teacher_comment && (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                        {selectedTeacherFeedback.teacher_comment}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* List View */
            <div className="space-y-6">
              {/* Peer Evaluations Table */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Peerevaluaties</h3>
                {peerEvalList.length === 0 ? (
                  <p className="text-gray-500 text-sm">Geen peerevaluaties gevonden</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                            Project
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                            Datum
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">
                            Feedback
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {peerEvalList.map((item) => (
                          <tr
                            key={item.evaluation_id}
                            onClick={() => setSelectedEvaluationId(item.evaluation_id)}
                            className="hover:bg-gray-50 cursor-pointer"
                          >
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {item.project_name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {formatDate(item.date)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 text-right">
                              {item.count} {item.count === 1 ? "item" : "items"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Teacher Feedback Table */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Docentfeedback</h3>
                {teacherFeedback.length === 0 ? (
                  <p className="text-gray-500 text-sm">Geen docentfeedback gevonden</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                            Project
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                            Datum
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">
                            Notitie
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {teacherFeedback.map((item) => (
                          <tr
                            key={item.id}
                            onClick={() => setSelectedEvaluationId(item.evaluation_id)}
                            className="hover:bg-gray-50 cursor-pointer"
                          >
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {item.project_name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {formatDate(item.date)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 text-right">
                              {item.teacher_comment ? "Ja" : "Nee"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
