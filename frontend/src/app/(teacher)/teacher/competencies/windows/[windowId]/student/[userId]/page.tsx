"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { competencyService } from "@/services";
import type { StudentCompetencyOverview } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import { CompetencyRadarChart } from "@/components/student/competency/CompetencyRadarChart";
import Link from "next/link";

export default function StudentDetailPage() {
  const params = useParams();
  const windowId = Number(params.windowId);
  const userId = Number(params.userId);

  const [overview, setOverview] = useState<StudentCompetencyOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await competencyService.getStudentWindowOverview(windowId, userId);
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [windowId, userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate category averages (must be called before early returns)
  const categoryAverages = useMemo(() => {
    if (!overview) return [];
    
    const categoryScores: Record<string, { total: number; count: number }> = {};
    
    overview.scores.forEach((score) => {
      const category = score.category_name || score.category || "Overig";
      if (!categoryScores[category]) {
        categoryScores[category] = { total: 0, count: 0 };
      }
      
      if (score.final_score !== null && score.final_score !== undefined) {
        categoryScores[category].total += score.final_score;
        categoryScores[category].count += 1;
      }
    });

    return Object.entries(categoryScores).map(([category, data]) => ({
      category,
      average: data.count > 0 ? data.total / data.count : 0,
      count: data.count,
    }));
  }, [overview]);

  // Prepare radar chart data
  const radarData = useMemo(() => {
    return categoryAverages.map((item) => ({
      name: item.category,
      value: item.average,
    }));
  }, [categoryAverages]);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!overview) return <ErrorMessage message="Student data not found" />;

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/teacher/competencies/windows/${windowId}`}
          className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block"
        >
          ← Terug naar Heatmap
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          {overview.user_name} - Competentieoverzicht
        </h1>
        <p className="text-slate-600">
          Gedetailleerd overzicht van competentiescores, leerdoelen en reflecties
        </p>
      </div>

      {/* Radar diagram and Category Scores */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Radardiagram - Gemiddelden per categorie</h2>
        <div className="flex flex-col md:flex-row gap-8">
          {/* Radar chart */}
          <div className="flex-1 min-h-[250px] flex items-center justify-center">
            {radarData.length > 0 ? (
              <CompetencyRadarChart items={radarData} size={250} maxValue={5} />
            ) : (
              <div className="text-center text-slate-500">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
                  />
                </svg>
                <p className="text-sm font-medium">Radardiagram</p>
                <p className="text-xs mt-1">Geen data beschikbaar</p>
              </div>
            )}
          </div>
          
          {/* Category scores */}
          <div className="flex-1">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Scores per categorie</h3>
            <div className="space-y-3">
              {categoryAverages
                .sort((a, b) => b.average - a.average)
                .map((item) => (
                  <div key={item.category} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-slate-700 truncate">
                      {item.category}
                    </span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          item.average >= 4
                            ? "bg-green-500"
                            : item.average >= 3
                            ? "bg-blue-500"
                            : "bg-orange-500"
                        }`}
                        style={{ width: `${(item.average / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right text-slate-900">
                      {item.average.toFixed(1)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Competency Scores Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">Scores per competentie</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide">
                  Categorie
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide">
                  Competentie
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">
                  Self
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">
                  Extern
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">
                  Gemiddelde
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {overview.scores
                .sort((a, b) => {
                  // Sort by category first, then by competency name
                  const catA = a.category_name || "Overig";
                  const catB = b.category_name || "Overig";
                  if (catA !== catB) return catA.localeCompare(catB);
                  return a.competency_name.localeCompare(b.competency_name);
                })
                .map((score) => (
                  <tr key={score.competency_id} className="bg-white hover:bg-slate-50">
                    <td className="px-5 py-3 text-sm text-slate-600">
                      {score.category_name || "Overig"}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-800 font-medium">
                      {score.competency_name}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {score.self_score !== null && score.self_score !== undefined ? (
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-md text-sm font-medium ${
                            score.self_score >= 4
                              ? "bg-green-100 text-green-700"
                              : score.self_score >= 3
                              ? "bg-blue-100 text-blue-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {score.self_score.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {score.external_score !== null && score.external_score !== undefined ? (
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-md text-sm font-medium ${
                            score.external_score >= 4
                              ? "bg-green-100 text-green-700"
                              : score.external_score >= 3
                              ? "bg-blue-100 text-blue-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {score.external_score.toFixed(1)}
                          {score.external_count > 0 && (
                            <span className="ml-1 text-xs">({score.external_count})</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {score.final_score !== null && score.final_score !== undefined ? (
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-md text-sm font-medium ${
                            score.final_score >= 4
                              ? "bg-green-100 text-green-700"
                              : score.final_score >= 3
                              ? "bg-blue-100 text-blue-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {score.final_score.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Goals */}
      {overview.goals.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Leerdoelen</h2>
          <div className="space-y-3">
            {overview.goals.map((goal) => (
              <div
                key={goal.id}
                className="p-4 bg-purple-50 border border-purple-200 rounded-lg"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 mb-2">{goal.goal_text}</h3>
                    {goal.success_criteria && (
                      <p className="text-sm text-slate-600 mb-2">
                        <span className="font-medium">Succescriterium:</span>{" "}
                        {goal.success_criteria}
                      </p>
                    )}
                    {goal.submitted_at && (
                      <p className="text-xs text-slate-500">
                        Ingediend op:{" "}
                        {new Date(goal.submitted_at).toLocaleDateString("nl-NL")}
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded text-xs font-medium whitespace-nowrap ${
                      goal.status === "achieved"
                        ? "bg-green-100 text-green-700"
                        : goal.status === "not_achieved"
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {goal.status === "achieved"
                      ? "Behaald"
                      : goal.status === "not_achieved"
                      ? "Niet behaald"
                      : "Bezig"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reflection */}
      {overview.reflection && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Reflectie</h2>
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-3">
            <div>
              <p className="text-slate-700 whitespace-pre-wrap">
                {overview.reflection.text}
              </p>
            </div>
            
            {overview.reflection.goal_achieved !== null && (
              <div className="pt-3 border-t border-indigo-200">
                <span className="text-sm text-slate-600">Doel behaald: </span>
                <span
                  className={`text-sm font-semibold ${
                    overview.reflection.goal_achieved
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {overview.reflection.goal_achieved ? "Ja" : "Nee"}
                </span>
              </div>
            )}
            
            {overview.reflection.evidence && (
              <div className="pt-3 border-t border-indigo-200">
                <p className="text-sm text-slate-600 mb-1">
                  <span className="font-medium">Bewijs/Voorbeelden:</span>
                </p>
                <p className="text-sm text-slate-700">
                  {overview.reflection.evidence}
                </p>
              </div>
            )}
            
            {overview.reflection.submitted_at && (
              <div className="pt-3 border-t border-indigo-200">
                <p className="text-xs text-slate-500">
                  Ingediend op:{" "}
                  {new Date(overview.reflection.submitted_at).toLocaleDateString(
                    "nl-NL"
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* No data message */}
      {overview.scores.every((s) => s.self_score === null && s.external_score === null) &&
        overview.goals.length === 0 &&
        !overview.reflection && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <p className="text-slate-500">
              Deze leerling heeft nog geen competentiedata ingevoerd voor dit venster.
            </p>
          </div>
        )}
    </main>
  );
}
