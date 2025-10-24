"use client";

import Link from "next/link";
import { useNumericEvalId } from "@/utils";
import { useDashboardData } from "@/hooks";
import { Tile, Loading, ErrorMessage } from "@/components";

export default function EvaluationDashboardPage() {
  const evalIdNum = useNumericEvalId();
  const { kpis, flags, loading, error } = useDashboardData(evalIdNum);

  const evalId = evalIdNum?.toString() ?? "";

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Evaluatie — Dashboard</h1>
        <div className="flex gap-2">
          {evalIdNum != null ? (
            <>
              <Link
                href={`/teacher/evaluations/${evalId}/grades`}
                className="px-3 py-2 rounded-xl border"
              >
                Cijfers
              </Link>
              <Link
                href={`/teacher/evaluations/${evalId}/feedback`}
                className="px-3 py-2 rounded-xl border"
              >
                Feedback
              </Link>
              <Link
                href={`/teacher/evaluations/${evalId}/reflections`}
                className="px-3 py-2 rounded-xl border"
              >
                Reflecties
              </Link>
              <Link
                href={`/teacher/evaluations/${evalId}/settings`}
                className="px-3 py-2 rounded-xl border"
              >
                Instellingen
              </Link>
            </>
          ) : (
            <>
              <span className="px-3 py-2 rounded-xl border opacity-60 cursor-not-allowed">
                Cijfers
              </span>
              <span className="px-3 py-2 rounded-xl border opacity-60 cursor-not-allowed">
                Feedback
              </span>
              <span className="px-3 py-2 rounded-xl border opacity-60 cursor-not-allowed">
                Reflecties
              </span>
              <span className="px-3 py-2 rounded-xl border opacity-60 cursor-not-allowed">
                Instellingen
              </span>
            </>
          )}
        </div>
      </header>

      {loading && <Loading />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && (
        <>
          {/* KPI tiles */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Tile label="Self-reviews" value={kpis?.self_count ?? 0} />
            <Tile label="Peer-reviews" value={kpis?.peer_count ?? 0} />
            <Tile label="Reflecties" value={kpis?.reflection_count ?? 0} />
            <Tile label="Totaal studenten" value={kpis?.total_students ?? 0} />
          </section>

          {/* Flags */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Signalen / Flags</h2>
            {!flags || flags.length === 0 ? (
              <div className="text-gray-500">Geen signalen.</div>
            ) : (
              <ul className="space-y-2">
                {flags.map((f, idx) => (
                  <li key={idx} className="p-3 border rounded-xl">
                    <div className="text-sm text-gray-500">{f.type}</div>
                    <div className="font-medium">{f.message}</div>
                    {f.student && (
                      <div className="text-sm text-gray-600">
                        Student: {f.student}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {evalIdNum == null && (
        <p className="text-sm text-gray-500">
          Geen geldige evaluatie geselecteerd. Open het dashboard via een
          bestaande evaluatie.
        </p>
      )}
    </main>
  );
}
