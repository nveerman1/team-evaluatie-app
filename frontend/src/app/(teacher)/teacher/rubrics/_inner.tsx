"use client";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { rubricService, competencyService } from "@/services";
import { RubricListItem, Competency, CompetencyTree, CompetencyCategoryTreeItem, CompetencyTreeItem } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";

type TabType = "peer" | "project" | "competencies";

export default function RubricsListInner() {
  const [data, setData] = useState<RubricListItem[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [competencyTree, setCompetencyTree] = useState<CompetencyTree | null>(null);
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("peer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<number | "all">("all");

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
      const [comps, tree] = await Promise.all([
        competencyService.getCompetencies(false),
        competencyService.getCompetencyTree(false),
      ]);
      setCompetencies(comps);
      setCompetencyTree(tree);
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

  // Filter categories based on selected filter
  const filteredCategories = useMemo((): CompetencyCategoryTreeItem[] => {
    if (!competencyTree || !competencyTree.categories) return [];
    if (selectedCategoryFilter === "all") {
      return competencyTree.categories;
    }
    return competencyTree.categories.filter((cat: CompetencyCategoryTreeItem) => cat.id === selectedCategoryFilter);
  }, [competencyTree, selectedCategoryFilter]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setQ("");
  };

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">Rubrics</h1>
            <p className="text-gray-600 mt-1 text-sm">
              Beheer je beoordelingsrubrics met criteria op 5 niveaus.
            </p>
          </div>
          {activeTab !== "competencies" ? (
            <Link
              href={`/teacher/rubrics/create?scope=${activeTab}`}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              + Nieuwe {activeTab === "peer" ? "team-evaluatie" : "projectbeoordeling"}
            </Link>
          ) : (
            <Link
              href="/teacher/competencies/create"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              + Nieuwe Competentie
            </Link>
          )}
        </header>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

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
          <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
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

        {/* Competencies Tab Content - OMZA Style */}
        {activeTab === "competencies" && (
          <div className="space-y-4">
            {/* Category Filter Pills */}
            {competencyTree && competencyTree.categories && competencyTree.categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategoryFilter("all")}
                  className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                    selectedCategoryFilter === "all"
                      ? "border-sky-500 bg-sky-50 text-sky-700 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Alle ({competencyTree.categories.reduce((acc: number, cat: CompetencyCategoryTreeItem) => acc + (cat.competencies?.length || 0), 0)})
                </button>
                {competencyTree.categories.map((category: CompetencyCategoryTreeItem) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategoryFilter(category.id)}
                    className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                      selectedCategoryFilter === category.id
                        ? "border-sky-500 bg-sky-50 text-sky-700 shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {category.name} ({category.competencies?.length || 0})
                  </button>
                ))}
              </div>
            )}

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
            {!loading && !error && (!competencyTree || !competencyTree.categories || competencyTree.categories.length === 0) && (
              <div className="p-8 border rounded-xl bg-gray-50 text-center">
                <p className="text-gray-500 mb-4">
                  Nog geen competenties aangemaakt. Maak je eerste competentie
                  aan om te beginnen.
                </p>
                <Link
                  href="/teacher/competencies/create"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  <span>+</span> Eerste Competentie Aanmaken
                </Link>
              </div>
            )}

            {/* Category Sections - OMZA style list cards */}
            {!loading && !error && filteredCategories.length > 0 && (
              <div className="space-y-4">
                {filteredCategories.map((category: CompetencyCategoryTreeItem) => (
                  <section
                    key={category.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    {/* Category header */}
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {category.color && (
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-sm font-semibold text-slate-900">
                              {category.name}
                            </h2>
                            <span className="text-xs font-medium text-slate-400">
                              ({category.competencies?.length || 0})
                            </span>
                          </div>
                          {category.description && (
                            <p className="text-xs text-slate-500">
                              {category.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Competency rows */}
                    <div className="divide-y divide-slate-100">
                      {(category.competencies || []).map((competency: CompetencyTreeItem) => (
                        <Link
                          key={competency.id}
                          href={`/teacher/competencies/${competency.id}`}
                          className="flex w-full items-center justify-between gap-4 px-2 py-3 text-left transition hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {competency.name}
                            </p>
                            {competency.description && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                                {competency.description}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 text-xs font-medium text-sky-600">
                            Bewerken →
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
