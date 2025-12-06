"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loading, ErrorMessage } from "@/components";
import { EvaluationCard, DetailModal } from "@/components/student/peer-results";
import { FeedbackSummary } from "@/components/student";
import { peerFeedbackResultsService, evaluationService, studentService } from "@/services";
import api from "@/lib/api";
import type { EvaluationResult, DashboardResponse, OmzaKey } from "@/dtos";
import { OMZA_LABELS, OMZA_KEYS } from "@/components/student/peer-results/helpers";

export default function OverzichtPage() {
  const params = useParams();
  const router = useRouter();
  const evaluationId = Number(params.evaluationId);

  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Load evaluation peer feedback result
  useEffect(() => {
    if (!evaluationId) return;

    setLoading(true);
    setError(null);

    // Try to get data from peer-results endpoint first
    peerFeedbackResultsService
      .getMyPeerResultForEvaluation(evaluationId)
      .then(async (data) => {
        if (data) {
          // Found in peer-results endpoint
          setEvaluation(data);
          // Extract student ID from allocations for FeedbackSummary
          try {
            const allocs = await studentService.getAllocations(evaluationId);
            const selfAlloc = allocs.find((a) => a.is_self);
            if (selfAlloc?.reviewee_id) {
              setStudentId(selfAlloc.reviewee_id);
            }
          } catch {
            // Silent fail for student ID
          }
        } else {
          // Not found in peer-results, try to build from dashboard data
          // This handles evaluations in draft status or not yet in peer-results
          try {
            const [evalMeta, dashData, allocs] = await Promise.all([
              evaluationService.getEvaluation(evaluationId),
              api.get<DashboardResponse>(`/dashboard/evaluation/${evaluationId}`, {
                params: { include_breakdown: true },
              }),
              studentService.getAllocations(evaluationId),
            ]);

            // Build minimal EvaluationResult from dashboard data
            const selfAlloc = allocs.find((a) => a.is_self);
            const myRow = dashData.data.items.find((r) => r.user_id === selfAlloc?.reviewee_id);

            // Set student ID for FeedbackSummary
            if (selfAlloc?.reviewee_id) {
              setStudentId(selfAlloc.reviewee_id);
            }

            if (myRow && dashData.data.criteria.length > 0) {
              // Extract OMZA categories from criteria in correct order
              const categoriesInData = Array.from(
                new Set(
                  dashData.data.criteria
                    .map((c) => c.category)
                    .filter((c): c is string => !!c)
                )
              );

              // Build OMZA averages in correct OMZA order
              const omzaAverages = OMZA_KEYS
                .filter((key) => {
                  const category = OMZA_LABELS[key];
                  return categoriesInData.some((c) => c.toLowerCase() === category.toLowerCase());
                })
                .map((key) => {
                  const category = OMZA_LABELS[key];
                  const catAvg = myRow.category_averages?.find(
                    (ca) => ca.category.toLowerCase() === category.toLowerCase()
                  );
                  return {
                    key: key.charAt(0).toUpperCase(),
                    label: category,
                    value: catAvg?.peer_avg || 0,
                    delta: 0, // No historical data available
                  };
                });

              const fallbackEvaluation: EvaluationResult = {
                id: String(evaluationId),
                title: evalMeta.title,
                course: evalMeta.cluster || "",
                deadlineISO: evalMeta.deadlines?.review || evalMeta.settings?.deadlines?.review,
                status: evalMeta.status,
                peers: [], // No detailed peer data available in dashboard
                // Don't show GCF in fallback - it would be calculated, not official from Grade table
                gcfScore: undefined,
                teamContributionFactor: undefined,
                omzaAverages: omzaAverages,
                aiSummary: undefined,
                teacherComments: undefined,
                teacherGrade: undefined,
              };

              setEvaluation(fallbackEvaluation);
            } else {
              setError("Nog geen data beschikbaar voor deze evaluatie");
            }
          } catch (err) {
            setError("Kon evaluatiegegevens niet laden");
          }
        }
      })
      .catch((e) => {
        setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
      })
      .finally(() => setLoading(false));
  }, [evaluationId]);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!evaluation) return <ErrorMessage message="Evaluatie niet gevonden" />;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b">
        <header className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ← Terug
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Evaluatie Overzicht</h1>
              <p className="text-sm text-gray-500">{evaluation.title}</p>
            </div>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Evaluation Card - Same as in student/results */}
        <EvaluationCard 
          data={evaluation} 
          onOpen={() => setDetailOpen(true)} 
        />

        {/* AI Feedback Summary */}
        {studentId && (
          <FeedbackSummary
            evaluationId={evaluationId}
            studentId={studentId}
          />
        )}
      </main>

      {/* Detail Modal - Same as in student/results */}
      <DetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        evaluation={evaluation}
      />
    </div>
  );
}
