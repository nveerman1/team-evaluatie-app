"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useNumericEvalId } from "@/lib/id";
import { Loading, ErrorMessage } from "@/components";
import { FeedbackSummary } from "@/components/student";
import { studentService } from "@/services";
import api from "@/lib/api";
import type { MyAllocation, DashboardResponse } from "@/dtos";

export default function OverzichtPage() {
  const params = useParams();
  const router = useRouter();
  const evaluationId = Number(params.evaluationId);

  const [allocs, setAllocs] = useState<MyAllocation[]>([]);
  const [dash, setDash] = useState<DashboardResponse | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingDash, setLoadingDash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load allocations
  useEffect(() => {
    if (!evaluationId) return;

    setLoading(true);
    studentService
      .getAllocations(evaluationId)
      .then((data) => setAllocs(data))
      .catch((e) => {
        setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
      })
      .finally(() => setLoading(false));
  }, [evaluationId]);

  // Load dashboard data
  useEffect(() => {
    if (!evaluationId) return;

    setLoadingDash(true);
    api
      .get<DashboardResponse>(`/dashboard/evaluation/${evaluationId}`, {
        params: { include_breakdown: true },
      })
      .then((r) => setDash(r.data))
      .catch(() => {
        // Silent fail
      })
      .finally(() => setLoadingDash(false));
  }, [evaluationId]);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;

  const selfAlloc = allocs.find((a) => a.is_self);

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Overzicht</h1>
          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/student/evaluation/${evaluationId}`)}
              className="px-4 py-2 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              Terug
            </button>
          </div>
        </div>
        <p className="text-gray-600">
          Hier zie je een overzicht van je scores en een samenvatting van de
          ontvangen peer-feedback.
        </p>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border p-6">
        {loadingDash && <Loading />}

        {!loadingDash && dash && (
          <div className="space-y-6">
            {/* Scores Overview */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="text-lg font-semibold mb-4">Jouw scores</h3>

              {(() => {
                const selfUserId = selfAlloc?.reviewee_id;
                const myRow = dash.items.find((r) => r.user_id === selfUserId);
                if (!myRow) {
                  return (
                    <p className="text-sm text-gray-500">
                      Nog geen scores beschikbaar.
                    </p>
                  );
                }

                // Extract categories from criteria
                const categories = Array.from(
                  new Set(
                    dash.criteria
                      .map((c) => c.category)
                      .filter((c): c is string => !!c)
                  )
                );

                return (
                  <div className="space-y-6">
                    {/* GCF and SPR */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="text-sm text-blue-600 font-medium mb-1">
                          GCF (Group Contribution Factor)
                        </div>
                        <div className="flex items-baseline gap-2">
                          <div className="text-3xl font-bold text-blue-900">
                            {myRow.gcf.toFixed(2)}
                          </div>
                          <div className="text-sm text-blue-600">
                            Peer: {myRow.peer_avg_overall.toFixed(2)}
                          </div>
                        </div>
                        <p className="text-xs text-blue-700 mt-2">
                          Je bijdrage ten opzichte van teamgemiddelde
                        </p>
                      </div>

                      <div className="bg-green-50 rounded-lg p-4">
                        <div className="text-sm text-green-600 font-medium mb-1">
                          SPR (Self-Peer Ratio)
                        </div>
                        <div className="flex items-baseline gap-2">
                          <div className="text-3xl font-bold text-green-900">
                            {myRow.spr.toFixed(2)}
                          </div>
                          <div className="text-sm text-green-600">
                            Self: {myRow.self_avg_overall?.toFixed(2) ?? "−"}
                          </div>
                        </div>
                        <p className="text-xs text-green-700 mt-2">
                          Verhouding zelf- vs peer-beoordeling
                        </p>
                      </div>
                    </div>

                    {/* OMZA Scores (Category breakdown) */}
                    {categories.length > 0 && myRow.category_averages && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">
                          OMZA Scores per Categorie
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {categories.map((category) => {
                            const catAvg = myRow.category_averages?.find(
                              (ca) => ca.category === category
                            );
                            if (!catAvg) return null;

                            return (
                              <div
                                key={category}
                                className="bg-gray-50 border border-gray-200 rounded-lg p-3"
                              >
                                <div className="text-xs text-gray-600 font-medium mb-1">
                                  {category}
                                </div>
                                <div className="flex items-baseline gap-3">
                                  <div className="text-lg font-bold text-gray-900">
                                    Peer: {catAvg.peer_avg.toFixed(2)}
                                  </div>
                                  {catAvg.self_avg !== null && (
                                    <div className="text-sm text-blue-600">
                                      Self: {catAvg.self_avg.toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* AI Feedback Summary */}
            {(() => {
              const selfUserId = selfAlloc?.reviewee_id;

              if (selfUserId) {
                return (
                  <FeedbackSummary
                    evaluationId={evaluationId}
                    studentId={selfUserId}
                  />
                );
              }
              return null;
            })()}
          </div>
        )}

        {!loadingDash && !dash && (
          <div className="text-center py-8 text-gray-500">
            Nog geen overzicht beschikbaar.
          </div>
        )}
      </div>
    </main>
  );
}
