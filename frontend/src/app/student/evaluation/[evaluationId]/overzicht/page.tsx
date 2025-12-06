"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loading, ErrorMessage } from "@/components";
import { peerFeedbackResultsService } from "@/services";
import type { EvaluationResult } from "@/dtos";
import { EvaluationCard } from "@/components/student/peer-results";

export default function OverzichtPage() {
  const params = useParams();
  const router = useRouter();
  const evaluationId = Number(params.evaluationId);

  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load evaluation peer feedback result
  useEffect(() => {
    if (!evaluationId) return;

    setLoading(true);
    setError(null);
    peerFeedbackResultsService
      .getMyPeerResultForEvaluation(evaluationId)
      .then((data) => {
        if (!data) {
          setError("Evaluatie niet gevonden");
        } else {
          setEvaluation(data);
        }
      })
      .catch((e) => {
        setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
      })
      .finally(() => setLoading(false));
  }, [evaluationId]);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!evaluation) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Evaluatie niet gevonden</p>
          <button
            onClick={() => router.push("/student")}
            className="mt-4 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Terug naar dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
                Overzicht
              </h1>
              <p className="text-gray-600 mt-1 text-sm">
                Hier zie je een overzicht van je scores en een samenvatting van de
                ontvangen peer-feedback.
              </p>
            </div>
            <button
              onClick={() => router.push("/student")}
              className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Terug
            </button>
          </div>
        </header>
      </div>

      {/* Main Content - Using EvaluationCard component */}
      <main className="max-w-6xl mx-auto px-6 py-6">
        <EvaluationCard 
          data={evaluation} 
          onOpen={() => {
            // Do nothing - we're already on the detail page
            // Or optionally, could scroll to a specific section
          }} 
        />
      </main>
    </div>
  );
}
