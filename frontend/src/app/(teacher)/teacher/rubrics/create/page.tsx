"use client";
import api from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import type { RubricCreate } from "@/lib/rubric-types";
import { subjectService } from "@/services/subject.service";
import { courseService } from "@/services/course.service";
import { listPeerCriteria } from "@/services/peer-evaluation-criterion-template.service";
import type { Subject } from "@/dtos/subject.dto";
import type { PeerEvaluationCriterionTemplateDto } from "@/dtos/peer-evaluation-criterion-template.dto";

export default function CreateRubricPage() {
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

  // Subject and peer criteria state
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    subjectIdParam ? parseInt(subjectIdParam) : null
  );
  const [peerCriteria, setPeerCriteria] = useState<PeerEvaluationCriterionTemplateDto[]>([]);
  const [selectedCriteriaIds, setSelectedCriteriaIds] = useState<number[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingCriteria, setLoadingCriteria] = useState(false);

  useEffect(() => {
    if (scopeParam) {
      setScope(scopeParam);
    }
  }, [scopeParam]);

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

  // Load peer criteria when subject changes and scope is peer
  useEffect(() => {
    async function loadCriteria() {
      if (!selectedSubjectId || scope !== "peer") {
        setPeerCriteria([]);
        setSelectedCriteriaIds([]);
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
  }, [selectedSubjectId, scope]);

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

      // If peer criteria are selected, add them as rubric criteria
      if (scope === "peer" && selectedCriteriaIds.length > 0) {
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

        {/* Subject selector - only show for peer scope */}
        {scope === "peer" && (
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
        )}

        {/* Peer criteria multi-select dropdown - only show when subject is selected and scope is peer */}
        {scope === "peer" && selectedSubjectId && (
          <div className="space-y-2">
            <label className="block text-sm font-medium">Criteria uit templates</label>
            
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
                {selectedCriteriaIds.length > 0 && (
                  <p className="text-xs text-blue-600">
                    {selectedCriteriaIds.length} criterium/criteria geselecteerd - deze worden direct aan de rubric toegevoegd.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-sm font-medium">Type rubric (voor leerdoelen)</label>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={targetLevel || ""}
            onChange={(e) => setTargetLevel(e.target.value as "onderbouw" | "bovenbouw" | null || null)}
          >
            <option value="">Geen specifiek niveau</option>
            <option value="onderbouw">Onderbouw</option>
            <option value="bovenbouw">Bovenbouw</option>
          </select>
          <p className="text-xs text-gray-500">
            Hiermee filtert de app automatisch de beschikbare leerdoelen bij het koppelen aan criteria.
          </p>
        </div>

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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium">Schaal minimum</label>
            <input
              type="number"
              className="w-full border rounded-lg px-3 py-2"
              value={scaleMin}
              onChange={(e) => setScaleMin(e.target.valueAsNumber)}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium">Schaal maximum</label>
            <input
              type="number"
              className="w-full border rounded-lg px-3 py-2"
              value={scaleMax}
              onChange={(e) => setScaleMax(e.target.valueAsNumber)}
            />
          </div>
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
