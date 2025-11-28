"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { competencyService } from "@/services";
import type { ClassHeatmap } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import Link from "next/link";

export default function HeatmapTabPage() {
  const params = useParams();
  const windowId = Number(params.windowId);

  const [heatmap, setHeatmap] = useState<ClassHeatmap | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const heat = await competencyService.getClassHeatmap(windowId, selectedClass);
      setHeatmap(heat);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [windowId, selectedClass]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!heatmap) return <ErrorMessage message="Data not found" />;

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-4 border rounded-xl bg-blue-50/80">
          <div className="text-sm text-gray-600">Leerlingen</div>
          <div className="text-2xl font-bold">{heatmap.rows.length}</div>
        </div>
        <div className="p-4 border rounded-xl bg-purple-50/80">
          <div className="text-sm text-gray-600">Competenties</div>
          <div className="text-2xl font-bold">{heatmap.competencies.length}</div>
        </div>
        <div className="p-4 border rounded-xl bg-green-50/80">
          <div className="text-sm text-gray-600">Ingevulde Scans</div>
          <div className="text-2xl font-bold">
            {heatmap.rows.filter((r) => Object.keys(r.scores).length > 0).length}
          </div>
        </div>
      </div>

      {/* Heatmap Table */}
      <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
        {heatmap.rows.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Geen data beschikbaar voor de geselecteerde filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-max">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="sticky left-0 z-20 bg-gray-50 p-4 text-left font-semibold text-sm text-gray-700 min-w-[200px]">
                    Leerling
                  </th>
                  {heatmap.competencies.map((comp) => (
                    <th
                      key={comp.id}
                      className="p-2 text-center font-semibold text-sm text-gray-700 min-w-[100px]"
                    >
                      <div className="flex items-center justify-center h-20">
                        <span
                          className="transform -rotate-45 origin-center whitespace-nowrap text-xs max-w-[100px] truncate"
                          title={comp.name}
                        >
                          {comp.name}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {heatmap.rows.map((row) => (
                  <tr key={row.user_id} className="hover:bg-gray-50/50">
                    <td className="sticky left-0 z-10 bg-white p-4 font-medium border-r border-gray-100">
                      <Link
                        href={`/teacher/competencies/windows/${windowId}/student/${row.user_id}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {row.user_name}
                      </Link>
                    </td>
                    {heatmap.competencies.map((comp) => {
                      const score = row.scores[comp.id];
                      const delta = row.deltas[comp.id];

                      return (
                        <td key={comp.id} className="p-2 text-center">
                          {score !== undefined ? (
                            <div className="flex flex-col items-center gap-1">
                              <span
                                className={`inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded-md text-sm font-semibold ${
                                  score >= 4
                                    ? "bg-green-100 text-green-700"
                                    : score >= 3
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-orange-100 text-orange-700"
                                }`}
                              >
                                {score.toFixed(1)}
                              </span>
                              {delta !== undefined && delta !== 0 && (
                                <span
                                  className={`text-xs font-medium ${
                                    delta > 0 ? "text-green-600" : "text-red-600"
                                  }`}
                                >
                                  {delta > 0 ? "+" : ""}
                                  {delta.toFixed(1)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300">–</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-6 p-4 border rounded-xl bg-gray-50/80">
        <span className="text-sm font-medium text-gray-700">Legenda:</span>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-sm font-medium">
            ≥ 4.0
          </span>
          <span className="text-sm text-gray-600">Goed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-sm font-medium">
            3.0 - 3.9
          </span>
          <span className="text-sm text-gray-600">Voldoende</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-md text-sm font-medium">
            &lt; 3.0
          </span>
          <span className="text-sm text-gray-600">Aandacht</span>
        </div>
      </div>
    </div>
  );
}
