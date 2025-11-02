"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { rubricService, competencyService } from "@/services";
import { RubricListItem, Competency } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";

type TabType = "peer" | "project" | "competencies";

export default function RubricsListInner() {
  const [data, setData] = useState<RubricListItem[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("peer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchRubrics(query = "", scope: "peer" | "project") {
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

  async function fetchCompetencies() {
    setLoading(true);
    setError(null);
    try {
      const comps = await competencyService.getCompetencies(false);
      setCompetencies(comps);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }

  async function fetchList(query = "", scope: TabType = activeTab) {
    if (scope === "competencies") {
      await fetchCompetencies();
    } else {
      await fetchRubrics(query, scope);
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
        {activeTab !== "competencies" && (
          <Link
            href={`/teacher/rubrics/create?scope=${activeTab}`}
            className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90"
          >
            + Nieuwe {activeTab === "peer" ? "team-evaluatie" : "projectbeoordeling"}
          </Link>
        )}
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
          <button
            onClick={() => handleTabChange("competencies")}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "competencies"
                ? "border-black text-black"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Competenties
          </button>
        </nav>
      </div>

      {activeTab !== "competencies" && (
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
      )}

      {activeTab !== "competencies" && (
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
      )}

      {/* Competencies Tab Content */}
      {activeTab === "competencies" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Competenties</h2>
            <Link
              href="/teacher/competencies/create"
              className="px-4 py-2 bg-black text-white rounded-xl hover:opacity-90"
            >
              + Nieuwe Competentie
            </Link>
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
          {!loading && !error && competencies.length === 0 && (
            <div className="p-8 border rounded-xl bg-gray-50 text-center">
              <p className="text-gray-500">
                Nog geen competenties aangemaakt. Maak je eerste competentie
                aan om te beginnen.
              </p>
            </div>
          )}
          {!loading && !error && competencies.length > 0 && (
            <div className="grid gap-3">
              {competencies
                .sort((a, b) => a.order - b.order)
                .map((comp) => (
                  <Link
                    key={comp.id}
                    href={`/teacher/competencies/${comp.id}`}
                    className="block p-4 border rounded-lg bg-white hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold">{comp.name}</h3>
                          {!comp.active && (
                            <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs">
                              Inactief
                            </span>
                          )}
                          {comp.category && (
                            <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs">
                              {comp.category}
                            </span>
                          )}
                        </div>
                        {comp.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {comp.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Schaal: {comp.scale_min} - {comp.scale_max}
                        </p>
                      </div>
                      <span className="text-gray-400">→</span>
                    </div>
                  </Link>
                ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
