"use client";

import api from "@/lib/api";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import RubricEditor, { type CriterionItem } from "@/components/teacher/RubricEditor";
import { subjectService } from "@/services/subject.service";
import { courseService } from "@/services/course.service";
import { listPeerCriteria } from "@/services/peer-evaluation-criterion-template.service";
import type { Subject } from "@/dtos/subject.dto";
import type { PeerEvaluationCriterionTemplateDto } from "@/dtos/peer-evaluation-criterion-template.dto";

// Types (optioneel importeren uit je lib/types):
type RubricOut = {
  id: number;
  title: string;
  scale_min: number;
  scale_max: number;
  scope?: string;
  target_level?: "onderbouw" | "bovenbouw" | null;
};
type CriterionOut = {
  id: number;
  rubric_id: number;
  name: string;
  weight: number;
  category?: string | null;
  order?: number | null;
  descriptors: {
    level1?: string;
    level2?: string;
    level3?: string;
    level4?: string;
    level5?: string;
  };
  learning_objective_ids?: number[];
};

const EMPTY_DESC = {
  level1: "",
  level2: "",
  level3: "",
  level4: "",
  level5: "",
};

export default function EditRubricPageInner() {
  const { rubricId } = useParams<{ rubricId: string }>();
  const router = useRouter();

  const [rubric, setRubric] = useState<RubricOut | null>(null);
  const [items, setItems] = useState<CriterionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Template import modal state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [peerCriteria, setPeerCriteria] = useState<PeerEvaluationCriterionTemplateDto[]>([]);
  const [selectedCriteriaIds, setSelectedCriteriaIds] = useState<number[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingCriteria, setLoadingCriteria] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [r, c] = await Promise.all([
          api.get<RubricOut>(`/rubrics/${rubricId}`),
          api.get<CriterionOut[]>(`/rubrics/${rubricId}/criteria`),
        ]);
        if (!mounted) return;
        setRubric(r.data);
        setItems(
          (c.data || []).map((ci) => ({
            id: ci.id,
            name: ci.name,
            weight: ci.weight,
            category: ci.category ?? null,
            order: ci.order ?? null,
            descriptors: { ...EMPTY_DESC, ...(ci.descriptors || {}) },
            learning_objective_ids: ci.learning_objective_ids || [],
          })),
        );
      } catch (e: unknown) {
        const err = e as { response?: { data?: { detail?: string } }; message?: string };
        setError(err?.response?.data?.detail || err?.message || "Laden mislukt");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [rubricId]);

  // Load subjects based on teacher's courses when modal opens and auto-select first one
  useEffect(() => {
    if (!showTemplateModal) return;
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
        
        // Auto-select first subject if we have subjects
        if (teacherSubjects.length > 0 && !selectedSubjectId) {
          setSelectedSubjectId(teacherSubjects[0].id);
        }
      } catch (err) {
        console.error("Failed to load subjects:", err);
      } finally {
        setLoadingSubjects(false);
      }
    }
    loadTeacherSubjects();
  }, [showTemplateModal]);

  // Load peer criteria when subject changes
  useEffect(() => {
    async function loadCriteria() {
      if (!selectedSubjectId) {
        setPeerCriteria([]);
        return;
      }
      setLoadingCriteria(true);
      try {
        const criteria = await listPeerCriteria(selectedSubjectId);
        setPeerCriteria(criteria);
      } catch (err) {
        console.error("Failed to load peer criteria:", err);
      } finally {
        setLoadingCriteria(false);
      }
    }
    loadCriteria();
  }, [selectedSubjectId]);

  const importSelectedCriteria = () => {
    const selectedTemplates = peerCriteria.filter(c => selectedCriteriaIds.includes(c.id));
    
    // Map OMZA category to proper category format
    const categoryMap: Record<string, string> = {
      "organiseren": "Organiseren",
      "meedoen": "Meedoen",
      "zelfvertrouwen": "Zelfvertrouwen",
      "autonomie": "Autonomie",
    };

    const maxOrder = items.reduce((m, it) => Math.max(m, it.order ?? 0), 0);

    const newItems: CriterionItem[] = selectedTemplates.map((template, idx) => ({
      name: template.title,
      weight: 1.0 / (items.length + selectedTemplates.length), // Adjust weight
      category: categoryMap[template.omza_category] || template.omza_category,
      order: maxOrder + idx + 1,
      descriptors: {
        level1: template.level_descriptors["1"] || "",
        level2: template.level_descriptors["2"] || "",
        level3: template.level_descriptors["3"] || "",
        level4: template.level_descriptors["4"] || "",
        level5: template.level_descriptors["5"] || "",
      },
      learning_objective_ids: template.learning_objective_ids || [],
    }));

    setItems([...items, ...newItems]);
    setShowTemplateModal(false);
    setSelectedCriteriaIds([]);
    setSelectedSubjectId(null);
    setInfo(`${newItems.length} criterium/criteria toegevoegd. Vergeet niet op te slaan!`);
    setTimeout(() => setInfo(null), 4000);
  };



  async function saveAll() {
    if (!rubric) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const payload = {
        items: items.map((it, i) => ({
          id: it.id ?? undefined,
          name: it.name?.trim() || `Criterium ${i + 1}`,
          weight: Number(it.weight) || 1.0,
          category: it.category ?? null,
          order: it.order ?? i + 1,
          descriptors: {
            level1: it.descriptors?.level1 ?? "",
            level2: it.descriptors?.level2 ?? "",
            level3: it.descriptors?.level3 ?? "",
            level4: it.descriptors?.level4 ?? "",
            level5: it.descriptors?.level5 ?? "",
          },
          learning_objective_ids: it.learning_objective_ids || [],
        })),
      };
      const res = await api.put(
        `/rubrics/${rubric.id}/criteria/batch`,
        payload,
      );
      // reflecteer response
      const back = (res.data?.items || []) as CriterionOut[];
      setItems(
        back.map((ci, i) => ({
          id: ci.id,
          name: ci.name,
          weight: ci.weight,
          category: ci.category ?? null,
          order: ci.order ?? i + 1,
          descriptors: { ...EMPTY_DESC, ...(ci.descriptors || {}) },
        })),
      );
      setInfo("Opgeslagen ✔");
      setTimeout(() => setInfo(null), 1800);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(err?.response?.data?.detail || err?.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  async function duplicateRubric() {
    if (!rubric) return;
    try {
      const res = await api.post(`/rubrics/${rubric.id}/duplicate`);
      const newId = res.data?.id;
      if (newId) router.replace(`/teacher/rubrics/${newId}/edit`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      alert(err?.response?.data?.detail || err?.message || "Dupliceren mislukt");
    }
  }
  async function deleteRubric() {
    if (!rubric) return;
    if (!confirm("Weet je zeker dat je deze rubric wilt verwijderen?")) return;
    try {
      await api.delete(`/rubrics/${rubric.id}`);
      router.replace("/teacher/rubrics");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      alert(err?.response?.data?.detail || err?.message || "Verwijderen mislukt");
    }
  }

  if (loading) return <main className="p-6">Laden…</main>;

  const isPeerRubric = rubric?.scope === "peer";

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-7xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              Rubric bewerken
            </h1>
            {rubric && (
              <p className="text-gray-600 mt-1 text-sm">
                {rubric.title} · schaal {rubric.scale_min}–{rubric.scale_max}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a 
              href="/teacher/rubrics" 
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm"
            >
              Terug
            </a>
            {isPeerRubric && (
              <button
                onClick={() => setShowTemplateModal(true)}
                className="px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-blue-600 hover:bg-blue-50 text-sm font-medium shadow-sm"
              >
                + Uit template
              </button>
            )}
            <button
              onClick={duplicateRubric}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm"
            >
              Dupliceer
            </button>
            <button
              onClick={deleteRubric}
              className="px-3 py-1.5 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 text-sm font-medium shadow-sm"
            >
              Verwijder
            </button>
            <button
              onClick={saveAll}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium shadow-sm disabled:opacity-60"
            >
              {saving ? "Opslaan…" : "Opslaan"}
            </button>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700">{error}</div>
        )}
        {info && (
          <div className="p-3 rounded-lg bg-green-50 text-green-700">{info}</div>
        )}

        {rubric && (
          <RubricEditor
            scope={(rubric.scope as "peer" | "project") || "peer"}
            targetLevel={rubric.target_level || null}
            items={items}
            onItemsChange={setItems}
          />
        )}
      </main>

      {/* Template Import Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Criteria uit template importeren</h2>
              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  setSelectedCriteriaIds([]);
                  setSelectedSubjectId(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>

            {/* Subject selector */}
            <div className="space-y-2 mb-4">
              <label className="block text-sm font-medium">Vakgebied / Sectie</label>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={selectedSubjectId || ""}
                onChange={(e) => {
                  setSelectedSubjectId(e.target.value ? parseInt(e.target.value) : null);
                  setSelectedCriteriaIds([]);
                }}
                disabled={loadingSubjects}
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name} ({subject.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Criteria multi-select dropdown */}
            {selectedSubjectId && (
              <div className="space-y-2">
                <label className="block text-sm font-medium">Beschikbare criteria</label>
                
                {loadingCriteria ? (
                  <div className="p-4 text-center text-gray-500 text-sm">Criteria laden...</div>
                ) : peerCriteria.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm border rounded-lg bg-gray-50">
                    Geen criteria templates gevonden voor dit vakgebied.
                  </div>
                ) : (
                  <>
                    <select
                      multiple
                      className="w-full border rounded-lg px-3 py-2 min-h-[200px]"
                      value={selectedCriteriaIds.map(String)}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                        setSelectedCriteriaIds(selected);
                      }}
                    >
                      {["organiseren", "meedoen", "zelfvertrouwen", "autonomie"].map((category) => {
                        const categoryCriteria = peerCriteria.filter(c => c.omza_category === category);
                        if (categoryCriteria.length === 0) return null;
                        
                        return (
                          <optgroup key={category} label={category.charAt(0).toUpperCase() + category.slice(1)}>
                            {categoryCriteria.map((criterion) => (
                              <option key={criterion.id} value={criterion.id}>
                                {criterion.title}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                    <p className="text-xs text-gray-500">
                      Houd Ctrl (Windows) of Cmd (Mac) ingedrukt om meerdere criteria te selecteren.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={importSelectedCriteria}
                disabled={selectedCriteriaIds.length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selectedCriteriaIds.length === 0
                  ? "Selecteer criteria om te importeren"
                  : `${selectedCriteriaIds.length} criterium/criteria toevoegen`}
              </button>
              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  setSelectedCriteriaIds([]);
                  setSelectedSubjectId(null);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
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
