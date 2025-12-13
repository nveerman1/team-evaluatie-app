"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { competencyService } from "@/services";
import type { ClassHeatmap } from "@/dtos";
import { Loading, ErrorMessage, Tile } from "@/components";
import { CompetencyRadarChart } from "@/components/student/competency/CompetencyRadarChart";

export default function AnalyseTabPage() {
  const params = useParams();
  const windowId = Number(params.windowId);

  const [heatmap, setHeatmap] = useState<ClassHeatmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const heat = await competencyService.getClassHeatmap(windowId);
      setHeatmap(heat);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [windowId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate category averages (must be called before early returns)
  const categoryAverages = useMemo(() => {
    if (!heatmap) return [];
    
    const categoryScores: Record<string, { total: number; count: number }> = {};
    
    heatmap.competencies.forEach((comp) => {
      const category = comp.category_name || comp.category || "Overig";
      if (!categoryScores[category]) {
        categoryScores[category] = { total: 0, count: 0 };
      }
      
      heatmap.rows.forEach((row) => {
        const score = row.scores[comp.id];
        if (score !== undefined) {
          categoryScores[category].total += score;
          categoryScores[category].count += 1;
        }
      });
    });

    return Object.entries(categoryScores).map(([category, data]) => ({
      category,
      average: data.count > 0 ? data.total / data.count : 0,
      count: data.count,
    }));
  }, [heatmap]);

  // Prepare radar chart data (must be called before early returns)
  const radarData = useMemo(() => {
    return categoryAverages.map((item) => ({
      name: item.category,
      value: item.average,
    }));
  }, [categoryAverages]);

  // Calculate overall class average per competency (must be called before early returns)
  const competencyAverages = useMemo(() => {
    if (!heatmap) return [];
    
    return heatmap.competencies.map((comp) => {
      let total = 0;
      let count = 0;
      heatmap.rows.forEach((row) => {
        const score = row.scores[comp.id];
        if (score !== undefined) {
          total += score;
          count += 1;
        }
      });
      return {
        id: comp.id,
        name: comp.name,
        category: comp.category_name || comp.category || "Overig",
        average: count > 0 ? total / count : 0,
        count,
      };
    });
  }, [heatmap]);

  const filledScans = useMemo(() => {
    if (!heatmap) return 0;
    return heatmap.rows.filter((r) => Object.keys(r.scores).length > 0).length;
  }, [heatmap]);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!heatmap) return <ErrorMessage message="Data not found" />;

  return (
    <div className="space-y-6">
      {/* KPI tiles */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Totaal leerlingen" value={heatmap.rows.length} />
        <Tile label="Competenties" value={heatmap.competencies.length} />
        <Tile label="Categorieën" value={categoryAverages.length} />
        <Tile label="Ingevulde scans" value={filledScans} />
      </section>

      {/* Radar diagram */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Radardiagram - Klasgemiddelden per categorie</h2>
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
          
          {/* Category scores table */}
          <div className="flex-1 flex flex-col justify-center">
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

      {/* Competency averages table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">Gemiddelde scores per competentie</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide">
                  Competentie
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide">
                  Categorie
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">
                  Ingevuld
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tracking-wide">
                  Gemiddelde
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {competencyAverages
                .sort((a, b) => b.average - a.average)
                .map((item) => (
                  <tr key={item.id} className="bg-white hover:bg-slate-50">
                    <td className="px-5 py-3 text-sm text-slate-800 font-medium">{item.name}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{item.category}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">
                      {item.count} / {heatmap.rows.length}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.count > 0 ? (
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-md text-sm font-medium ${
                            item.average >= 4
                              ? "bg-green-100 text-green-700"
                              : item.average >= 3
                              ? "bg-blue-100 text-blue-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {item.average.toFixed(1)}
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
    </div>
  );
}
