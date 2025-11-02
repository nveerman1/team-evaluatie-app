"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { rubricService } from "@/services";
import { RubricListItem } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";

type TabType = "peer" | "project";

export default function RubricsListInner() {
  const [data, setData] = useState<RubricListItem[]>([]);
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("peer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchList(query = "", scope: TabType = activeTab) {
    setLoading(true);
    setError(null);
    try {
      const response = await rubricService.getRubrics(query, scope);
      setData(response.items || []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchList("", activeTab);
  }, [activeTab]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setQ("");
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Rubrics</h1>
          <p className="text-gray-600">
            Beheer je beoordelingsrubrics met criteria op 5 niveaus.
          </p>
        </div>
        <Link
          href={`/teacher/rubrics/create?scope=${activeTab}`}
          className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90"
        >
          + Nieuwe {activeTab === "peer" ? "team-evaluatie" : "projectbeoordeling"}
        </Link>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          <button
            onClick={() => handleTabChange("peer")}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "peer"
                ? "border-black text-black"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Team-evaluatie (peer)
          </button>
          <button
            onClick={() => handleTabChange("project")}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "project"
                ? "border-black text-black"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Projectbeoordeling
          </button>
        </nav>
      </div>

      <section className="flex items-center gap-3">
        <input
          className="border rounded-lg px-3 py-2 w-72"
          placeholder="Zoek op titel/omschrijving…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              fetchList(q.trim(), activeTab);
            }
          }}
        />
        <button
          className="px-3 py-2 rounded-lg border"
          onClick={() => fetchList(q.trim(), activeTab)}
        >
          Zoek
        </button>
        {q && (
          <button
            className="px-3 py-2 rounded-lg border"
            onClick={() => {
              setQ("");
              fetchList("", activeTab);
            }}
          >
            Reset
          </button>
        )}
      </section>

      <section className="bg-white border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_140px_160px_140px] gap-0 px-4 py-3 bg-gray-50 text-sm font-medium text-gray-600">
          <div>Titel</div>
          <div># Criteria</div>
          <div>Schaal</div>
          <div className="text-right pr-2">Acties</div>
        </div>
        {loading && (
          <div className="p-6">
            <Loading />
          </div>
        )}
        {error && !loading && (
          <div className="p-6">
            <ErrorMessage message={`Fout: ${error}`} />
          </div>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="p-6 text-gray-500">Geen rubrics gevonden.</div>
        )}
        {!loading &&
          !error &&
          data.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[1fr_140px_160px_140px] items-start gap-0 px-4 py-3 border-t text-sm"
            >
              <div>
                <div className="font-medium">{r.title}</div>
                {r.description && (
                  <div className="text-sm text-gray-500">{r.description}</div>
                )}
              </div>
              <div className="text-gray-600">{r.criteria_count}</div>
              <div className="text-gray-600">
                {r.scale_min} - {r.scale_max}
              </div>
              <div className="flex justify-end gap-2 pr-2">
                <Link
                  href={`/teacher/evaluations/create?rubric_id=${r.id}`}
                  className="px-2 py-1 rounded-lg border hover:bg-gray-50"
                >
                  Gebruiken
                </Link>
                <Link
                  href={`/teacher/rubrics/${r.id}/edit`}
                  className="px-2 py-1 rounded-lg border hover:bg-gray-50"
                >
                  Bewerken
                </Link>
              </div>
            </div>
          ))}
      </section>
    </main>
  );
}
