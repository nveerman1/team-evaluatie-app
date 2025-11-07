"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { competencyService } from "@/services";
import type { CompetencyWindow, ClassHeatmap, ExternalInvite } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import Link from "next/link";
import { ExternalInviteList } from "@/components/competency/ExternalInviteComponents";

export default function WindowDetailPage() {
  const params = useParams();
  const router = useRouter();

  const windowId = Number(params.windowId);

  const [window, setWindow] = useState<CompetencyWindow | null>(null);
  const [heatmap, setHeatmap] = useState<ClassHeatmap | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"heatmap" | "invitations">(
    "heatmap"
  );

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
      setWindow({
        ...window,
        status: newStatus as "draft" | "open" | "closed",
      });
    } catch (err) {
      alert("Failed to update status: " + err);
    }
  };

  const handleDelete = async () => {
    if (!window) return;

    const confirmed = confirm(
      `Weet je zeker dat je "${window.title}" wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`
    );

    if (!confirmed) return;

    try {
      await competencyService.deleteWindow(windowId);
      alert("Venster succesvol verwijderd");
      router.push("/teacher/competencies");
    } catch (err) {
      alert("Failed to delete window: " + err);
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
            <button
              onClick={handleDelete}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
            >
              Verwijderen
            </button>
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
              setSelectedClass(
                e.target.value === "all" ? undefined : e.target.value,
              )
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
          <div className="text-2xl font-bold">
            {heatmap.competencies.length}
          </div>
        </div>
        <div className="p-4 border rounded-lg bg-green-50">
          <div className="text-sm text-gray-600">Ingevulde Scans</div>
          <div className="text-2xl font-bold">
            {
              heatmap.rows.filter((r) => Object.keys(r.scores).length > 0)
                .length
            }
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("heatmap")}
            className={`px-4 py-2 font-medium border-b-2 transition ${
              activeTab === "heatmap"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Heatmap
          </button>
          <button
            onClick={() => setActiveTab("invitations")}
            className={`px-4 py-2 font-medium border-b-2 transition ${
              activeTab === "invitations"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Uitnodigingen
          </button>
        </div>
      </div>

      {/* Heatmap Tab */}
      {activeTab === "heatmap" && (
        <div className="border rounded-xl bg-white p-6">
          <h2 className="text-xl font-semibold mb-4">Competentieheatmap</h2>

        {heatmap.rows.length === 0 ? (
          <div className="p-8 bg-gray-50 rounded-lg text-center text-gray-500">
            Geen data beschikbaar voor de geselecteerde filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse">
              {/* Kolombreedtes: eerste kolom breed voor namen, overige gelijk */}
              <colgroup>
                <col className="w-[260px]" />
                {heatmap.competencies.map((c) => (
                  <col key={c.id} className="w-[140px]" />
                ))}
              </colgroup>

              <thead>
                <tr className="border-b">
                  <th className="sticky left-0 z-10 bg-white p-3 text-left font-semibold align-bottom">
                    Leerling
                  </th>

                  {heatmap.competencies.map((comp) => (
                    <th
                      key={comp.id}
                      className="relative h-36 p-0 align-bottom"
                    >
                      {/* container om exact te centreren */}
                      <div className="absolute inset-x-0 bottom-2 flex justify-center">
                        {/* pivot op bottom-left, dus start van het woord blijft binnen de kolom */}
                        <span className="block origin-bottom-left -rotate-45 whitespace-nowrap text-sm font-semibold translate-x-3">
                          {comp.name}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {heatmap.rows.map((row) => (
                  <tr key={row.user_id} className="border-b hover:bg-gray-50">
                    <td className="sticky left-0 z-10 bg-white p-3 font-medium">
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
                        <td
                          key={comp.id}
                          className="p-3 text-center align-middle"
                        >
                          {score !== undefined ? (
                            <div className="flex flex-col items-center leading-tight">
                              <span
                                className={`px-2.5 py-1 rounded text-sm font-semibold ${
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
                                  className={`mt-1 text-xs ${
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
                            <span className="text-gray-300 text-sm">–</span>
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
        </div>
      )}

      {/* Invitations Tab */}
      {activeTab === "invitations" && (
        <div className="border rounded-xl bg-white p-6">
          <h2 className="text-xl font-semibold mb-4">Externe Uitnodigingen</h2>
          <p className="text-sm text-gray-600 mb-6">
            Overzicht van alle externe uitnodigingen voor dit venster. Leerlingen
            kunnen externen uitnodigen om hun competenties te beoordelen.
          </p>

          {/* Filter by student */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Filter op leerling (optioneel):
            </label>
            <div className="text-sm text-gray-600">
              Gebruik de lijst hieronder om uitnodigingen per leerling te bekijken.
            </div>
          </div>

          {/* Show invites for all students */}
          <ExternalInviteList windowId={windowId} subjectUserId={undefined} />
        </div>
      )}

      {/* Legend (only show for heatmap tab) */}
      {activeTab === "heatmap" && (
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
      )}
    </main>
  );
}
