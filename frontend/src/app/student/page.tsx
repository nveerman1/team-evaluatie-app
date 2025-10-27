"use client";

import { useStudentDashboard } from "@/hooks";
import { EvaluationCard } from "@/components/student";
import { Loading, ErrorMessage } from "@/components";
import Link from "next/link";

export default function StudentDashboard() {
  const { dashboard, loading, error } = useStudentDashboard();

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!dashboard) return <ErrorMessage message="Kon dashboard niet laden" />;

  const openEvaluations = dashboard.openEvaluations;

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Mijn Dashboard</h1>
        <p className="text-gray-600">
          Overzicht van jouw evaluaties en resultaten
        </p>
      </div>

      {/* Self-Assessment Required Message */}
      {dashboard.needsSelfAssessment && (
        <div className="p-6 border rounded-xl bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <div className="text-amber-600 text-xl">⚠️</div>
            <div>
              <h3 className="text-lg font-semibold text-amber-900 mb-1">
                Zelfbeoordeling Vereist
              </h3>
              <p className="text-amber-700">
                Voltooi eerst je zelfbeoordeling voordat je peers kunt beoordelen.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Notifications / Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-4 border rounded-xl bg-blue-50">
          <div className="text-sm text-blue-700 font-medium">
            Open Evaluaties
          </div>
          <div className="text-3xl font-bold text-blue-900">
            {openEvaluations.length}
          </div>
        </div>

        {dashboard.pendingReviews > 0 && (
          <div className="p-4 border rounded-xl bg-amber-50">
            <div className="text-sm text-amber-700 font-medium">
              Peer-reviews Te Doen
            </div>
            <div className="text-3xl font-bold text-amber-900">
              {dashboard.pendingReviews}
            </div>
          </div>
        )}

        {dashboard.pendingReflections > 0 && (
          <div className="p-4 border rounded-xl bg-purple-50">
            <div className="text-sm text-purple-700 font-medium">
              Reflecties Open
            </div>
            <div className="text-3xl font-bold text-purple-900">
              {dashboard.pendingReflections}
            </div>
          </div>
        )}

        <div className="p-4 border rounded-xl bg-green-50">
          <div className="text-sm text-green-700 font-medium">
            Voltooid
          </div>
          <div className="text-3xl font-bold text-green-900">
            {dashboard.completedEvaluations}
          </div>
        </div>
      </div>

      {/* Open Evaluations Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Open Evaluaties</h2>
          {openEvaluations.length > 0 && (
            <span className="text-sm text-gray-500">
              {openEvaluations.length} evaluatie
              {openEvaluations.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {openEvaluations.length === 0 ? (
          <div className="p-8 border rounded-xl bg-gray-50 text-center">
            <p className="text-gray-500">
              Geen open evaluaties op dit moment.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {openEvaluations.map((evaluation) => (
              <EvaluationCard key={evaluation.id} evaluation={evaluation} />
            ))}
          </div>
        )}
      </section>

      {/* Results Section */}
      {dashboard.hasAnyEvaluations && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Resultaten</h2>
            <Link
              href="/student/results"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Bekijk alle resultaten →
            </Link>
          </div>

          <div className="p-6 border rounded-xl bg-gray-50">
            {dashboard.completedEvaluations > 0 ? (
              <p className="text-gray-600">
                Je hebt {dashboard.completedEvaluations} voltooide evaluatie
                {dashboard.completedEvaluations !== 1 ? "s" : ""}. Klik op "Bekijk
                alle resultaten" om je cijfers en feedback te zien.
              </p>
            ) : (
              <p className="text-gray-600">
                Je hebt evaluaties toegewezen, maar er zijn nog geen voltooide
                resultaten beschikbaar. Resultaten worden zichtbaar zodra evaluaties
                zijn afgesloten.
              </p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
