"use client";
import Link from "next/link";
import { useEffect, useState, useMemo, useCallback } from "react";
import { rubricService, competencyService } from "@/services";
import { RubricListItem, Competency, CompetencyTree, CompetencyCategoryTreeItem, CompetencyTreeItem } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type TabType = "peer" | "project" | "competencies";

// Sortable Competency Row Component
function SortableCompetencyRow({ competency }: { competency: CompetencyTreeItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: competency.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex w-full items-center justify-between gap-4 px-2 py-3 text-left transition ${
        isDragging ? "bg-sky-50 shadow-lg z-10" : "hover:bg-slate-50"
      }`}
    >
      <Link
        href={`/teacher/competencies/${competency.id}`}
        className="flex-1 min-w-0"
      >
        <p className="truncate text-sm font-medium text-slate-900">
          {competency.name}
        </p>
        {competency.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
            {competency.description}
          </p>
        )}
      </Link>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={`/teacher/competencies/${competency.id}`}
          className="text-xs font-medium text-sky-600"
        >
          Bewerken →
        </Link>
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-1"
          title="Sleep om te verplaatsen"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function RubricsListInner() {
  const [data, setData] = useState<RubricListItem[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [competencyTree, setCompetencyTree] = useState<CompetencyTree | null>(null);
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("peer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<number | "all">("all");
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [reorderSuccess, setReorderSuccess] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // Handle drag end for reordering competencies
  const handleDragEnd = useCallback(
    async (event: DragEndEvent, categoryId: number) => {
      const { active, over } = event;

      if (!over || active.id === over.id || !competencyTree) {
        return;
      }

      // Find the category
      const categoryIndex = competencyTree.categories.findIndex(
        (c) => c.id === categoryId
      );
      if (categoryIndex === -1) return;

      const category = competencyTree.categories[categoryIndex];
      const competenciesList = category.competencies || [];

      // Find old and new index
      const oldIndex = competenciesList.findIndex(
        (c) => c.id === active.id
      );
      const newIndex = competenciesList.findIndex((c) => c.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      // Optimistically update local state
      const newCompetencies = arrayMove(competenciesList, oldIndex, newIndex);
      const newCategories = [...competencyTree.categories];
      newCategories[categoryIndex] = {
        ...category,
        competencies: newCompetencies,
      };
      setCompetencyTree({
        ...competencyTree,
        categories: newCategories,
      });

      // Call API to persist the new order
      try {
        setReorderError(null);
        const items = newCompetencies.map((c, index) => ({
          id: c.id,
          order_index: index + 1,
        }));
        await competencyService.reorderCompetencies(categoryId, items);
        setReorderSuccess(true);
        setTimeout(() => setReorderSuccess(false), 2000);
      } catch (e: any) {
        // Revert on error
        setReorderError(
          e?.response?.data?.detail || e?.message || "Volgorde opslaan mislukt"
        );
        // Reload the original data
        await fetchCompetencies();
      }
    },
    [competencyTree]
  );

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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              className="h-9 w-56 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Zoek op titel/omschrijving..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  fetchList(q.trim(), activeTab);
                }
              }}
            />
            {q && (
              <button
                className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm shadow-sm hover:bg-gray-50"
                onClick={() => {
                  setQ("");
                  fetchList("", activeTab);
                }}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}

        {activeTab !== "competencies" && (
          <>
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
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
                <div className="text-gray-500 mb-4">
                  Geen rubrics gevonden.
                </div>
                <Link
                  href={`/teacher/rubrics/create?scope=${activeTab}`}
                  className="text-blue-600 hover:underline"
                >
                  Maak een nieuwe {activeTab === "peer" ? "team-evaluatie" : "projectbeoordeling"} aan
                </Link>
              </div>
            )}
            {!loading && !error && data.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide sticky left-0 bg-gray-50">
                          Titel
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide">
                          Beschrijving
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide">
                          # Criteria
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 tracking-wide">
                          Acties
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.map((r) => (
                        <tr key={r.id} className="bg-white hover:bg-gray-50">
                          <td className="px-5 py-3 font-medium sticky left-0 bg-white">
                            {r.title}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-600">
                              {r.description || "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                              {r.criteria_count}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Link
                                href={`/teacher/evaluations/create?rubric_id=${r.id}`}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm"
                              >
                                Gebruiken
                              </Link>
                              <Link
                                href={`/teacher/rubrics/${r.id}/edit`}
                                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium shadow-sm"
                              >
                                Bewerken
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Competencies Tab Content - OMZA Style with Drag & Drop */}
        {activeTab === "competencies" && (
          <div className="space-y-4">
            {/* Reorder feedback messages */}
            {reorderSuccess && (
              <div className="px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
                ✓ Volgorde opgeslagen
              </div>
            )}
            {reorderError && (
              <div className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                ✗ {reorderError}
              </div>
            )}

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

            {/* Category Sections - OMZA style list cards with drag & drop */}
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

                    {/* Competency rows with drag & drop */}
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleDragEnd(event, category.id)}
                    >
                      <SortableContext
                        items={(category.competencies || []).map((c) => c.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="divide-y divide-slate-100">
                          {(category.competencies || []).map((competency: CompetencyTreeItem) => (
                            <SortableCompetencyRow
                              key={competency.id}
                              competency={competency}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
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
