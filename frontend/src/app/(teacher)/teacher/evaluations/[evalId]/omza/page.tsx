"use client";

import Link from "next/link";
import { useNumericEvalId } from "@/utils";
import { Loading, ErrorMessage } from "@/components";
import { useState, useEffect } from "react";
import { dashboardService } from "@/services/dashboard.service";
import { DashboardResponse, CategoryAverage } from "@/dtos/dashboard.dto";

export default function OMZAOverviewPage() {
  const evalIdNum = useNumericEvalId();
  const evalId = evalIdNum?.toString() ?? "";

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!evalIdNum) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    dashboardService
      .getDashboard(evalIdNum)
      .then((data) => {
        setDashboard(data);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || err?.message || "Laden mislukt");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [evalIdNum]);

  // Extract unique categories from criteria
  const categories = dashboard
    ? Array.from(new Set(dashboard.criteria.map((c) => c.category).filter((c) => c)))
    : [];

  // Calculate overall averages per category
  const calculateCategoryAverages = () => {
    if (!dashboard || !dashboard.items.length) return {};

    const result: Record<string, { peer: number; self: number | null }> = {};

    categories.forEach((category) => {
      const peerAvgs: number[] = [];
      const selfAvgs: number[] = [];

      dashboard.items.forEach((item) => {
        const catAvg = item.category_averages?.find((ca) => ca.category === category);
        if (catAvg) {
          if (catAvg.peer_avg) peerAvgs.push(catAvg.peer_avg);
          if (catAvg.self_avg) selfAvgs.push(catAvg.self_avg);
        }
      });

      const peerMean = peerAvgs.length > 0 ? peerAvgs.reduce((a, b) => a + b, 0) / peerAvgs.length : 0;
      const selfMean = selfAvgs.length > 0 ? selfAvgs.reduce((a, b) => a + b, 0) / selfAvgs.length : null;

      result[category] = {
        peer: Math.round(peerMean * 100) / 100,
        self: selfMean !== null ? Math.round(selfMean * 100) / 100 : null,
      };
    });

    return result;
  };

  const categoryAverages = calculateCategoryAverages();

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">OMZA-overzicht</h1>
        <div className="flex gap-2">
          <Link
            href={`/teacher/evaluations/${evalId}/dashboard`}
            className="px-3 py-2 rounded-xl border"
          >
            Dashboard
          </Link>
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
        </div>
      </header>

      {loading && <Loading />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && dashboard && (
        <>
          {categories.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-yellow-900 mb-2">
                Geen categorieën beschikbaar
              </h3>
              <p className="text-sm text-yellow-800">
                Deze rubric heeft geen categorieën gedefinieerd. Voeg categorieën toe aan de rubric criteria om het OMZA-overzicht te gebruiken.
              </p>
            </div>
          ) : (
            <>
              {/* Category averages summary */}
              <section className="bg-white border rounded-xl p-6 space-y-4">
                <h2 className="text-xl font-semibold">Gemiddelden per categorie</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {categories.map((category) => (
                    <div key={category} className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-gray-600 mb-2">{category}</h3>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Peer:</span>
                          <span className="text-lg font-bold text-gray-900">
                            {categoryAverages[category]?.peer.toFixed(2) || "0.00"}
                          </span>
                        </div>
                        {categoryAverages[category]?.self !== null && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">Zelf:</span>
                            <span className="text-lg font-bold text-blue-600">
                              {categoryAverages[category]?.self?.toFixed(2) || "0.00"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Student table */}
              <section className="bg-white border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10">
                          Leerling
                        </th>
                        {categories.map((category) => (
                          <th
                            key={category}
                            className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase"
                          >
                            {category}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Gemiddelde
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {dashboard.items.map((item) => (
                        <tr key={item.user_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium sticky left-0 bg-white">
                            {item.user_name}
                          </td>
                          {categories.map((category) => {
                            const catAvg = item.category_averages?.find(
                              (ca) => ca.category === category
                            );
                            return (
                              <td
                                key={category}
                                className="px-4 py-3 text-center text-sm"
                              >
                                {catAvg ? (
                                  <div className="space-y-1">
                                    <div className="font-medium text-gray-900">
                                      {catAvg.peer_avg.toFixed(2)}
                                    </div>
                                    {catAvg.self_avg !== null && (
                                      <div className="text-xs text-blue-600">
                                        ({catAvg.self_avg.toFixed(2)})
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  "-"
                                )}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-center text-sm font-bold">
                            {item.peer_avg_overall.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t font-medium">
                      <tr>
                        <td className="px-4 py-3 text-sm sticky left-0 bg-gray-50">
                          Gemiddelde per categorie
                        </td>
                        {categories.map((category) => (
                          <td
                            key={category}
                            className="px-4 py-3 text-center text-sm"
                          >
                            <div className="space-y-1">
                              <div className="font-bold text-gray-900">
                                {categoryAverages[category]?.peer.toFixed(2) || "0.00"}
                              </div>
                              {categoryAverages[category]?.self !== null && (
                                <div className="text-xs text-blue-600">
                                  ({categoryAverages[category]?.self?.toFixed(2) || "0.00"})
                                </div>
                              )}
                            </div>
                          </td>
                        ))}
                        <td className="px-4 py-3 text-center text-sm font-bold">
                          {dashboard.items.length > 0
                            ? (
                                dashboard.items.reduce(
                                  (sum, item) => sum + item.peer_avg_overall,
                                  0
                                ) / dashboard.items.length
                              ).toFixed(2)
                            : "0.00"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>

              {/* Legend */}
              <section className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Leeswijzer:</strong> Voor elke categorie worden gemiddelden getoond. Het getal is het peer-gemiddelde, en tussen haakjes (indien beschikbaar) staat het zelf-beoordelingsgemiddelde.
                </p>
              </section>
            </>
          )}
        </>
      )}

      {evalIdNum == null && (
        <p className="text-sm text-gray-500">
          Geen geldige evaluatie geselecteerd.
        </p>
      )}
    </main>
  );
}
