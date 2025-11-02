"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { competencyService } from "@/services";
import type { CompetencyWindow, ClassHeatmap } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import Link from "next/link";

export default function WindowDetailPage() {
  const params = useParams();

  const windowId = Number(params.windowId);

  const [window, setWindow] = useState<CompetencyWindow | null>(null);
  const [heatmap, setHeatmap] = useState<ClassHeatmap | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | undefined>(
    undefined
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowId, selectedClass]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [win, heat] = await Promise.all([
        competencyService.getWindow(windowId),
        competencyService.getClassHeatmap(windowId, selectedClass),
      ]);
      setWindow(win);
      setHeatmap(heat);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!window) return;

    try {
      await competencyService.updateWindow(windowId, { status: newStatus });
      setWindow({ ...window, status: newStatus as "draft" | "open" | "closed" });
    } catch (err) {
      alert("Failed to update status: " + err);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!window || !heatmap) return <ErrorMessage message="Data not found" />;

  // Get unique classes from window
  const availableClasses = window.class_names || [];

  return (
    <main className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">{window.title}</h1>
          <div className="flex gap-2">
            <select
              value={window.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-3 py-1 border rounded-lg text-sm"
            >
              <option value="draft">Concept</option>
              <option value="open">Open</option>
              <option value="closed">Gesloten</option>
            </select>
            <Link
              href="/teacher/competencies"
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Terug
            </Link>
          </div>
        </div>
        {window.description && (
          <p className="text-gray-600">{window.description}</p>
        )}
        <div className="flex gap-4 text-sm text-gray-600 mt-2">
          {window.start_date && (
            <span>
              Start: {new Date(window.start_date).toLocaleDateString("nl-NL")}
            </span>
          )}
          {window.end_date && (
            <span>
              Eind: {new Date(window.end_date).toLocaleDateString("nl-NL")}
            </span>
          )}
        </div>
      </div>

      {/* Class Filter */}
      {availableClasses.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Filter op klas:
          </label>
          <select
            value={selectedClass || "all"}
            onChange={(e) =>
              setSelectedClass(e.target.value === "all" ? undefined : e.target.value)
            }
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Alle klassen</option>
            {availableClasses.map((className) => (
              <option key={className} value={className}>
                {className}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-4 border rounded-lg bg-blue-50">
          <div className="text-sm text-gray-600">Leerlingen</div>
          <div className="text-2xl font-bold">{heatmap.rows.length}</div>
        </div>
        <div className="p-4 border rounded-lg bg-purple-50">
          <div className="text-sm text-gray-600">Competenties</div>
          <div className="text-2xl font-bold">{heatmap.competencies.length}</div>
        </div>
        <div className="p-4 border rounded-lg bg-green-50">
          <div className="text-sm text-gray-600">Ingevulde Scans</div>
          <div className="text-2xl font-bold">
            {heatmap.rows.filter((r) => Object.keys(r.scores).length > 0).length}
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="border rounded-xl bg-white p-6">
        <h2 className="text-xl font-semibold mb-4">Competentieheatmap</h2>

        {heatmap.rows.length === 0 ? (
          <div className="p-8 bg-gray-50 rounded-lg text-center text-gray-500">
            Geen data beschikbaar voor de geselecteerde filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-semibold sticky left-0 bg-white z-10 align-bottom">
                    Leerling
                  </th>
                  {heatmap.competencies.map((comp) => (
                    <th
                      key={comp.id}
                      className="text-center p-3 font-semibold min-w-[120px] relative"
                      style={{ height: '150px', verticalAlign: 'bottom' }}
                    >
                      <div className="absolute bottom-3 left-1/2" style={{ transformOrigin: 'bottom left' }}>
                        <div className="transform -rotate-45 whitespace-nowrap text-sm" style={{ marginLeft: '10px' }}>
                          {comp.name}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.rows.map((row) => (
                  <tr key={row.user_id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium sticky left-0 bg-white z-10">
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
                        <td key={comp.id} className="p-3">
                          {score !== undefined ? (
                            <div className="flex flex-col items-center">
                              <span
                                className={`px-3 py-1 rounded text-sm font-semibold ${
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
                                  className={`text-xs mt-1 ${
                                    delta > 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {delta > 0 ? "+" : ""}
                                  {delta.toFixed(1)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
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
      <div className="p-4 border rounded-lg bg-gray-50">
        <h3 className="text-sm font-semibold mb-2">Legenda</h3>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
              ≥ 4.0
            </span>
            <span>Goed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
              3.0 - 3.9
            </span>
            <span>Voldoende</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded">
              &lt; 3.0
            </span>
            <span>Aandacht</span>
          </div>
        </div>
      </div>
    </main>
  );
}
