"use client";
import api from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import type { RubricCreate } from "@/lib/rubric-types";
import { subjectService } from "@/services/subject.service";
import { courseService } from "@/services/course.service";
import { listPeerCriteria } from "@/services/peer-evaluation-criterion-template.service";
import { listProjectRubricCriteria } from "@/services/project-rubric-criterion-template.service";
import type { Subject } from "@/dtos/subject.dto";
import type { PeerEvaluationCriterionTemplateDto } from "@/dtos/peer-evaluation-criterion-template.dto";
import type { ProjectRubricCriterionTemplateDto } from "@/dtos/project-rubric-criterion-template.dto";

export default function CreateRubricPageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const fromDupId = sp.get("duplicate_of");
  const scopeParam = sp.get("scope") as "peer" | "project" | null;
  const subjectIdParam = sp.get("subjectId");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scaleMin, setScaleMin] = useState(1);
  const [scaleMax, setScaleMax] = useState(5);
  const [scope, setScope] = useState<"peer" | "project">(scopeParam || "peer");
  const [targetLevel, setTargetLevel] = useState<"onderbouw" | "bovenbouw" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subject and criteria state
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    subjectIdParam ? parseInt(subjectIdParam) : null
  );
  const [peerCriteria, setPeerCriteria] = useState<PeerEvaluationCriterionTemplateDto[]>([]);
  const [projectCriteria, setProjectCriteria] = useState<ProjectRubricCriterionTemplateDto[]>([]);
  const [selectedCriteriaIds, setSelectedCriteriaIds] = useState<number[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingCriteria, setLoadingCriteria] = useState(false);
  
  // Multi-select dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scopeParam) {
      setScope(scopeParam);
    }
  }, [scopeParam]);

  // Click outside handler for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Load subjects based on teacher's courses and auto-select first one
  useEffect(() => {
    async function loadTeacherSubjects() {
      setLoadingSubjects(true);
      try {
        // Get the teacher's courses (API filters by logged-in teacher)
        const coursesResponse = await courseService.listCourses({ per_page: 100, is_active: true });
        const courses = coursesResponse.courses;
        
        // Extract unique subject IDs from the teacher's courses
        const teacherSubjectIds = [...new Set(
          courses
            .map(c => c.subject_id)
            .filter((id): id is number => id !== undefined && id !== null)
        )];
        
        // Get all subjects and filter to only show teacher's subjects
        const subjectsResponse = await subjectService.listSubjects({ per_page: 100, is_active: true });
        const teacherSubjects = subjectsResponse.subjects.filter(
          subject => teacherSubjectIds.includes(subject.id)
        );
        
        setSubjects(teacherSubjects);
        
        // Auto-select first subject if none selected and we have subjects
        if (!selectedSubjectId && teacherSubjects.length > 0) {
          setSelectedSubjectId(teacherSubjects[0].id);
        }
      } catch (err) {
        console.error("Failed to load subjects:", err);
      } finally {
        setLoadingSubjects(false);
      }
    }
    loadTeacherSubjects();
  }, []);

  // Load criteria when subject changes based on scope
  useEffect(() => {
    async function loadCriteria() {
      if (!selectedSubjectId) {
        setPeerCriteria([]);
        setProjectCriteria([]);
        setSelectedCriteriaIds([]);
        return;
      }
      setLoadingCriteria(true);
      try {
        if (scope === "peer") {
          // Filter by target_level if selected
          const criteria = await listPeerCriteria(selectedSubjectId, {
            target_level: targetLevel,
          });
          setPeerCriteria(criteria);
          setProjectCriteria([]);
        } else {
          // Load project criteria
          const criteria = await listProjectRubricCriteria(selectedSubjectId, {
            target_level: targetLevel,
          });
          setProjectCriteria(criteria);
          setPeerCriteria([]);
        }
        // Reset selected criteria when level or scope changes
        setSelectedCriteriaIds([]);
      } catch (err) {
        console.error("Failed to load criteria:", err);
      } finally {
        setLoadingCriteria(false);
      }
    }
    loadCriteria();
  }, [selectedSubjectId, scope, targetLevel]);

  // Toggle a criterion selection
  const handleCriterionToggle = (criterionId: number) => {
    setSelectedCriteriaIds((prev) => {
      if (prev.includes(criterionId)) {
        return prev.filter((id) => id !== criterionId);
      } else {
        return [...prev, criterionId];
      }
    });
  };

  // Get display text for selected criteria
  const getSelectedCriteriaText = () => {
    if (selectedCriteriaIds.length === 0) {
      return "Selecteer criteria...";
    }
    const criteria = scope === "peer" ? peerCriteria : projectCriteria;
    const names = selectedCriteriaIds
      .map((id) => criteria.find((c) => c.id === id)?.title)
      .filter(Boolean);
    if (names.length <= 2) {
      return names.join(", ");
    }
    return `${names.length} criteria geselecteerd`;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: RubricCreate = {
        title,
        description,
        scale_min: scaleMin,
        scale_max: scaleMax,
        scope,
        target_level: targetLevel || undefined,
        metadata_json: {},
      };
      const res = await api.post("/rubrics", payload);
      const rubricId = res.data?.id;

      if (fromDupId) {
        await api.post(`/rubrics/${fromDupId}/duplicate`);
      }

      // If criteria are selected, add them as rubric criteria
      if (selectedCriteriaIds.length > 0) {
        if (scope === "peer") {
          const selectedTemplates = peerCriteria.filter(c => selectedCriteriaIds.includes(c.id));
          
          // Map OMZA category to proper category format
          const categoryMap: Record<string, string> = {
            "organiseren": "Organiseren",
            "meedoen": "Meedoen",
            "zelfvertrouwen": "Zelfvertrouwen",
            "autonomie": "Autonomie",
          };

          const criteriaItems = selectedTemplates.map((template, idx) => ({
            name: template.title,
            weight: 1.0 / selectedTemplates.length, // Distribute weight evenly
            category: categoryMap[template.omza_category] || template.omza_category,
            order: idx + 1,
            descriptors: {
              level1: template.level_descriptors["1"] || "",
              level2: template.level_descriptors["2"] || "",
              level3: template.level_descriptors["3"] || "",
              level4: template.level_descriptors["4"] || "",
              level5: template.level_descriptors["5"] || "",
            },
            learning_objective_ids: template.learning_objective_ids || [],
          }));

          await api.put(`/rubrics/${rubricId}/criteria/batch`, { items: criteriaItems });
        } else {
          // Project scope
          const selectedTemplates = projectCriteria.filter(c => selectedCriteriaIds.includes(c.id));
          
          // Map project category to proper category format
          const categoryMap: Record<string, string> = {
            "projectproces": "Projectproces",
            "eindresultaat": "Eindresultaat",
            "communicatie": "Communicatie",
          };

          const criteriaItems = selectedTemplates.map((template, idx) => ({
            name: template.title,
            weight: 1.0 / selectedTemplates.length, // Distribute weight evenly
            category: categoryMap[template.category] || template.category,
            order: idx + 1,
            descriptors: {
              level1: template.level_descriptors["1"] || "",
              level2: template.level_descriptors["2"] || "",
              level3: template.level_descriptors["3"] || "",
              level4: template.level_descriptors["4"] || "",
              level5: template.level_descriptors["5"] || "",
            },
            learning_objective_ids: template.learning_objective_ids || [],
          }));

          await api.put(`/rubrics/${rubricId}/criteria/batch`, { items: criteriaItems });
        }
      }

      router.replace(`/teacher/rubrics/${rubricId}/edit`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(err?.response?.data?.detail || err?.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Nieuwe rubric</h1>
        <p className="text-gray-600">
          Maak een rubric aan. Criteria voeg je toe op de volgende pagina.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 bg-white p-5 rounded-2xl border"
      >
        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700">{error}</div>
        )}

        <div className="space-y-1">
          <label className="block text-sm font-medium">Type</label>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={scope}
            onChange={(e) => setScope(e.target.value as "peer" | "project")}
          >
            <option value="peer">Team-evaluatie (peer)</option>
            <option value="project">Projectbeoordeling</option>
          </select>
        </div>

        {/* Subject selector - show for both peer and project scope */}
        <div className="space-y-1">
          <label className="block text-sm font-medium">Vakgebied / Sectie</label>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={selectedSubjectId || ""}
            onChange={(e) => setSelectedSubjectId(e.target.value ? parseInt(e.target.value) : null)}
            disabled={loadingSubjects}
          >
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name} ({subject.code})
              </option>
            ))}
          </select>
        </div>

        {/* Target level dropdown - show for both peer and project scope */}
        <div className="space-y-1">
          <label className="block text-sm font-medium">Niveau (Onderbouw/Bovenbouw)</label>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={targetLevel || ""}
            onChange={(e) => setTargetLevel(e.target.value ? (e.target.value as "onderbouw" | "bovenbouw") : null)}
          >
            <option value="">Geen specifiek niveau</option>
            <option value="onderbouw">Onderbouw</option>
            <option value="bovenbouw">Bovenbouw</option>
          </select>
          <p className="text-xs text-gray-500">
            Hiermee filtert de app automatisch de beschikbare criteria en leerdoelen.
          </p>
        </div>

        {/* Criteria multi-select dropdown - show when subject is selected */}
        {selectedSubjectId && (
          <div className="space-y-2">
            <label className="block text-sm font-medium">Criteria uit templates</label>
            <p className="text-sm text-gray-500">
              Selecteer welke criteria je aan deze rubric wilt toevoegen
            </p>
            
            {loadingCriteria ? (
              <div className="p-4 text-center text-gray-500 text-sm">Criteria laden...</div>
            ) : (scope === "peer" ? peerCriteria : projectCriteria).length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm border rounded-lg bg-gray-50">
                Geen criteria templates gevonden voor dit vakgebied.
              </div>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-left flex justify-between items-center"
                >
                  <span className={selectedCriteriaIds.length === 0 ? "text-gray-500" : ""}>
                    {getSelectedCriteriaText()}
                  </span>
                  <svg
                    className={`w-5 h-5 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    <div className="py-1">
                      {scope === "peer" ? (
                        // Peer criteria categories (OMZA)
                        ["organiseren", "meedoen", "zelfvertrouwen", "autonomie"].map((category) => {
                          const categoryCriteria = peerCriteria.filter(c => c.omza_category.toLowerCase() === category);
                          if (categoryCriteria.length === 0) return null;
                          
                          const categoryLabels: Record<string, string> = {
                            organiseren: "Organiseren",
                            meedoen: "Meedoen",
                            zelfvertrouwen: "Zelfvertrouwen",
                            autonomie: "Autonomie",
                          };
                          
                          return (
                            <div key={category}>
                              <div className="px-3 py-1 bg-gray-100 text-xs font-semibold text-gray-600 uppercase">
                                {categoryLabels[category]}
                              </div>
                              {categoryCriteria.map((criterion) => (
                                <label
                                  key={criterion.id}
                                  className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedCriteriaIds.includes(criterion.id)}
                                    onChange={() => handleCriterionToggle(criterion.id)}
                                    className="mr-3 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm">{criterion.title}</span>
                                </label>
                              ))}
                            </div>
                          );
                        })
                      ) : (
                        // Project criteria categories
                        ["projectproces", "eindresultaat", "communicatie"].map((category) => {
                          const categoryCriteria = projectCriteria.filter(c => c.category.toLowerCase() === category);
                          if (categoryCriteria.length === 0) return null;
                          
                          const categoryLabels: Record<string, string> = {
                            projectproces: "Projectproces",
                            eindresultaat: "Eindresultaat",
                            communicatie: "Communicatie",
                          };
                          
                          return (
                            <div key={category}>
                              <div className="px-3 py-1 bg-gray-100 text-xs font-semibold text-gray-600 uppercase">
                                {categoryLabels[category]}
                              </div>
                              {categoryCriteria.map((criterion) => (
                                <label
                                  key={criterion.id}
                                  className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedCriteriaIds.includes(criterion.id)}
                                    onChange={() => handleCriterionToggle(criterion.id)}
                                    className="mr-3 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                  />
                                  <span className="text-sm">{criterion.title}</span>
                                </label>
                              ))}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            {selectedCriteriaIds.length > 0 && (
              <p className="text-sm text-gray-600">
                {selectedCriteriaIds.length} criterium/criteria geselecteerd - deze worden direct aan de rubric toegevoegd.
              </p>
            )}
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-sm font-medium">Titel</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">
            Omschrijving (optioneel)
          </label>
          <textarea
            className="w-full border rounded-lg px-3 py-2 min-h-24"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
          >
            {saving ? "Opslaan…" : "Opslaan & verder"}
          </button>
          <a href="/teacher/rubrics" className="px-4 py-2 rounded-xl border">
            Annuleer
          </a>
        </div>
      </form>
    </main>
  );
}
