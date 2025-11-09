"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { studentService } from "@/services";
import { Loading, ErrorMessage } from "@/components";
import type { MyAllocation } from "@/dtos";

export default function EvaluationLandingPage() {
  const params = useParams();
  const router = useRouter();
  const evaluationId = Number(params.evaluationId);

  const [allocs, setAllocs] = useState<MyAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;

  const selfAlloc = allocs.find((a) => a.is_self);
  const peerAllocs = allocs.filter((a) => !a.is_self);
  
  const selfCompleted = selfAlloc?.completed ?? false;
  const peersCompleted = peerAllocs.filter((a) => a.completed).length;

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Evaluatie #{evaluationId}</h1>
          <button
            onClick={() => router.push("/student")}
            className="px-4 py-2 rounded-lg border hover:bg-gray-50 transition-colors"
          >
            Terug naar Dashboard
          </button>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid gap-6">
        {/* Evaluatie Invullen Card */}
        <div className="bg-white rounded-xl border p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold mb-3">Evaluatie Invullen</h2>
              <p className="text-gray-600 mb-4">
                Vul je zelfbeoordeling en peer-reviews in.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className={selfCompleted ? "text-green-600" : "text-gray-500"}>
                    {selfCompleted ? "✓" : "○"}
                  </span>
                  <span>Zelfbeoordeling {selfCompleted ? "voltooid" : "nog niet voltooid"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={peersCompleted === peerAllocs.length && peerAllocs.length > 0 ? "text-green-600" : "text-gray-500"}>
                    {peersCompleted === peerAllocs.length && peerAllocs.length > 0 ? "✓" : "○"}
                  </span>
                  <span>
                    Peer-reviews: {peersCompleted}/{peerAllocs.length} voltooid
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push(`/student/${evaluationId}?step=1`)}
              className="px-6 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap font-medium"
            >
              {selfCompleted && peersCompleted === peerAllocs.length ? "Bekijk" : "Invullen"}
            </button>
          </div>
        </div>

        {/* Overzicht Card */}
        <div className="bg-white rounded-xl border p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold mb-3">Overzicht</h2>
              <p className="text-gray-600">
                Bekijk je scores en feedback samenvatting.
              </p>
            </div>
            <button
              onClick={() => router.push(`/student/evaluation/${evaluationId}/overzicht`)}
              className="px-6 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap font-medium"
            >
              Bekijk
            </button>
          </div>
        </div>

        {/* Reflectie Card */}
        <div className="bg-white rounded-xl border p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold mb-3">Reflectie Schrijven</h2>
              <p className="text-gray-600">
                Schrijf je reflectie op basis van de ontvangen feedback.
              </p>
            </div>
            <button
              onClick={() => router.push(`/student/evaluation/${evaluationId}/reflectie`)}
              className="px-6 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap font-medium"
            >
              Schrijven
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
