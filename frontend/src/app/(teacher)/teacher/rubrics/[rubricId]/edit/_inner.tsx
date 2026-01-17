"use client";

import api from "@/lib/api";
import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import RubricEditor, { type CriterionItem } from "@/components/teacher/RubricEditor";
import { subjectService } from "@/services/subject.service";
import { courseService } from "@/services/course.service";
import { listPeerCriteria } from "@/services/peer-evaluation-criterion-template.service";
import { listProjectRubricCriteria } from "@/services/project-rubric-criterion-template.service";
import type { Subject } from "@/dtos/subject.dto";
import type { PeerEvaluationCriterionTemplateDto } from "@/dtos/peer-evaluation-criterion-template.dto";
import type { ProjectRubricCriterionTemplateDto } from "@/dtos/project-rubric-criterion-template.dto";

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
  const [projectCriteria, setProjectCriteria] = useState<ProjectRubricCriterionTemplateDto[]>([]);
  const [selectedCriteriaIds, setSelectedCriteriaIds] = useState<number[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingCriteria, setLoadingCriteria] = useState(false);
  
  // Multi-select dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  // Calculate dropdown position (fixed positioning uses viewport coords)
  const updateDropdownPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4, // NO window.scrollY for fixed positioning
        left: rect.left,      // NO window.scrollX for fixed positioning
        width: rect.width,
      });
    }
  }, []);

  // Click outside, escape, and reposition handlers for dropdown
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Close only if click is outside both button and panel
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        setIsDropdownOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
      }
    };

    const handleScroll = () => {
      updateDropdownPosition();
    };

    const handleResize = () => {
      updateDropdownPosition();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScroll, true); // Capture phase for nested scrolls
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [isDropdownOpen, updateDropdownPosition]);

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
        // Map items from API response
        const mappedItems = (c.data || []).map((ci) => ({
          id: ci.id,
          name: ci.name,
          weight: ci.weight,
          category: ci.category ?? null,
          order: ci.order ?? null,
          descriptors: { ...EMPTY_DESC, ...(ci.descriptors || {}) },
          learning_objective_ids: ci.learning_objective_ids || [],
        }));
        
        // Sort items by category order (as defined in RubricEditor), then by order within category
        // This ensures the items array matches the visual display order
        const categoryOrder: Record<string, number> = {
          "Projectproces": 0,
          "Eindresultaat": 1,
          "Communicatie": 2,
        };
        
        const sortedItems = [...mappedItems].sort((a, b) => {
          const catOrderA = categoryOrder[a.category || ""] ?? 999;
          const catOrderB = categoryOrder[b.category || ""] ?? 999;
          if (catOrderA !== catOrderB) return catOrderA - catOrderB;
          return (a.order ?? 0) - (b.order ?? 0);
        });
        
        setItems(sortedItems);
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

  // Load criteria when subject changes, filtered by rubric's target_level
  useEffect(() => {
    async function loadCriteria() {
      if (!selectedSubjectId) {
        setPeerCriteria([]);
        setProjectCriteria([]);
        return;
      }
      setLoadingCriteria(true);
      try {
        // Filter by rubric's target_level if set
        if (rubric?.scope === "peer") {
          const criteria = await listPeerCriteria(selectedSubjectId, {
            target_level: rubric?.target_level,
          });
          setPeerCriteria(criteria);
          setProjectCriteria([]);
        } else {
          const criteria = await listProjectRubricCriteria(selectedSubjectId, {
            target_level: rubric?.target_level,
          });
          setProjectCriteria(criteria);
          setPeerCriteria([]);
        }
      } catch (err) {
        console.error("Failed to load criteria:", err);
      } finally {
        setLoadingCriteria(false);
      }
    }
    loadCriteria();
  }, [selectedSubjectId, rubric?.target_level, rubric?.scope]);

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
    const criteria = rubric?.scope === "peer" ? peerCriteria : projectCriteria;
    const names = selectedCriteriaIds
      .map((id) => criteria.find((c) => c.id === id)?.title)
      .filter(Boolean);
    if (names.length <= 2) {
      return names.join(", ");
    }
    return `${names.length} criteria geselecteerd`;
  };

  // Helper function to normalize category keys
  const normalizeCategory = (value: string | null | undefined): string => {
    return (value ?? "").trim().toLowerCase();
  };

  // Helper function to capitalize words for fallback labels
  const capitalizeWords = (str: string): string => {
    return str
      .split(/[\s_-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  // Dynamic grouping for peer criteria
  const groupPeerCriteria = () => {
    const grouped: Record<string, typeof peerCriteria> = {};
    const knownKeys = ["organiseren", "meedoen", "zelfvertrouwen", "autonomie"];
    
    peerCriteria.forEach((criterion) => {
      const normalizedKey = normalizeCategory(criterion.omza_category);
      const key = normalizedKey || "overig";
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(criterion);
    });

    // Sort groups: known keys first in order, then others alphabetically, then "overig"
    const sortedKeys: string[] = [];
    knownKeys.forEach(key => {
      if (grouped[key]) sortedKeys.push(key);
    });
    Object.keys(grouped)
      .filter(k => !knownKeys.includes(k) && k !== "overig")
      .sort()
      .forEach(k => sortedKeys.push(k));
    if (grouped["overig"]) sortedKeys.push("overig");

    return { grouped, sortedKeys };
  };

  // Dynamic grouping for project criteria
  const groupProjectCriteria = () => {
    const grouped: Record<string, typeof projectCriteria> = {};
    const knownKeys = ["projectproces", "eindresultaat", "communicatie"];
    
    projectCriteria.forEach((criterion) => {
      const normalizedKey = normalizeCategory(criterion.category);
      const key = normalizedKey || "overig";
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(criterion);
    });

    // Sort groups: known keys first in order, then others alphabetically, then "overig"
    const sortedKeys: string[] = [];
    knownKeys.forEach(key => {
      if (grouped[key]) sortedKeys.push(key);
    });
    Object.keys(grouped)
      .filter(k => !knownKeys.includes(k) && k !== "overig")
      .sort()
      .forEach(k => sortedKeys.push(k));
    if (grouped["overig"]) sortedKeys.push("overig");

    return { grouped, sortedKeys };
  };

  // Get label for a category key
  const getCategoryLabel = (key: string, isPeer: boolean): string => {
    const peerLabels: Record<string, string> = {
      "organiseren": "Organiseren",
      "meedoen": "Meedoen",
      "zelfvertrouwen": "Zelfvertrouwen",
      "autonomie": "Autonomie",
      "overig": "Overig",
    };
    
    const projectLabels: Record<string, string> = {
      "projectproces": "Projectproces",
      "eindresultaat": "Eindresultaat",
      "communicatie": "Communicatie",
      "overig": "Overig",
    };

    const labels = isPeer ? peerLabels : projectLabels;
    return labels[key] || capitalizeWords(key);
  };

  // Toggle dropdown with position calculation
  const toggleDropdown = () => {
    if (!isDropdownOpen) {
      updateDropdownPosition();
    }
    setIsDropdownOpen(!isDropdownOpen);
  };

  const importSelectedCriteria = () => {
    const maxOrder = items.reduce((m, it) => Math.max(m, it.order ?? 0), 0);
    let newItems: CriterionItem[] = [];

    if (rubric?.scope === "peer") {
      const selectedTemplates = peerCriteria.filter(c => selectedCriteriaIds.includes(c.id));
      
      // Map OMZA category to proper category format
      const categoryMap: Record<string, string> = {
        "organiseren": "Organiseren",
        "meedoen": "Meedoen",
        "zelfvertrouwen": "Zelfvertrouwen",
        "autonomie": "Autonomie",
      };

      newItems = selectedTemplates.map((template, idx) => ({
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
    } else {
      const selectedTemplates = projectCriteria.filter(c => selectedCriteriaIds.includes(c.id));
      
      // Map project category to proper category format
      const categoryMap: Record<string, string> = {
        "projectproces": "Projectproces",
        "eindresultaat": "Eindresultaat",
        "communicatie": "Communicatie",
      };

      newItems = selectedTemplates.map((template, idx) => ({
        name: template.title,
        weight: 1.0 / (items.length + selectedTemplates.length), // Adjust weight
        category: categoryMap[template.category] || template.category,
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
    }

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
          order: i + 1,  // Use array index as global order, not per-category order
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
          learning_objective_ids: ci.learning_objective_ids || [],
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
  const isProjectRubric = rubric?.scope === "project";

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
            {(isPeerRubric || isProjectRubric) && (
              <button
                onClick={() => setShowTemplateModal(true)}
                className={`px-3 py-1.5 rounded-lg border bg-white text-sm font-medium shadow-sm ${
                  isPeerRubric 
                    ? "border-blue-200 text-blue-600 hover:bg-blue-50"
                    : "border-green-200 text-green-600 hover:bg-green-50"
                }`}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8">
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
              {loadingSubjects ? (
                <div className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-500">
                  Vakgebieden laden...
                </div>
              ) : (
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={selectedSubjectId || ""}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value ? parseInt(e.target.value) : null);
                    setSelectedCriteriaIds([]);
                  }}
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

            {/* Criteria multi-select dropdown */}
            {selectedSubjectId && (
              <div className="space-y-2">
                <label className="block text-sm font-medium">Beschikbare criteria</label>
                <p className="text-sm text-gray-500">
                  Selecteer welke criteria je wilt importeren
                </p>
                
                {loadingCriteria ? (
                  <div className="p-4 text-center text-gray-500 text-sm">Criteria laden...</div>
                ) : (isPeerRubric ? peerCriteria : projectCriteria).length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm border rounded-lg bg-gray-50">
                    Geen criteria templates gevonden voor dit vakgebied.
                  </div>
                ) : (
                  <>
                    <button
                      ref={buttonRef}
                      type="button"
                      onClick={toggleDropdown}
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

                    {isDropdownOpen && dropdownPosition && createPortal(
                      <div 
                        ref={panelRef}
                        className="fixed z-[9999] bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto"
                        style={{
                          top: `${dropdownPosition.top}px`,
                          left: `${dropdownPosition.left}px`,
                          width: `${dropdownPosition.width}px`,
                        }}
                      >
                        <div className="py-1">
                          {(() => {
                            if (isPeerRubric) {
                              const { grouped, sortedKeys } = groupPeerCriteria();
                              
                              // Check if we have any items at all
                              const totalItems = Object.values(grouped).reduce((sum, items) => sum + items.length, 0);
                              
                              if (totalItems === 0) {
                                return (
                                  <div className="px-3 py-2 text-sm text-gray-500">
                                    Geen criteria beschikbaar
                                  </div>
                                );
                              }
                              
                              // If no groups were created (shouldn't happen), show all items without grouping
                              if (sortedKeys.length === 0 && peerCriteria.length > 0) {
                                return peerCriteria.map((criterion) => (
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
                                ));
                              }
                              
                              // Render grouped items
                              return sortedKeys.map((key) => (
                                <div key={key}>
                                  <div className="px-3 py-1 bg-gray-100 text-xs font-semibold text-gray-600 uppercase">
                                    {getCategoryLabel(key, true)}
                                  </div>
                                  {grouped[key].map((criterion) => (
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
                              ));
                            } else {
                              // Project rubric
                              const { grouped, sortedKeys } = groupProjectCriteria();
                              
                              // Check if we have any items at all
                              const totalItems = Object.values(grouped).reduce((sum, items) => sum + items.length, 0);
                              
                              if (totalItems === 0) {
                                return (
                                  <div className="px-3 py-2 text-sm text-gray-500">
                                    Geen criteria beschikbaar
                                  </div>
                                );
                              }
                              
                              // If no groups were created (shouldn't happen), show all items without grouping
                              if (sortedKeys.length === 0 && projectCriteria.length > 0) {
                                return projectCriteria.map((criterion) => (
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
                                ));
                              }
                              
                              // Render grouped items
                              return sortedKeys.map((key) => (
                                <div key={key}>
                                  <div className="px-3 py-1 bg-gray-100 text-xs font-semibold text-gray-600 uppercase">
                                    {getCategoryLabel(key, false)}
                                  </div>
                                  {grouped[key].map((criterion) => (
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
                              ));
                            }
                          })()}
                        </div>
                      </div>,
                      document.body
                    )}
                  </>
                )}
                {selectedCriteriaIds.length > 0 && (
                  <p className="text-sm text-gray-600">
                    {selectedCriteriaIds.length} criterium/criteria geselecteerd
                  </p>
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
