"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { subjectService } from "@/services/subject.service";
import { Subject } from "@/dtos/subject.dto";
import {
  createLearningObjective,
  listLearningObjectives,
} from "@/services/learning-objective.service";
import type {
  LearningObjectiveDto,
  LearningObjectiveCreateDto,
} from "@/dtos/learning-objective.dto";

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
    setLoadingObjectives(true);
    try {
      const response = await listLearningObjectives({
        page: 1,
        limit: 50,
      });
      setLearningObjectives(response.items);
    } catch (err) {
      console.error("Error fetching learning objectives:", err);
    } finally {
      setLoadingObjectives(false);
    }
  };

  const openCreateModal = () => {
    setFormData({
      domain: "",
      title: "",
      description: "",
      order: 0,
      phase: "",
    });
    setIsCreateModalOpen(true);
  };

  const handleCreateObjective = async () => {
    if (!formData.title) {
      alert("Titel is verplicht");
      return;
    }

    try {
      await createLearningObjective(formData);
      setIsCreateModalOpen(false);
      fetchLearningObjectives();
    } catch (err) {
      console.error("Error creating learning objective:", err);
      alert("Er is een fout opgetreden bij het aanmaken van het leerdoel.");
    }
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

    const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);

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
              <div className="text-center py-8 text-gray-500">
                <p className="mb-4">Peer evaluation criteria templates worden hier weergegeven</p>
                <p className="text-xs">API Endpoint: GET /api/v1/templates/peer-criteria?subject_id={selectedSubjectId}</p>
              </div>
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

          {activeTab === "competencies" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Beheer competentie templates met niveau descriptoren en
                reflectievragen
              </p>
              <div className="text-center py-8 text-gray-500">
                <p className="mb-4">Competency templates worden hier weergegeven</p>
                <p className="text-xs">API Endpoint: GET /api/v1/templates/competencies?subject_id={selectedSubjectId}</p>
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
            <button
              onClick={() => {
                if (activeTab === "objectives") {
                  openCreateModal();
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
    </>
  );
}
