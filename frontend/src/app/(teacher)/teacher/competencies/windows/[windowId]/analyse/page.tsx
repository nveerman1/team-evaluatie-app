"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { competencyService } from "@/services";
import type { ClassHeatmap } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";

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

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!heatmap) return <ErrorMessage message="Data not found" />;

  // Calculate category averages
  const categoryScores: Record<string, { total: number; count: number }> = {};
  
  heatmap.competencies.forEach((comp) => {
    const category = comp.category || "Overig";
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

  const categoryAverages = Object.entries(categoryScores).map(([category, data]) => ({
    category,
    average: data.count > 0 ? data.total / data.count : 0,
    count: data.count,
  }));

  // Calculate overall class average per competency
  const competencyAverages = heatmap.competencies.map((comp) => {
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
      category: comp.category || "Overig",
      average: count > 0 ? total / count : 0,
      count,
    };
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="p-4 border rounded-xl bg-blue-50/80">
          <div className="text-sm text-gray-600">Totaal leerlingen</div>
          <div className="text-2xl font-bold">{heatmap.rows.length}</div>
        </div>
        <div className="p-4 border rounded-xl bg-purple-50/80">
          <div className="text-sm text-gray-600">Competenties</div>
          <div className="text-2xl font-bold">{heatmap.competencies.length}</div>
        </div>
        <div className="p-4 border rounded-xl bg-green-50/80">
          <div className="text-sm text-gray-600">Categorieën</div>
          <div className="text-2xl font-bold">{categoryAverages.length}</div>
        </div>
        <div className="p-4 border rounded-xl bg-orange-50/80">
          <div className="text-sm text-gray-600">Gemiddeld ingevuld</div>
          <div className="text-2xl font-bold">
            {heatmap.rows.filter((r) => Object.keys(r.scores).length > 0).length}
          </div>
        </div>
      </div>

      {/* Radar diagram placeholder */}
      <div className="border rounded-xl bg-white shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Radardiagram - Klasgemiddelden per categorie</h2>
        <div className="flex flex-col md:flex-row gap-8">
          {/* Placeholder for radar chart */}
          <div className="flex-1 min-h-[300px] bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-200">
            <div className="text-center text-gray-500">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-gray-400"
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
              <p className="text-xs mt-1">Visualisatie van klasgemiddelden</p>
            </div>
          </div>
          
          {/* Category scores table */}
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Scores per categorie</h3>
            <div className="space-y-2">
              {categoryAverages
                .sort((a, b) => b.average - a.average)
                .map((item) => (
                  <div key={item.category} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-gray-700 truncate">
                      {item.category}
                    </span>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
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
                    <span className="text-sm font-medium w-12 text-right">
                      {item.average.toFixed(1)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Competency averages table */}
      <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold">Gemiddelde scores per competentie</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 text-left font-semibold text-sm text-gray-700">
                  Competentie
                </th>
                <th className="p-4 text-left font-semibold text-sm text-gray-700">
                  Categorie
                </th>
                <th className="p-4 text-left font-semibold text-sm text-gray-700">
                  Ingevuld
                </th>
                <th className="p-4 text-left font-semibold text-sm text-gray-700">
                  Gemiddelde
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {competencyAverages
                .sort((a, b) => b.average - a.average)
                .map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="p-4 font-medium text-sm">{item.name}</td>
                    <td className="p-4 text-sm text-gray-600">{item.category}</td>
                    <td className="p-4 text-sm text-gray-600">
                      {item.count} / {heatmap.rows.length}
                    </td>
                    <td className="p-4">
                      {item.count > 0 ? (
                        <span
                          className={`px-2.5 py-1 rounded-md text-sm font-medium ${
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
                        <span className="text-gray-400">–</span>
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
