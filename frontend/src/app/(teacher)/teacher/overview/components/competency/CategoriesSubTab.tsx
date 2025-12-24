"use client";

import Link from "next/link";
import { useCompetencyOverview } from "@/hooks/useCompetencyOverview";
import { Loading, ErrorMessage } from "@/components";
import type { CompetencyOverviewFilters } from "@/dtos/competency-monitor.dto";

interface CategoriesSubTabProps {
  filters: CompetencyOverviewFilters;
}

export function CategoriesSubTab({ filters }: CategoriesSubTabProps) {
  const { data: overviewData, loading: overviewLoading } = useCompetencyOverview(filters);

  if (overviewLoading) return <Loading />;
  if (!overviewData) return <ErrorMessage message="Geen data beschikbaar" />;

  const categories = overviewData.categorySummaries;

  const getTrendColor = (delta: number | null): string => {
    if (delta === null || delta === 0) return "text-gray-500";
    if (delta > 0) return "text-green-600";
    return "text-red-600";
  };

  const getTrendArrow = (delta: number | null) => {
    if (delta === null || delta === 0) return "→";
    if (delta > 0) return "↑";
    return "↓";
  };

  return (
    <div className="space-y-6">
      {categories.length > 0 ? (
        <div className="space-y-8">
          {categories.map((category) => (
            <div key={category.id} className="space-y-4">
              {/* Category Summary Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">{category.name}</h3>
                    <p className="text-slate-500 mt-1">Samenvatting voor de geselecteerde klas(sen)</p>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <div className="bg-slate-50 rounded-xl px-4 py-3 text-center min-w-[100px]">
                      <p className="text-xs text-slate-500">Gemiddelde</p>
                      <p className="text-2xl font-bold text-slate-900">{category.averageScore.toFixed(1)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl px-4 py-3 text-center min-w-[100px]">
                      <p className="text-xs text-slate-500">Trend</p>
                      <p className={`text-2xl font-bold ${getTrendColor(category.trendDelta)}`}>
                        {category.trendDelta !== null 
                          ? (category.trendDelta > 0 ? "+" : "") + category.trendDelta.toFixed(1)
                          : "–"
                        }
                        {" "}{getTrendArrow(category.trendDelta)}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl px-4 py-3 text-center min-w-[100px]">
                      <p className="text-xs text-slate-500">Studenten</p>
                      <p className="text-2xl font-bold text-slate-900">
                        <span className="text-green-600">{category.numStudentsUp}</span>
                        {" / "}
                        <span className="text-red-600">{category.numStudentsDown}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Score Distribution for this category */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Scoreverdeling - {category.name}</h4>
                <div className="flex items-end gap-4 h-48">
                  {[1, 2, 3, 4, 5].map((score) => {
                    // Calculate count for this score from heatmap data
                    const count = overviewData.heatmapRows.reduce((total, row) => {
                      const categoryScores = Object.entries(row.scores)
                        .filter(([_, s]) => s !== null && Math.round(s) === score)
                        .length;
                      return total + categoryScores;
                    }, 0);
                    
                    const maxCount = Math.max(...[1, 2, 3, 4, 5].map(s => {
                      return overviewData.heatmapRows.reduce((total, row) => {
                        const categoryScores = Object.entries(row.scores)
                          .filter(([_, val]) => val !== null && Math.round(val) === s)
                          .length;
                        return total + categoryScores;
                      }, 0);
                    }), 1);
                    
                    const heightPercent = (count / maxCount) * 100;
                    return (
                      <div key={score} className="flex-1 flex flex-col items-center">
                        <div 
                          className="w-full bg-blue-500 rounded-t-lg transition-all hover:bg-blue-600"
                          style={{ height: `${heightPercent}%`, minHeight: count > 0 ? "8px" : "0" }}
                        />
                        <div className="text-sm font-medium text-slate-700 mt-2">{score}</div>
                        <div className="text-xs text-slate-500">{count} ll.</div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-500 mt-4 text-center">Aantal leerlingen per score (1-5)</p>
              </div>

              {/* Risk Students for this category */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 bg-orange-50">
                  <h4 className="text-lg font-semibold text-orange-800">Risicoleerlingen - {category.name}</h4>
                  <p className="text-sm text-orange-600">Leerlingen met lage scores of negatieve trend in deze categorie</p>
                </div>
                {/* Filter students with low scores or negative trend in this category */}
                {(() => {
                  const riskStudents = overviewData.heatmapRows
                    .map(row => {
                      const categoryScores = Object.entries(row.scores)
                        .filter(([_, score]) => score !== null && score < 3);
                      
                      if (categoryScores.length > 0) {
                        const avgScore = categoryScores.reduce((sum, [_, score]) => sum + (score || 0), 0) / categoryScores.length;
                        return {
                          studentId: row.studentId,
                          name: row.name,
                          className: row.className,
                          lastScore: avgScore,
                          trendDelta: null,
                        };
                      }
                      return null;
                    })
                    .filter((s): s is NonNullable<typeof s> => s !== null)
                    .slice(0, 10); // Limit to top 10 risk students

                  return riskStudents.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide">Leerling</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">Klas</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">Laatste score</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">Trend</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">Actie</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {riskStudents.map((student) => (
                            <tr key={student.studentId} className="bg-white hover:bg-slate-50">
                              <td className="px-5 py-3 text-sm text-slate-800 font-medium">{student.name}</td>
                              <td className="px-4 py-3 text-center text-sm text-slate-600">{student.className || "–"}</td>
                              <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-md text-sm font-semibold bg-orange-100 text-orange-700">
                                  {student.lastScore.toFixed(1)}
                                </span>
                              </td>
                              <td className={`px-4 py-3 text-center text-sm font-medium ${getTrendColor(student.trendDelta)}`}>
                                {student.trendDelta !== null 
                                  ? (student.trendDelta > 0 ? "+" : "") + student.trendDelta.toFixed(1)
                                  : "–"
                                }
                                {" "}{getTrendArrow(student.trendDelta)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Link
                                  href={`/teacher/competencies/student/${student.studentId}`}
                                  className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                                >
                                  Bekijk leerling
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-500">
                      <p>Geen risicoleerlingen gevonden voor deze categorie</p>
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-50 rounded-2xl p-12 text-center">
          <p className="text-slate-500 text-lg">Geen categorieën beschikbaar</p>
        </div>
      )}
    </div>
  );
}
