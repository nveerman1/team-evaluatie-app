"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { subjectService } from "@/services/subject.service";
import { competencyService } from "@/services/competency.service";
import { Subject } from "@/dtos/subject.dto";
import type {
  CompetencyTree,
  CompetencyCategoryTreeItem,
  CompetencyTreeItem,
} from "@/dtos/competency.dto";
import {
  createLearningObjective,
  listLearningObjectives,
  importLearningObjectives,
} from "@/services/learning-objective.service";
import type {
  LearningObjectiveDto,
  LearningObjectiveCreateDto,
  LearningObjectiveImportItem,
} from "@/dtos/learning-objective.dto";
import {
  listPeerCriteria,
  createPeerCriterion,
  updatePeerCriterion,
  deletePeerCriterion,
} from "@/services/peer-evaluation-criterion-template.service";
import type {
  PeerEvaluationCriterionTemplateDto,
  PeerEvaluationCriterionTemplateCreateDto,
} from "@/dtos/peer-evaluation-criterion-template.dto";

type TabType =
  | "peer"
  | "rubrics"
  | "competencies"
  | "mail"
  | "objectives"
  | "remarks"
  | "tags";

const TABS: { key: TabType; label: string }[] = [
  { key: "peer", label: "Peerevaluatie Criteria" },
  { key: "rubrics", label: "Projectrubrics" },
  { key: "competencies", label: "Competenties" },
  { key: "mail", label: "Mail-templates" },
  { key: "objectives", label: "Leerdoelen" },
  { key: "remarks", label: "Standaardopmerkingen" },
  { key: "tags", label: "Tags & metadata" },
];

export default function TemplatesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<TabType>("peer");

  // Modal state for learning objectives
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [learningObjectives, setLearningObjectives] = useState<
    LearningObjectiveDto[]
  >([]);
  const [loadingObjectives, setLoadingObjectives] = useState(false);
  const [formData, setFormData] = useState<LearningObjectiveCreateDto>({
    domain: "",
    title: "",
    description: "",
    order: 0,
    phase: "",
  });
  
  // Import state
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    errors: string[];
  } | null>(null);

  // Peer criteria state
  const [peerCriteria, setPeerCriteria] = useState<
    PeerEvaluationCriterionTemplateDto[]
  >([]);
  const [loadingPeerCriteria, setLoadingPeerCriteria] = useState(false);
  const [expandedCriterion, setExpandedCriterion] = useState<number | null>(
    null
  );
  const [editingCriterion, setEditingCriterion] = useState<number | null>(null);
  const [editFilterPhase, setEditFilterPhase] = useState<string | undefined>(undefined);
  const [editLearningObjectiveIds, setEditLearningObjectiveIds] = useState<number[]>([]);
  const [isCreatingPeerCriterion, setIsCreatingPeerCriterion] = useState(false);
  const [peerFormData, setPeerFormData] = useState<Partial<PeerEvaluationCriterionTemplateCreateDto> & { _filterPhase?: string }>({
    omza_category: "organiseren",
    title: "",
    description: "",
    level_descriptors: {
      "1": "",
      "2": "",
      "3": "",
      "4": "",
      "5": "",
    },
    learning_objective_ids: [] as number[],
    _filterPhase: undefined,
  });

  // Competency state
  const [competencyTree, setCompetencyTree] = useState<CompetencyTree | null>(null);
  const [loadingCompetencies, setLoadingCompetencies] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<number | "all">("all");

  // Sync state with URL params
  useEffect(() => {
    const subjectIdParam = searchParams.get("subjectId");
    const tabParam = searchParams.get("tab");

    if (subjectIdParam) {
      setSelectedSubjectId(parseInt(subjectIdParam));
    }
    if (tabParam && TABS.find((t) => t.key === tabParam)) {
      setActiveTab(tabParam as TabType);
    }
  }, [searchParams]);

  // Load subjects
  useEffect(() => {
    loadSubjects();
  }, []);

  // Load learning objectives when tab changes to objectives
  useEffect(() => {
    if (activeTab === "objectives" && selectedSubjectId) {
      fetchLearningObjectives();
    }
  }, [activeTab, selectedSubjectId]);

  // Load peer criteria when tab changes to peer
  useEffect(() => {
    if (activeTab === "peer" && selectedSubjectId) {
      fetchPeerCriteria();
      fetchLearningObjectives(); // Also load learning objectives for linking
    }
  }, [activeTab, selectedSubjectId]);

  // Load competencies when tab changes to competencies
  useEffect(() => {
    if (activeTab === "competencies") {
      fetchCompetencyTree();
    }
  }, [activeTab]);

  const loadSubjects = async () => {
    try {
      setLoading(true);
      const response = await subjectService.listSubjects({
        per_page: 100,
        is_active: true,
      });
      setSubjects(response.subjects);
    } catch (err) {
      console.error("Failed to load subjects:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLearningObjectives = async () => {
    if (!selectedSubjectId) return;
    
    setLoadingObjectives(true);
    try {
      const response = await listLearningObjectives({
        page: 1,
        limit: 50,
        subject_id: selectedSubjectId,  // Filter by selected subject
      });
      setLearningObjectives(response.items);
    } catch (err) {
      console.error("Error fetching learning objectives:", err);
    } finally {
      setLoadingObjectives(false);
    }
  };

  const fetchCompetencyTree = async () => {
    setLoadingCompetencies(true);
    try {
      const tree = await competencyService.getCompetencyTree(false); // Include inactive
      setCompetencyTree(tree);
    } catch (err) {
      console.error("Error fetching competency tree:", err);
    } finally {
      setLoadingCompetencies(false);
    }
  };

  // Filter categories based on selected filter
  const filteredCategories = useMemo((): CompetencyCategoryTreeItem[] => {
    if (!competencyTree) return [];
    if (selectedCategoryFilter === "all") {
      return competencyTree.categories;
    }
    return competencyTree.categories.filter((cat: CompetencyCategoryTreeItem) => cat.id === selectedCategoryFilter);
  }, [competencyTree, selectedCategoryFilter]);

  const openCreateModal = () => {
    setFormData({
      domain: "",
      title: "",
      description: "",
      order: 0,
      phase: "",
      subject_id: selectedSubjectId,  // Set subject_id from selected subject
    });
    setIsCreateModalOpen(true);
  };

  const handleCreateObjective = async () => {
    if (!formData.title) {
      alert("Titel is verplicht");
      return;
    }

    if (!selectedSubjectId) {
      alert("Selecteer eerst een sectie");
      return;
    }

    try {
      // Ensure subject_id is set when creating
      await createLearningObjective({
        ...formData,
        subject_id: selectedSubjectId,
      });
      setIsCreateModalOpen(false);
      fetchLearningObjectives();
    } catch (err) {
      console.error("Error creating learning objective:", err);
      alert("Er is een fout opgetreden bij het aanmaken van het leerdoel.");
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    let fieldStart = true;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"' && (fieldStart || inQuotes)) {
        if (fieldStart && !inQuotes) {
          inQuotes = true;
          fieldStart = false;
        } else if (inQuotes) {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
        fieldStart = true;
      } else {
        current += char;
        fieldStart = false;
      }
    }
    result.push(current.trim());

    return result;
  };

  const handleImport = async () => {
    if (!importText.trim()) {
      alert("Voer CSV-gegevens in");
      return;
    }

    if (!selectedSubjectId) {
      alert("Selecteer eerst een sectie");
      return;
    }

    try {
      const lines = importText.trim().split("\n");
      const items: LearningObjectiveImportItem[] = [];

      const firstLine = lines[0].toLowerCase();
      const hasHeader =
        firstLine.includes("domein") ||
        firstLine.includes("domain") ||
        firstLine.includes("nummer") ||
        firstLine.includes("titel") ||
        firstLine.includes("title");
      const startIdx = hasHeader ? 1 : 0;

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = parseCSVLine(line);
        if (parts.length < 2) continue;

        let phase = parts[4] || null;
        if (phase) {
          const phaseUpper = phase.toUpperCase();
          if (phaseUpper === "B" || phaseUpper === "ONDERBOUW") {
            phase = "onderbouw";
          } else if (phaseUpper === "E" || phaseUpper === "BOVENBOUW") {
            phase = "bovenbouw";
          }
          if (phase.length > 20) {
            phase = phase.substring(0, 20);
          }
        }

        items.push({
          domain: parts[0] || null,
          order: parts[1] ? parseInt(parts[1], 10) : 0,
          title: parts[2] || parts[1],
          description: parts[3] || null,
          phase: phase,
        });
      }

      const result = await importLearningObjectives(
        { items },
        selectedSubjectId
      );
      setImportResult(result);
      if (result.errors.length === 0) {
        fetchLearningObjectives();
      }
    } catch (err) {
      console.error("Error importing learning objectives:", err);
      alert("Er is een fout opgetreden bij het importeren.");
    }
  };

  // Peer criteria functions
  const fetchPeerCriteria = async () => {
    if (!selectedSubjectId) return;
    
    setLoadingPeerCriteria(true);
    try {
      const criteria = await listPeerCriteria(selectedSubjectId);
      setPeerCriteria(criteria);
    } catch (err) {
      console.error("Error fetching peer criteria:", err);
    } finally {
      setLoadingPeerCriteria(false);
    }
  };

  const handleCreatePeerCriterion = async () => {
    if (!peerFormData.title) {
      alert("Titel is verplicht");
      return;
    }
    if (!selectedSubjectId) {
      alert("Selecteer eerst een sectie");
      return;
    }

    try {
      await createPeerCriterion({
        ...peerFormData as PeerEvaluationCriterionTemplateCreateDto,
        subject_id: selectedSubjectId,
      });
      setIsCreatingPeerCriterion(false);
      setPeerFormData({
        omza_category: "organiseren",
        title: "",
        description: "",
        level_descriptors: { "1": "", "2": "", "3": "", "4": "", "5": "" },
        learning_objective_ids: [],
      });
      fetchPeerCriteria();
    } catch (err) {
      console.error("Error creating peer criterion:", err);
      alert("Er is een fout opgetreden bij het aanmaken.");
    }
  };

  const handleUpdatePeerCriterion = async (id: number, data: Partial<PeerEvaluationCriterionTemplateCreateDto>) => {
    try {
      await updatePeerCriterion(id, data);
      setEditingCriterion(null);
      fetchPeerCriteria();
    } catch (err) {
      console.error("Error updating peer criterion:", err);
      alert("Er is een fout opgetreden bij het bijwerken.");
    }
  };

  const handleDeletePeerCriterion = async (id: number) => {
    if (!confirm("Weet je zeker dat je dit criterium wilt verwijderen?")) {
      return;
    }
    try {
      await deletePeerCriterion(id);
      fetchPeerCriteria();
    } catch (err) {
      console.error("Error deleting peer criterion:", err);
      alert("Er is een fout opgetreden bij het verwijderen.");
    }
  };

  const toggleCriterionExpand = (id: number) => {
    setExpandedCriterion(expandedCriterion === id ? null : id);
    setEditingCriterion(null);
  };

  const updateURL = (subjectId: number | null, tab: TabType) => {
    const params = new URLSearchParams();
    if (subjectId) params.set("subjectId", subjectId.toString());
    params.set("tab", tab);
    router.push(`/teacher/admin/templates?${params.toString()}`);
  };

  const handleSubjectChange = (subjectId: number) => {
    setSelectedSubjectId(subjectId);
    updateURL(subjectId, activeTab);
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    updateURL(selectedSubjectId, tab);
  };

  const renderTabContent = () => {
    // Competencies are school-wide and don't require a subject selection
    if (activeTab === "competencies") {
      return (
        <div className="p-6">
          <div className="space-y-6">
            {/* Header and description */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  Beheer competentie templates met niveau descriptoren per categorie
                </p>
              </div>
              <Link
                href="/teacher/competencies/create"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                <span>+</span> Nieuwe Competentie
              </Link>
            </div>

            {/* Category Filter Pills */}
            {competencyTree && competencyTree.categories.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setSelectedCategoryFilter("all")}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    selectedCategoryFilter === "all"
                      ? "bg-sky-100 text-sky-700 border-sky-300"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  Alle ({competencyTree.categories.reduce((acc: number, cat: CompetencyCategoryTreeItem) => acc + cat.competencies.length, 0)})
                </button>
                {competencyTree.categories.map((category: CompetencyCategoryTreeItem) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategoryFilter(category.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      selectedCategoryFilter === category.id
                        ? "bg-sky-100 text-sky-700 border-sky-300"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {category.name} ({category.competencies.length})
                  </button>
                ))}
              </div>
            )}

            {/* Loading state */}
            {loadingCompetencies && (
              <div className="text-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                <p className="mt-2 text-sm text-gray-500">Competenties laden...</p>
              </div>
            )}

            {/* No data state */}
            {!loadingCompetencies && (!competencyTree || competencyTree.categories.length === 0) && (
              <div className="text-center py-12 border rounded-xl bg-gray-50">
                <p className="text-gray-500 mb-4">Nog geen competenties aangemaakt.</p>
                <Link
                  href="/teacher/competencies/create"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  <span>+</span> Eerste Competentie Aanmaken
                </Link>
              </div>
            )}

            {/* Category Sections */}
            {!loadingCompetencies && filteredCategories.length > 0 && (
              <div className="space-y-8">
                {filteredCategories.map((category: CompetencyCategoryTreeItem) => (
                  <div key={category.id} className="space-y-3">
                    {/* Category Header */}
                    <div className="flex items-center gap-3 px-1">
                      {category.color && (
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: category.color }}
                        />
                      )}
                      <h3 className="text-lg font-semibold text-gray-800">
                        {category.name}
                        <span className="ml-2 text-sm font-normal text-gray-500">
                          ({category.competencies.length})
                        </span>
                      </h3>
                    </div>
                    {category.description && (
                      <p className="text-sm text-gray-500 px-1 -mt-1">
                        {category.description}
                      </p>
                    )}

                    {/* Competency Cards Grid */}
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {category.competencies.map((competency: CompetencyTreeItem) => (
                        <Link
                          key={competency.id}
                          href={`/teacher/competencies/${competency.id}`}
                          className="p-4 border rounded-xl bg-white hover:shadow-md hover:border-gray-300 transition-all group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                                {competency.name}
                              </h4>
                              {competency.description && (
                                <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                  {competency.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 flex items-center text-xs text-gray-400">
                            <span>Klik om te bewerken →</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (!selectedSubjectId) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              Geen sectie geselecteerd
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Kies eerst een sectie/vakgebied om templates te beheren.
            </p>
          </div>
        </div>
      );
    }

    const selectedSubject = subjects.find((s: Subject) => s.id === selectedSubjectId);

    return (
      <div className="p-6">
        <div className="mb-4 text-sm text-gray-600">
          Templates voor:{" "}
          <span className="font-semibold">{selectedSubject?.name}</span>
        </div>

        {/* Tab-specific content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {TABS.find((t) => t.key === activeTab)?.label}
          </h3>

          {activeTab === "peer" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Beheer templates voor peer evaluatie criteria (OMZA:
                Organiseren, Meedoen, Zelfvertrouwen, Autonomie)
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-blue-900 mb-2">OMZA Categorieën:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• <strong>Organiseren</strong> - Planning, tijdmanagement, structuur</li>
                  <li>• <strong>Meedoen</strong> - Participatie, samenwerking, bijdrage</li>
                  <li>• <strong>Zelfvertrouwen</strong> - Initiatief, verantwoordelijkheid</li>
                  <li>• <strong>Autonomie</strong> - Zelfstandigheid, reflectie</li>
                </ul>
                <p className="text-xs text-blue-700 mt-2">Elk criterium heeft 5 niveaus en kan gekoppeld worden aan leerdoelen</p>
              </div>

              {loadingPeerCriteria ? (
                <div className="text-center py-8 text-gray-500">
                  <p>Criteria laden...</p>
                </div>
              ) : (
                <>
                  {/* Create new criterion form */}
                  {isCreatingPeerCriterion && (
                    <div className="bg-white border-2 border-blue-500 rounded-lg p-4 mb-4">
                      <h4 className="font-semibold mb-3">Nieuw Criterium</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            OMZA Categorie
                          </label>
                          <select
                            value={peerFormData.omza_category}
                            onChange={(e) =>
                              setPeerFormData({
                                ...peerFormData,
                                omza_category: e.target.value as any,
                              })
                            }
                            className="w-full px-3 py-2 border rounded"
                          >
                            <option value="organiseren">Organiseren</option>
                            <option value="meedoen">Meedoen</option>
                            <option value="zelfvertrouwen">Zelfvertrouwen</option>
                            <option value="autonomie">Autonomie</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Titel *
                          </label>
                          <input
                            type="text"
                            value={peerFormData.title}
                            onChange={(e) =>
                              setPeerFormData({
                                ...peerFormData,
                                title: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Beschrijving
                          </label>
                          <textarea
                            value={peerFormData.description || ""}
                            onChange={(e) =>
                              setPeerFormData({
                                ...peerFormData,
                                description: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border rounded"
                            rows={2}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Niveaubeschrijvingen (1-5)
                          </label>
                          <div className="grid grid-cols-5 gap-2">
                            {[1, 2, 3, 4, 5].map((level) => (
                              <div key={level} className="flex flex-col">
                                <label className="text-xs font-medium text-gray-700 mb-1">
                                  Niveau {level}
                                </label>
                                <textarea
                                  placeholder={`Niveau ${level}`}
                                  value={peerFormData.level_descriptors?.[level.toString() as "1" | "2" | "3" | "4" | "5"] || ""}
                                  onChange={(e) =>
                                    setPeerFormData({
                                      ...peerFormData,
                                      level_descriptors: {
                                        ...peerFormData.level_descriptors,
                                        [level.toString()]: e.target.value,
                                      } as any,
                                    })
                                  }
                                  className="w-full px-2 py-1 border rounded text-sm resize-y min-h-[80px]"
                                  rows={4}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Leerdoelen koppelen
                          </label>
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setPeerFormData({ ...peerFormData, _filterPhase: "onderbouw" })}
                                className={`px-3 py-1 text-sm rounded ${
                                  peerFormData._filterPhase === "onderbouw"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                }`}
                              >
                                Onderbouw
                              </button>
                              <button
                                type="button"
                                onClick={() => setPeerFormData({ ...peerFormData, _filterPhase: "bovenbouw" })}
                                className={`px-3 py-1 text-sm rounded ${
                                  peerFormData._filterPhase === "bovenbouw"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                }`}
                              >
                                Bovenbouw
                              </button>
                            </div>
                            {peerFormData._filterPhase && (
                              <select
                                value=""
                                onChange={(e) => {
                                  const id = parseInt(e.target.value);
                                  if (id && !peerFormData.learning_objective_ids.includes(id)) {
                                    setPeerFormData({
                                      ...peerFormData,
                                      learning_objective_ids: [...peerFormData.learning_objective_ids, id],
                                    });
                                  }
                                }}
                                className="w-full px-3 py-2 border rounded"
                              >
                                <option value="">Selecteer een leerdoel...</option>
                                {learningObjectives
                                  .filter((obj) => obj.phase === peerFormData._filterPhase)
                                  .map((obj) => (
                                    <option key={obj.id} value={obj.id}>
                                      {obj.domain || ""} {obj.order} - {obj.title}
                                    </option>
                                  ))}
                              </select>
                            )}
                            {peerFormData.learning_objective_ids.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {peerFormData.learning_objective_ids.map((id) => {
                                  const obj = learningObjectives.find((o) => o.id === id);
                                  return (
                                    <span
                                      key={id}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                                    >
                                      {obj ? `${obj.domain || ""} ${obj.order} - ${obj.title}` : `ID: ${id}`}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setPeerFormData({
                                            ...peerFormData,
                                            learning_objective_ids: peerFormData.learning_objective_ids.filter(
                                              (objId) => objId !== id
                                            ),
                                          })
                                        }
                                        className="text-blue-600 hover:text-blue-800"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={handleCreatePeerCriterion}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Opslaan
                          </button>
                          <button
                            onClick={() => setIsCreatingPeerCriterion(false)}
                            className="px-4 py-2 border rounded hover:bg-gray-50"
                          >
                            Annuleren
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* List of criteria by category */}
                  {["organiseren", "meedoen", "zelfvertrouwen", "autonomie"].map((category) => {
                    const categoryCriteria = peerCriteria.filter(
                      (c) => c.omza_category === category
                    );
                    if (categoryCriteria.length === 0) return null;

                    return (
                      <div key={category} className="mb-6">
                        <h4 className="font-semibold text-lg mb-2 capitalize">
                          {category}
                        </h4>
                        <div className="space-y-2">
                          {categoryCriteria.map((criterion) => (
                            <div
                              key={criterion.id}
                              className="border rounded-lg overflow-hidden"
                            >
                              {/* Criterion header - clickable to expand */}
                              <div
                                onClick={() => toggleCriterionExpand(criterion.id)}
                                className="bg-white p-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center"
                              >
                                <div className="flex-1">
                                  <h5 className="font-medium">{criterion.title}</h5>
                                  {criterion.description && (
                                    <p className="text-sm text-gray-600 mt-1">
                                      {criterion.description}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">
                                    {criterion.learning_objective_ids.length} leerdoel(en)
                                  </span>
                                  <svg
                                    className={`w-5 h-5 transition-transform ${
                                      expandedCriterion === criterion.id
                                        ? "rotate-180"
                                        : ""
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                </div>
                              </div>

                              {/* Expanded content */}
                              {expandedCriterion === criterion.id && (
                                <div className="bg-gray-50 p-4 border-t">
                                  {editingCriterion === criterion.id ? (
                                    <div className="space-y-3">
                                      <div>
                                        <label className="block text-sm font-medium mb-1">
                                          Titel
                                        </label>
                                        <input
                                          type="text"
                                          defaultValue={criterion.title}
                                          id={`edit-title-${criterion.id}`}
                                          className="w-full px-3 py-2 border rounded"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium mb-2">
                                          Niveaubeschrijvingen
                                        </label>
                                        <div className="grid grid-cols-5 gap-2">
                                          {[1, 2, 3, 4, 5].map((level) => (
                                            <div key={level} className="flex flex-col">
                                              <label className="text-xs font-medium text-gray-700 mb-1">
                                                Niveau {level}
                                              </label>
                                              <textarea
                                                defaultValue={
                                                  criterion.level_descriptors[
                                                    level.toString() as "1" | "2" | "3" | "4" | "5"
                                                  ] || ""
                                                }
                                                id={`edit-level-${criterion.id}-${level}`}
                                                className="w-full px-2 py-1 border rounded text-sm resize-y min-h-[80px]"
                                                rows={4}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium mb-2">
                                          Leerdoelen koppelen
                                        </label>
                                        <div className="space-y-2">
                                          <div className="flex gap-2">
                                            <button
                                              type="button"
                                              onClick={() => setEditFilterPhase("onderbouw")}
                                              className={`px-3 py-1 text-sm rounded ${
                                                editFilterPhase === "onderbouw"
                                                  ? "bg-blue-600 text-white"
                                                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                              }`}
                                            >
                                              Onderbouw
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setEditFilterPhase("bovenbouw")}
                                              className={`px-3 py-1 text-sm rounded ${
                                                editFilterPhase === "bovenbouw"
                                                  ? "bg-blue-600 text-white"
                                                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                              }`}
                                            >
                                              Bovenbouw
                                            </button>
                                          </div>
                                          {editFilterPhase && (
                                            <select
                                              value=""
                                              onChange={(e) => {
                                                const id = parseInt(e.target.value);
                                                if (id && !editLearningObjectiveIds.includes(id)) {
                                                  setEditLearningObjectiveIds([...editLearningObjectiveIds, id]);
                                                }
                                              }}
                                              className="w-full px-3 py-2 border rounded"
                                            >
                                              <option value="">Selecteer een leerdoel...</option>
                                              {learningObjectives
                                                .filter((obj) => obj.phase === editFilterPhase)
                                                .map((obj) => (
                                                  <option key={obj.id} value={obj.id}>
                                                    {obj.domain || ""} {obj.order} - {obj.title}
                                                  </option>
                                                ))}
                                            </select>
                                          )}
                                          {editLearningObjectiveIds.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                              {editLearningObjectiveIds.map((id) => {
                                                const obj = learningObjectives.find((o) => o.id === id);
                                                return (
                                                  <span
                                                    key={id}
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                                                  >
                                                    {obj ? `${obj.domain || ""} ${obj.order} - ${obj.title}` : `ID: ${id}`}
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        setEditLearningObjectiveIds(
                                                          editLearningObjectiveIds.filter((objId) => objId !== id)
                                                        )
                                                      }
                                                      className="text-blue-600 hover:text-blue-800"
                                                    >
                                                      ×
                                                    </button>
                                                  </span>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => {
                                            const titleEl = document.getElementById(
                                              `edit-title-${criterion.id}`
                                            ) as HTMLInputElement;
                                            const levels: any = {};
                                            [1, 2, 3, 4, 5].forEach((level) => {
                                              const el = document.getElementById(
                                                `edit-level-${criterion.id}-${level}`
                                              ) as HTMLInputElement;
                                              levels[level.toString()] = el.value;
                                            });
                                            handleUpdatePeerCriterion(criterion.id, {
                                              title: titleEl.value,
                                              level_descriptors: levels,
                                              learning_objective_ids: editLearningObjectiveIds,
                                            });
                                          }}
                                          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                        >
                                          Opslaan
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingCriterion(null);
                                            setEditFilterPhase(undefined);
                                            setEditLearningObjectiveIds([]);
                                          }}
                                          className="px-3 py-1.5 border text-sm rounded hover:bg-gray-100"
                                        >
                                          Annuleren
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="mb-4">
                                        <h6 className="font-medium text-sm mb-2">
                                          Niveaubeschrijvingen:
                                        </h6>
                                        <div className="grid grid-cols-5 gap-3">
                                          {[1, 2, 3, 4, 5].map((level) => (
                                            <div key={level} className="border rounded p-2 bg-white">
                                              <div className="text-xs font-semibold text-gray-700 mb-1">
                                                Niveau {level}
                                              </div>
                                              <div className="text-sm text-gray-800">
                                                {criterion.level_descriptors[
                                                  level.toString() as "1" | "2" | "3" | "4" | "5"
                                                ] || <em className="text-gray-400">Niet ingevuld</em>}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="mb-4">
                                        <h6 className="font-medium text-sm mb-2">
                                          Gekoppelde leerdoelen:
                                        </h6>
                                        {criterion.learning_objective_ids.length > 0 ? (
                                          <div className="flex flex-wrap gap-1">
                                            {criterion.learning_objective_ids.map((id) => {
                                              const obj = learningObjectives.find((o) => o.id === id);
                                              return (
                                                <span
                                                  key={id}
                                                  className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                                                >
                                                  {obj ? `${obj.domain || ""} ${obj.order} - ${obj.title}` : `ID: ${id}`}
                                                </span>
                                              );
                                            })}
                                          </div>
                                        ) : (
                                          <p className="text-sm text-gray-500">
                                            Geen leerdoelen gekoppeld
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => {
                                            setEditingCriterion(criterion.id);
                                            setEditLearningObjectiveIds(criterion.learning_objective_ids);
                                            setEditFilterPhase(undefined);
                                          }}
                                          className="px-3 py-1.5 bg-gray-100 text-sm rounded hover:bg-gray-200"
                                        >
                                          Bewerken
                                        </button>
                                        <button
                                          onClick={() => handleDeletePeerCriterion(criterion.id)}
                                          className="px-3 py-1.5 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200"
                                        >
                                          Verwijderen
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {peerCriteria.length === 0 && !isCreatingPeerCriterion && (
                    <div className="text-center py-8 text-gray-500">
                      <p>Nog geen criteria aangemaakt voor dit vak.</p>
                      <p className="text-xs mt-2">
                        Klik op &quot;+ Nieuw Peerevaluatie Criterium&quot; om te beginnen.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "rubrics" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Beheer projectrubric templates met criteria voor projectproces,
                eindresultaat en communicatie
              </p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-green-900 mb-2">Categorieën:</h4>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>• <strong>Projectproces</strong> - Planning, uitvoering, samenwerking</li>
                  <li>• <strong>Eindresultaat</strong> - Kwaliteit, volledigheid, innovatie</li>
                  <li>• <strong>Communicatie</strong> - Presentatie, rapportage, reflectie</li>
                </ul>
                <p className="text-xs text-green-700 mt-2">Elk criterium heeft 5 niveaus en kan gekoppeld worden aan leerdoelen</p>
              </div>
              <div className="text-center py-8 text-gray-500">
                <p className="mb-4">Project rubric templates worden hier weergegeven</p>
                <p className="text-xs">API Endpoint: GET /api/v1/templates/project-rubrics?subject_id={selectedSubjectId}</p>
              </div>
            </div>
          )}

          {activeTab === "mail" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Beheer email templates met variabelen voor verschillende
                communicatiemomenten
              </p>
              <div className="text-center py-8 text-gray-500">
                <p className="mb-4">Mail templates worden hier weergegeven</p>
                <p className="text-xs">API Endpoint: GET /api/v1/templates/mail-templates?subject_id={selectedSubjectId}</p>
              </div>
            </div>
          )}

          {activeTab === "objectives" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Beheer leerdoelen en eindtermen die gekoppeld kunnen worden aan
                criteria
              </p>

              {loadingObjectives ? (
                <div className="text-center py-8">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                  <p className="mt-2 text-sm text-gray-500">Laden...</p>
                </div>
              ) : learningObjectives.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Domein
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Nummer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Titel
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Fase
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {learningObjectives.map((obj) => (
                        <tr key={obj.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium">
                            {obj.domain || "-"}
                          </td>
                          <td className="px-6 py-4 text-sm">{obj.order}</td>
                          <td className="px-6 py-4 text-sm">{obj.title}</td>
                          <td className="px-6 py-4 text-sm">
                            {obj.phase ? (
                              <span
                                className={`px-2 py-1 rounded text-xs ${
                                  obj.phase === "onderbouw"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-purple-100 text-purple-800"
                                }`}
                              >
                                {obj.phase === "onderbouw"
                                  ? "Onderbouw"
                                  : "Bovenbouw"}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="mb-4">Nog geen leerdoelen aangemaakt</p>
                  <p className="text-xs">
                    Klik op "+ Nieuw Leerdoel" om te beginnen
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "remarks" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Beheer standaardopmerkingen bibliotheek voor snelle feedback
              </p>
              <div className="text-center py-8 text-gray-500">
                <p className="mb-4">Standard remarks worden hier weergegeven</p>
                <p className="text-xs">API Endpoint: GET /api/v1/templates/standard-remarks?subject_id={selectedSubjectId}</p>
              </div>
            </div>
          )}

          {activeTab === "tags" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Beheer tags voor categorisatie van templates
              </p>
              <div className="text-center py-8 text-gray-500">
                <p className="mb-4">Template tags worden hier weergegeven</p>
                <p className="text-xs">API Endpoint: GET /api/v1/templates/tags?subject_id={selectedSubjectId}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const getNewButtonLabel = () => {
    switch (activeTab) {
      case "peer":
        return "+ Nieuw Peerevaluatie Criterium";
      case "rubrics":
        return "+ Nieuwe Projectrubric";
      case "competencies":
        return "+ Nieuwe Competentie";
      case "mail":
        return "+ Nieuwe Mail-template";
      case "objectives":
        return "+ Nieuw Leerdoel";
      case "remarks":
        return "+ Nieuwe Standaardopmerking";
      case "tags":
        return "+ Nieuwe Tag";
      default:
        return "+ Nieuw Item";
    }
  };

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              Templates
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              Beheer sjablonen per sectie/vakgebied.
            </p>
          </div>
          {selectedSubjectId && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (activeTab === "objectives") {
                    openCreateModal();
                  } else if (activeTab === "peer") {
                    setIsCreatingPeerCriterion(true);
                    setPeerFormData({
                      omza_category: "organiseren",
                      title: "",
                      description: "",
                      level_descriptors: { "1": "", "2": "", "3": "", "4": "", "5": "" },
                      learning_objective_ids: [],
                    });
                  } else {
                    // TODO: Implement create modal/form for other template types
                    alert(
                      `Create new ${TABS.find((t) => t.key === activeTab)?.label}`
                    );
                  }
                }}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                {getNewButtonLabel()}
              </button>
              {activeTab === "objectives" && (
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Importeer CSV
                </button>
              )}
            </div>
          )}
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Subject Selector */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 mb-6">
          <label
            htmlFor="subject-select"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Selecteer Sectie / Vakgebied
          </label>
          {loading ? (
            <div className="animate-pulse h-10 bg-gray-200 rounded"></div>
          ) : (
            <select
              id="subject-select"
              value={selectedSubjectId || ""}
              onChange={(e) =>
                handleSubjectChange(
                  e.target.value ? parseInt(e.target.value) : 0
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Kies een sectie --</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name} ({subject.code})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`
                    px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                    ${
                      activeTab === tab.key
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }
                  `}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          {renderTabContent()}
        </div>
      </div>

      {/* Create Learning Objective Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Nieuw Leerdoel</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Domein
                </label>
                <input
                  type="text"
                  value={formData.domain || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, domain: e.target.value })
                  }
                  placeholder="A, B, C, D, E"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nummer</label>
                <input
                  type="number"
                  value={formData.order || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      order: parseInt(e.target.value, 10),
                    })
                  }
                  placeholder="9, 11, 13, 14, 16..."
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Titel *
                </label>
                <input
                  type="text"
                  value={formData.title || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Conceptontwikkeling"
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Beschrijving
                </label>
                <textarea
                  value={formData.description || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Ontwerprichtingen genereren en onderbouwen"
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Fase</label>
                <select
                  value={formData.phase || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, phase: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">Niet gespecificeerd</option>
                  <option value="onderbouw">Onderbouw</option>
                  <option value="bovenbouw">Bovenbouw</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleCreateObjective}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Aanmaken
              </button>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Learning Objective Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              Importeer Leerdoelen (CSV)
            </h2>
            <p className="text-sm text-gray-600 mb-2">
              <strong>Let op:</strong> Deze leerdoelen worden toegevoegd aan het geselecteerde
              subject ({subjects.find((s) => s.id === selectedSubjectId)?.name}).
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Formaat: domein,nummer,titel,beschrijving,fase
              <br />
              Bijvoorbeeld: D,9,Conceptontwikkeling,Ontwerprichtingen genereren en
              onderbouwen,onderbouw
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Plak CSV-gegevens hier..."
              className="w-full px-3 py-2 border rounded font-mono text-sm"
              rows={10}
            />
            {importResult && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
                <p className="font-medium">Resultaat:</p>
                <p>Aangemaakt: {importResult.created}</p>
                <p>Bijgewerkt: {importResult.updated}</p>
                {importResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium text-red-600">Fouten:</p>
                    <ul className="list-disc list-inside text-sm">
                      {importResult.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleImport}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Importeren
              </button>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportText("");
                  setImportResult(null);
                }}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
