"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  projectService,
  clientService,
  rubricService,
  competencyService,
  projectFeedbackService,
} from "@/services";
import { projectPlanService } from "@/services/projectplan.service";
import { useCourses } from "@/hooks";
import type { WizardProjectCreate, EvaluationConfig } from "@/dtos/project.dto";
import type { ClientListItem } from "@/dtos/client.dto";
import type { RubricListItem } from "@/dtos/rubric.dto";
import type { Competency } from "@/dtos";
import { ProjectPlanCreate, ProjectPlanStatus } from "@/dtos/projectplan.dto";
import { Loading } from "@/components";
import { MultiSelect } from "@/components/form/MultiSelect";
import { SearchableMultiSelect } from "@/components/form/SearchableMultiSelect";

// Period options constant
const PERIOD_OPTIONS = ["P1", "P2", "P3", "P4"] as const;
type Period = (typeof PERIOD_OPTIONS)[number];

export default function NewProjectWizardPage() {
  const router = useRouter();
  const { courses } = useCourses();

  // Wizard state
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<number | null>(null);
  const [createdEntities, setCreatedEntities] = useState<any[]>([]);
  const [wizardWarnings, setWizardWarnings] = useState<string[]>([]);

  // Step 1: Project basics
  const [title, setTitle] = useState("");
  const [niveau, setNiveau] = useState("");
  const [courseId, setCourseId] = useState<number | "">("");
  const [period, setPeriod] = useState<Period | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");

  // Filtered courses based on niveau selection
  const filteredCourses = courses.filter((course) => {
    if (!niveau) return true;
    return course.level === niveau;
  });

  // Step 2: Evaluations (using new nested structure)
  const [peerTussenEnabled, setPeerTussenEnabled] = useState(true);
  const [peerTussenDeadline, setPeerTussenDeadline] = useState("");
  const [peerTussenRubricId, setPeerTussenRubricId] = useState<number | "">("");

  const [peerEindEnabled, setPeerEindEnabled] = useState(true);
  const [peerEindDeadline, setPeerEindDeadline] = useState("");
  const [peerEindRubricId, setPeerEindRubricId] = useState<number | "">("");

  const [projectAssessmentEnabled, setProjectAssessmentEnabled] =
    useState(true);
  const [projectAssessmentRubricId, setProjectAssessmentRubricId] = useState<
    number | ""
  >("");
  const [projectAssessmentDeadline, setProjectAssessmentDeadline] =
    useState("");
  const [projectAssessmentVersion, setProjectAssessmentVersion] = useState("");

  const [projectAssessmentTussenEnabled, setProjectAssessmentTussenEnabled] =
    useState(false);
  const [projectAssessmentTussenRubricId, setProjectAssessmentTussenRubricId] =
    useState<number | "">("");
  const [projectAssessmentTussenDeadline, setProjectAssessmentTussenDeadline] =
    useState("");

  const [competencyScanEnabled, setCompetencyScanEnabled] = useState(false);
  const [competencyScanStartDate, setCompetencyScanStartDate] = useState("");
  const [competencyScanEndDate, setCompetencyScanEndDate] = useState("");
  const [competencyScanDeadline, setCompetencyScanDeadline] = useState("");
  const [competencyScanCompetencyIds, setCompetencyScanCompetencyIds] =
    useState<number[]>([]);
  const [competencyScanTitle, setCompetencyScanTitle] = useState("");

  // Step 3: Bovenbouw options (conditioneel, alleen bij niveau === "bovenbouw")
  const [projectPlanEnabled, setProjectPlanEnabled] = useState(false);
  const [projectPlanTitle, setProjectPlanTitle] = useState("");
  const [projectPlanStatus, setProjectPlanStatus] = useState<ProjectPlanStatus>(
    ProjectPlanStatus.DRAFT,
  );
  const [projectPlanDeadline, setProjectPlanDeadline] = useState("");

  // Step 4: Extras & clients
  const [projectFeedbackEnabled, setProjectFeedbackEnabled] = useState(false);
  const [projectFeedbackTitle, setProjectFeedbackTitle] = useState("");
  const [projectFeedbackDeadline, setProjectFeedbackDeadline] = useState("");

  // Step 4: Clients and notes
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<number[]>([]);
  const [createDefaultNote, setCreateDefaultNote] = useState(true);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientsLoadError, setClientsLoadError] = useState<string | null>(null);
  const [clientsLoaded, setClientsLoaded] = useState(false);

  // Rubrics and competencies for step 2
  const [rubrics, setRubrics] = useState<RubricListItem[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [loadingRubrics, setLoadingRubrics] = useState(false);
  const [loadingCompetencies, setLoadingCompetencies] = useState(false);
  const [rubricsLoaded, setRubricsLoaded] = useState(false);
  const [competenciesLoaded, setCompetenciesLoaded] = useState(false);

  // Success tracking for post-creation entities
  const [createdProjectPlanId, setCreatedProjectPlanId] = useState<
    number | null
  >(null);
  const [createdFeedbackRoundId, setCreatedFeedbackRoundId] = useState<
    number | null
  >(null);

  // Computed: whether bovenbouw is selected
  const isBovenbouw = niveau === "bovenbouw";

  // Wizard steps (dynamic based on niveau)
  const wizardSteps = isBovenbouw
    ? [
        "Projectbasis",
        "Evaluaties",
        "Bovenbouw",
        "Extra's & opdrachtgevers",
        "Bevestigen",
      ]
    : ["Projectbasis", "Evaluaties", "Extra's & opdrachtgevers", "Bevestigen"];

  // Helper: map wizardSteps display index (0-based) to internal step number
  function displayIndexToInternalStep(idx: number): number {
    return isBovenbouw ? idx + 1 : idx < 2 ? idx + 1 : idx + 2;
  }

  // Load rubrics when reaching step 2
  useEffect(() => {
    if (step === 2 && !rubricsLoaded) {
      loadRubrics();
    }
  }, [step, rubricsLoaded]);

  // Load competencies when reaching step 4 (competency scan)
  useEffect(() => {
    if (step === 4 && !competenciesLoaded) {
      loadCompetencies();
    }
  }, [step, competenciesLoaded]);

  // Load clients when reaching step 4
  useEffect(() => {
    if (step === 4 && !clientsLoaded) {
      loadClients();
    }
  }, [step, clientsLoaded]);

  async function loadRubrics() {
    setLoadingRubrics(true);
    try {
      const response = await rubricService.getRubrics();
      setRubrics(response.items || []);
      setRubricsLoaded(true);
    } catch (e: any) {
      console.error("Failed to load rubrics:", e);
      setRubricsLoaded(true);
    } finally {
      setLoadingRubrics(false);
    }
  }

  async function loadCompetencies() {
    setLoadingCompetencies(true);
    try {
      const comps = await competencyService.getCompetencies(true);
      setCompetencies(comps || []);
      setCompetenciesLoaded(true);
    } catch (e: any) {
      console.error("Failed to load competencies:", e);
      setCompetenciesLoaded(true);
    } finally {
      setLoadingCompetencies(false);
    }
  }

  async function loadClients() {
    setLoadingClients(true);
    setClientsLoadError(null);
    try {
      const response = await clientService.listClients({ per_page: 100 });
      setClients(response.items || []);
      setClientsLoaded(true);
    } catch (e: any) {
      console.error("Failed to load clients:", e);
      setClientsLoadError(
        "Kon opdrachtgevers niet laden. Je kunt doorgaan zonder opdrachtgevers te selecteren.",
      );
      // Mark as loaded to prevent retry loop
      setClientsLoaded(true);
    } finally {
      setLoadingClients(false);
    }
  }

  function validateStep1() {
    if (!title.trim()) {
      setError("Vul een projecttitel in");
      return false;
    }
    setError(null);
    return true;
  }

  function validateStep2() {
    // Validate that if project assessment tussentijds is enabled, a rubric is selected
    if (projectAssessmentTussenEnabled && !projectAssessmentTussenRubricId) {
      setError("Selecteer een rubric voor Projectbeoordeling Tussentijds");
      return false;
    }
    // Validate that if project assessment is enabled, a rubric is selected
    if (projectAssessmentEnabled && !projectAssessmentRubricId) {
      setError("Selecteer een rubric voor Projectbeoordeling");
      return false;
    }
    setError(null);
    return true;
  }

  function handleNext() {
    if (step === 1) {
      if (!validateStep1()) return;
    }
    if (step === 2) {
      if (!validateStep2()) return;
      // Skip step 3 (bovenbouw-opties) when not bovenbouw
      if (!isBovenbouw) {
        setError(null);
        setStep(4);
        return;
      }
    }
    setError(null);
    setStep(step + 1);
  }

  function handleBack() {
    setError(null);
    // Skip step 3 when going back if not bovenbouw
    if (step === 4 && !isBovenbouw) {
      setStep(2);
      return;
    }
    setStep(step - 1);
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);

    try {
      // Build new nested evaluation config
      const evaluationConfig: EvaluationConfig = {};

      if (peerTussenEnabled) {
        evaluationConfig.peer_tussen = {
          enabled: true,
          deadline: peerTussenDeadline || undefined,
          rubric_id: peerTussenRubricId || undefined,
          title_suffix: "tussentijds",
        };
      }

      if (peerEindEnabled) {
        evaluationConfig.peer_eind = {
          enabled: true,
          deadline: peerEindDeadline || undefined,
          rubric_id: peerEindRubricId || undefined,
          title_suffix: "eind",
        };
      }

      // Project Assessment Tussentijds (interim)
      if (projectAssessmentTussenEnabled && projectAssessmentTussenRubricId) {
        evaluationConfig.project_assessment_tussen = {
          enabled: true,
          rubric_id: Number(projectAssessmentTussenRubricId),
          deadline: projectAssessmentTussenDeadline || undefined,
          version: "tussentijds",
        };
      }

      // Project Assessment (final/eind)
      if (projectAssessmentEnabled && projectAssessmentRubricId) {
        evaluationConfig.project_assessment_eind = {
          enabled: true,
          rubric_id: Number(projectAssessmentRubricId),
          deadline: projectAssessmentDeadline || undefined,
          version: projectAssessmentVersion || "eind",
        };
      }

      if (competencyScanEnabled) {
        evaluationConfig.competency_scan = {
          enabled: true,
          start_date: competencyScanStartDate || undefined,
          end_date: competencyScanEndDate || undefined,
          deadline: competencyScanDeadline || undefined,
          competency_ids:
            competencyScanCompetencyIds.length > 0
              ? competencyScanCompetencyIds
              : undefined,
          title: competencyScanTitle || undefined,
        };
      }

      const payload: WizardProjectCreate = {
        project: {
          title: title.trim(),
          course_id: courseId || undefined,
          period: period || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          description: description.trim() || undefined,
          status: "concept",
        },
        evaluations: evaluationConfig,
        client_ids: selectedClientIds,
        create_default_note: createDefaultNote,
      };

      const result = await projectService.wizardCreateProject(payload);

      // Store created entities and warnings
      setCreatedEntities(result.entities || []);
      const newWarnings: string[] = [...(result.warnings || [])];

      setCreatedProjectId(result.project.id);

      // Create project plan if enabled (bovenbouw only)
      if (isBovenbouw && projectPlanEnabled) {
        try {
          const planPayload: ProjectPlanCreate = {
            project_id: result.project.id,
            title: projectPlanTitle || undefined,
            status: projectPlanStatus,
            deadline: projectPlanDeadline || undefined,
          };
          const planResult =
            await projectPlanService.createProjectPlan(planPayload);
          setCreatedProjectPlanId(planResult.id);
        } catch (e: any) {
          newWarnings.push(
            `Projectplan kon niet worden aangemaakt: ${e?.response?.data?.detail || e?.message || "Onbekende fout"}`,
          );
        }
      }

      // Create project feedback if enabled
      if (projectFeedbackEnabled) {
        try {
          const feedbackResult = await projectFeedbackService.createRound({
            project_id: result.project.id,
            title:
              projectFeedbackTitle || `Projectfeedback ${title.trim()}`,
            deadline: projectFeedbackDeadline || undefined,
          });
          setCreatedFeedbackRoundId(feedbackResult.id);
        } catch (e: any) {
          newWarnings.push(
            `Projectfeedback kon niet worden aangemaakt: ${e?.response?.data?.detail || e?.message || "Onbekende fout"}`,
          );
        }
      }

      setWizardWarnings(newWarnings);
      setSuccess(true);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const errorMessage = e?.message?.includes("Network Error")
        ? "Kan geen verbinding maken met de backend server. Controleer of de backend server draait op http://localhost:8000"
        : typeof detail === "string"
          ? detail
          : e?.message || "Project aanmaken mislukt";

      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  // Success screen
  if (success) {
    // Count entity types
    const peerCount = createdEntities.filter((e) => e.type === "peer").length;
    const projectAssessmentCount = createdEntities.filter(
      (e) => e.type === "project_assessment",
    ).length;
    const competencyScanCount = createdEntities.filter(
      (e) => e.type === "competency_scan",
    ).length;

    return (
      <main className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold mb-2">Project aangemaakt!</h1>
            <p className="text-gray-600">
              Het project &quot;{title}&quot; is succesvol aangemaakt.
            </p>
          </div>

          {/* Show warnings if any */}
          {wizardWarnings.length > 0 && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="font-semibold text-yellow-800 mb-2">
                ⚠️ Waarschuwingen
              </h3>
              <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                {wizardWarnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Summary of created entities */}
          <div className="mb-6 p-4 bg-gray-50/80 rounded-xl border border-gray-100">
            <h3 className="font-semibold mb-3">Aangemaakt:</h3>
            <ul className="space-y-2 text-sm">
              {peerCount > 0 && (
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>
                    {peerCount} Peerevaluatie{peerCount > 1 ? "s" : ""}
                  </span>
                </li>
              )}
              {projectAssessmentCount > 0 && (
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>
                    {projectAssessmentCount} Projectbeoordeling
                    {projectAssessmentCount > 1 ? "en" : ""}
                  </span>
                </li>
              )}
              {competencyScanCount > 0 && (
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>
                    {competencyScanCount} Competentiescan
                    {competencyScanCount > 1 ? "s" : ""}
                  </span>
                </li>
              )}
              {createdProjectPlanId && (
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Projectplan aangemaakt</span>
                </li>
              )}
              {createdFeedbackRoundId && (
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Projectfeedback aangemaakt</span>
                </li>
              )}
            </ul>
          </div>

          <div className="flex gap-3 justify-center flex-wrap">
            {/* Primary action: Navigate to class-teams to create teams */}
            {createdProjectId && (
              <button
                onClick={() => {
                  // Defensive null check
                  if (!createdProjectId) return;

                  const params = new URLSearchParams();
                  params.set("project_id", createdProjectId.toString());
                  if (courseId) params.set("course_id", courseId.toString());
                  router.push(`/teacher/class-teams?${params.toString()}`);
                }}
                className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold"
              >
                👥 Teams aanmaken
              </button>
            )}

            {createdProjectPlanId && (
              <button
                onClick={() =>
                  router.push(
                    `/teacher/projectplans/${createdProjectPlanId}?tab=overzicht`,
                  )
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
              >
                📋 Ga naar Projectplan
              </button>
            )}
            {createdFeedbackRoundId && (
              <button
                onClick={() =>
                  router.push(
                    `/teacher/project-feedback/${createdFeedbackRoundId}`,
                  )
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
              >
                📝 Ga naar Projectfeedback
              </button>
            )}
            {projectAssessmentCount > 0 && (
              <button
                onClick={() => router.push("/teacher/project-assessments")}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Ga naar Projectbeoordelingen
              </button>
            )}
            {peerCount > 0 && (
              <button
                onClick={() => router.push("/teacher/evaluations")}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Ga naar Peerevaluaties
              </button>
            )}
            {competencyScanCount > 0 && (
              <button
                onClick={() => router.push("/teacher/competencies")}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Ga naar Competentiescans
              </button>
            )}
            <button
              onClick={() => router.push("/teacher")}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
            >
              Terug naar Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Nieuw project aanmaken</h1>
        <p className="text-gray-600">
          Maak in één keer een project aan met gekoppelde evaluaties,
          opdrachtgevers en aantekeningen.
        </p>
      </div>

      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {wizardSteps.map((label, idx) => {
            const internalStep = displayIndexToInternalStep(idx);
            const isCompleted = internalStep < step;
            const isCurrent = internalStep === step;
            const displayNum = idx + 1;
            return (
              <div
                key={idx}
                className={`flex items-center ${idx < wizardSteps.length - 1 ? "flex-1" : ""}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    isCompleted
                      ? "bg-green-500 text-white"
                      : isCurrent
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {isCompleted ? "✓" : displayNum}
                </div>
                {idx < wizardSteps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 rounded-full ${
                      isCompleted ? "bg-green-500" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-sm">
          {wizardSteps.map((label, idx) => {
            const internalStep = displayIndexToInternalStep(idx);
            return (
              <span
                key={idx}
                className={
                  internalStep === step ? "font-semibold" : "text-gray-600"
                }
              >
                {label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Form content */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        {/* Step 1: Project basics */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Projectbasis</h2>

            <div>
              <label className="block text-sm font-medium mb-1">
                Projecttitel <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Bijv. Klimaatonderzoek 5V1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Niveau</label>
              <select
                value={niveau}
                onChange={(e) => {
                  setNiveau(e.target.value);
                  setCourseId(""); // Reset course when niveau changes
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Alle niveaus</option>
                <option value="onderbouw">Onderbouw</option>
                <option value="bovenbouw">Bovenbouw</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Selecteer een niveau om de courses te filteren
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Course</label>
              <select
                value={courseId}
                onChange={(e) =>
                  setCourseId(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Selecteer een course...</option>
                {filteredCourses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name} {course.level ? `(${course.level})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Periode</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as Period | "")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Selecteer een periode...</option>
                {PERIOD_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Startdatum
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Einddatum
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Beschrijving
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Korte beschrijving van het project..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Step 2: Evaluations */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">
                Evaluaties & beoordeling
              </h2>
              <p className="text-sm text-gray-600">
                Configureer welke evaluaties automatisch aangemaakt moeten
                worden.
              </p>
            </div>

            {loadingRubrics ? (
              <Loading />
            ) : (
              <div className="space-y-4">
                {/* Peer Evaluatie Tussentijds */}
                <div className="border border-gray-200/70 rounded-xl p-5">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={peerTussenEnabled}
                      onChange={(e) => setPeerTussenEnabled(e.target.checked)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium">
                        Peerevaluatie tussentijds
                      </div>
                      <div className="text-sm text-gray-600 mb-3">
                        Studenten beoordelen elkaar halverwege het project
                      </div>

                      {peerTussenEnabled && (
                        <div className="space-y-3 mt-3 pl-4 border-l-2 border-blue-200 bg-gray-50/50 rounded-lg py-3 pr-3">
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              Deadline
                            </label>
                            <input
                              type="datetime-local"
                              value={peerTussenDeadline}
                              onChange={(e) =>
                                setPeerTussenDeadline(e.target.value)
                              }
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              Rubric (optioneel)
                            </label>
                            <select
                              value={peerTussenRubricId}
                              onChange={(e) =>
                                setPeerTussenRubricId(
                                  e.target.value ? Number(e.target.value) : "",
                                )
                              }
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg"
                            >
                              <option value="">
                                Gebruik standaard peer rubric
                              </option>
                              {rubrics
                                .filter((r) => r.scope === "peer")
                                .map((rubric) => (
                                  <option key={rubric.id} value={rubric.id}>
                                    {rubric.title}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </label>
                </div>

                {/* Peer Evaluatie Eind */}
                <div className="border border-gray-200/70 rounded-xl p-5">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={peerEindEnabled}
                      onChange={(e) => setPeerEindEnabled(e.target.checked)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium">Peerevaluatie eind</div>
                      <div className="text-sm text-gray-600 mb-3">
                        Studenten beoordelen elkaar aan het einde van het
                        project
                      </div>

                      {peerEindEnabled && (
                        <div className="space-y-3 mt-3 pl-4 border-l-2 border-blue-200 bg-gray-50/50 rounded-lg py-3 pr-3">
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              Deadline
                            </label>
                            <input
                              type="datetime-local"
                              value={peerEindDeadline}
                              onChange={(e) =>
                                setPeerEindDeadline(e.target.value)
                              }
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              Rubric (optioneel)
                            </label>
                            <select
                              value={peerEindRubricId}
                              onChange={(e) =>
                                setPeerEindRubricId(
                                  e.target.value ? Number(e.target.value) : "",
                                )
                              }
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg"
                            >
                              <option value="">
                                Gebruik standaard peer rubric
                              </option>
                              {rubrics
                                .filter((r) => r.scope === "peer")
                                .map((rubric) => (
                                  <option key={rubric.id} value={rubric.id}>
                                    {rubric.title}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </label>
                </div>

                {/* Project Assessment Tussentijds (Interim) */}
                <div className="border border-gray-200/70 rounded-xl p-5">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={projectAssessmentTussenEnabled}
                      onChange={(e) =>
                        setProjectAssessmentTussenEnabled(e.target.checked)
                      }
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium">
                        Projectbeoordeling Tussentijds
                      </div>
                      <div className="text-sm text-gray-600 mb-3">
                        Docent beoordeelt het tussentijdse projectresultaat per
                        team
                      </div>

                      {projectAssessmentTussenEnabled && (
                        <div className="space-y-3 mt-3 pl-4 border-l-2 border-orange-200 bg-gray-50/50 rounded-lg py-3 pr-3">
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              Rubric <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={projectAssessmentTussenRubricId}
                              onChange={(e) =>
                                setProjectAssessmentTussenRubricId(
                                  e.target.value ? Number(e.target.value) : "",
                                )
                              }
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg"
                              required
                            >
                              <option value="">
                                Selecteer project rubric...
                              </option>
                              {rubrics
                                .filter((r) => r.scope === "project")
                                .map((rubric) => (
                                  <option key={rubric.id} value={rubric.id}>
                                    {rubric.title}
                                  </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                              Er wordt één tussentijdse beoordeling per team
                              aangemaakt
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              Deadline (optioneel)
                            </label>
                            <input
                              type="datetime-local"
                              value={projectAssessmentTussenDeadline}
                              onChange={(e) =>
                                setProjectAssessmentTussenDeadline(
                                  e.target.value,
                                )
                              }
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </label>
                </div>

                {/* Project Assessment */}
                <div className="border border-gray-200/70 rounded-xl p-5">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={projectAssessmentEnabled}
                      onChange={(e) =>
                        setProjectAssessmentEnabled(e.target.checked)
                      }
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium">
                        Projectbeoordeling (Eind)
                      </div>
                      <div className="text-sm text-gray-600 mb-3">
                        Docent beoordeelt het eindresultaat per team
                      </div>

                      {projectAssessmentEnabled && (
                        <div className="space-y-3 mt-3 pl-4 border-l-2 border-green-200 bg-gray-50/50 rounded-lg py-3 pr-3">
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              Rubric <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={projectAssessmentRubricId}
                              onChange={(e) =>
                                setProjectAssessmentRubricId(
                                  e.target.value ? Number(e.target.value) : "",
                                )
                              }
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg"
                              required
                            >
                              <option value="">
                                Selecteer project rubric...
                              </option>
                              {rubrics
                                .filter((r) => r.scope === "project")
                                .map((rubric) => (
                                  <option key={rubric.id} value={rubric.id}>
                                    {rubric.title}
                                  </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                              Er wordt één beoordeling per team aangemaakt
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              Deadline (optioneel)
                            </label>
                            <input
                              type="datetime-local"
                              value={projectAssessmentDeadline}
                              onChange={(e) =>
                                setProjectAssessmentDeadline(e.target.value)
                              }
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              Versie (optioneel)
                            </label>
                            <input
                              type="text"
                              value={projectAssessmentVersion}
                              onChange={(e) =>
                                setProjectAssessmentVersion(e.target.value)
                              }
                              placeholder="bijv. tussentijds, eind"
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Bovenbouw-opties (conditioneel, alleen bij niveau === "bovenbouw") */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Bovenbouw-opties</h2>
              <p className="text-sm text-gray-600">
                Extra opties voor bovenbouwprojecten.
              </p>
            </div>

            <div className="space-y-4">
              {/* Projectplan */}
              <div className="border border-gray-200/70 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={projectPlanEnabled}
                    onChange={(e) => setProjectPlanEnabled(e.target.checked)}
                    className="mt-1"
                    id="project-plan-checkbox"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="project-plan-checkbox"
                      className="font-medium cursor-pointer"
                    >
                      Projectplan aanmaken
                    </label>
                    <div className="text-sm text-gray-600 mb-3">
                      Teams vullen een projectplan in met 8 secties (GO/NO-GO)
                    </div>

                    {projectPlanEnabled && (
                      <div className="space-y-3 mt-3 pl-4 border-l-2 border-indigo-200 bg-gray-50/50 rounded-lg py-3 pr-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Titel (optioneel)
                          </label>
                          <input
                            type="text"
                            value={projectPlanTitle}
                            onChange={(e) =>
                              setProjectPlanTitle(e.target.value)
                            }
                            placeholder="Bijv. Projectplan periode 1"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Laat leeg voor standaard titel
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Status
                          </label>
                          <select
                            value={projectPlanStatus}
                            onChange={(e) =>
                              setProjectPlanStatus(
                                e.target.value as ProjectPlanStatus,
                              )
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg"
                          >
                            <option value={ProjectPlanStatus.DRAFT}>
                              Concept (niet zichtbaar voor studenten)
                            </option>
                            <option value={ProjectPlanStatus.OPEN}>
                              Open (zichtbaar voor studenten)
                            </option>
                            <option value={ProjectPlanStatus.PUBLISHED}>
                              Gepubliceerd (zichtbaar voor studenten)
                            </option>
                            <option value={ProjectPlanStatus.CLOSED}>
                              Gesloten (alleen lezen voor studenten)
                            </option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Deadline (optioneel)
                          </label>
                          <input
                            type="datetime-local"
                            value={projectPlanDeadline}
                            onChange={(e) =>
                              setProjectPlanDeadline(e.target.value)
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Deadline voor het indienen van het projectplan
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Extra's & opdrachtgevers */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">
                Extra&apos;s & opdrachtgevers
              </h2>
              <p className="text-sm text-gray-600">
                Voeg optionele componenten en opdrachtgevers toe.
              </p>
            </div>

            {loadingCompetencies ? (
              <Loading />
            ) : (
              <div className="space-y-4">
                {/* Competency Scan */}
                <div className="border border-gray-200/70 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={competencyScanEnabled}
                      onChange={(e) =>
                        setCompetencyScanEnabled(e.target.checked)
                      }
                      className="mt-1"
                      id="competency-scan-checkbox"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor="competency-scan-checkbox"
                        className="font-medium cursor-pointer"
                      >
                        Competentiescan
                      </label>
                      <div className="text-sm text-gray-600 mb-3">
                        Studenten vullen een competentiescan in voor dit project
                      </div>

                      {competencyScanEnabled && (
                        <div className="space-y-3 mt-3 pl-4 border-l-2 border-purple-200 bg-gray-50/50 rounded-lg py-3 pr-3">
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              Titel (optioneel)
                            </label>
                            <input
                              type="text"
                              value={competencyScanTitle}
                              onChange={(e) =>
                                setCompetencyScanTitle(e.target.value)
                              }
                              placeholder="bijv. Q1 Competentiescan"
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium mb-1">
                                Startdatum
                              </label>
                              <input
                                type="datetime-local"
                                value={competencyScanStartDate}
                                onChange={(e) =>
                                  setCompetencyScanStartDate(e.target.value)
                                }
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">
                                Einddatum
                              </label>
                              <input
                                type="datetime-local"
                                value={competencyScanEndDate}
                                onChange={(e) =>
                                  setCompetencyScanEndDate(e.target.value)
                                }
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              Deadline (optioneel)
                            </label>
                            <input
                              type="datetime-local"
                              value={competencyScanDeadline}
                              onChange={(e) =>
                                setCompetencyScanDeadline(e.target.value)
                              }
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg"
                              placeholder="Anders wordt einddatum gebruikt"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              Competenties
                            </label>
                            <MultiSelect
                              options={competencies.map((comp) => ({
                                id: comp.id,
                                label: comp.name,
                              }))}
                              value={competencyScanCompetencyIds}
                              onChange={setCompetencyScanCompetencyIds}
                              placeholder="Selecteer competenties..."
                              className="w-full"
                            />
                            {competencies.length === 0 && (
                              <p className="text-xs text-gray-500 italic mt-1">
                                Geen competenties beschikbaar
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Projectfeedback */}
                <div className="border border-gray-200/70 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={projectFeedbackEnabled}
                      onChange={(e) =>
                        setProjectFeedbackEnabled(e.target.checked)
                      }
                      className="mt-1"
                      id="project-feedback-checkbox"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor="project-feedback-checkbox"
                        className="font-medium cursor-pointer"
                      >
                        Projectfeedback aanmaken
                      </label>
                      <div className="text-sm text-gray-600 mb-3">
                        Leerlingen vullen een feedbackvragenlijst in over het
                        project (standaard vragen worden automatisch toegevoegd)
                      </div>

                      {projectFeedbackEnabled && (
                        <div className="space-y-3 mt-3 pl-4 border-l-2 border-teal-200 bg-gray-50/50 rounded-lg py-3 pr-3">
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              Titel
                            </label>
                            <input
                              type="text"
                              value={projectFeedbackTitle}
                              onChange={(e) =>
                                setProjectFeedbackTitle(e.target.value)
                              }
                              placeholder={`Projectfeedback ${title || "..."}`}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Laat leeg voor standaard titel op basis van de
                              projectnaam
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              Deadline (optioneel)
                            </label>
                            <input
                              type="datetime-local"
                              value={projectFeedbackDeadline}
                              onChange={(e) =>
                                setProjectFeedbackDeadline(e.target.value)
                              }
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Deadline voor het invullen van de
                              feedbackvragenlijst
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Opdrachtgevers */}
                <div className="border border-gray-200/70 rounded-xl p-5">
                  <h3 className="font-medium mb-2">Opdrachtgevers</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Selecteer welke opdrachtgevers betrokken zijn bij dit
                    project.
                  </p>

                  {clientsLoadError && (
                    <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        {clientsLoadError}
                      </p>
                      <button
                        onClick={() => {
                          setClientsLoaded(false);
                          loadClients();
                        }}
                        className="mt-2 text-sm text-blue-600 hover:underline"
                      >
                        Opnieuw proberen
                      </button>
                    </div>
                  )}

                  <SearchableMultiSelect
                    options={clients.map((client) => ({
                      id: client.id,
                      label: client.organization,
                      subtitle: client.contact_name,
                    }))}
                    value={selectedClientIds}
                    onChange={setSelectedClientIds}
                    placeholder="Zoek en selecteer opdrachtgevers..."
                    loading={loadingClients}
                    className="w-full"
                  />
                  {clients.length === 0 &&
                    !loadingClients &&
                    !clientsLoadError && (
                      <p className="text-sm text-gray-500 italic mt-2">
                        Geen opdrachtgevers beschikbaar.
                      </p>
                    )}
                </div>

                {/* Aantekeningenpagina */}
                <div className="border border-gray-200/70 rounded-xl p-5">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createDefaultNote}
                      onChange={(e) => setCreateDefaultNote(e.target.checked)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium">
                        Maak een standaard projectaantekeningen-pagina aan
                      </div>
                      <div className="text-sm text-gray-600">
                        Projectaantekeningen zijn alleen zichtbaar voor
                        docenten en kunnen gebruikt worden voor planning,
                        materialen, contact met opdrachtgever etc.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Summary */}
        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Bevestigen</h2>
            <p className="text-sm text-gray-600 mb-4">
              Controleer de gegevens en klik op &quot;Project aanmaken&quot; om
              te bevestigen.
            </p>

            <div className="space-y-4">
              <div className="bg-gray-50/80 rounded-xl border border-gray-100 p-4">
                <h3 className="font-semibold mb-2">Projectgegevens</h3>
                <dl className="space-y-1 text-sm">
                  <div className="flex">
                    <dt className="w-32 text-gray-600">Titel:</dt>
                    <dd className="font-medium">{title}</dd>
                  </div>
                  {niveau && (
                    <div className="flex">
                      <dt className="w-32 text-gray-600">Niveau:</dt>
                      <dd className="capitalize">{niveau}</dd>
                    </div>
                  )}
                  {courseId && (
                    <div className="flex">
                      <dt className="w-32 text-gray-600">Course:</dt>
                      <dd>{courses.find((c) => c.id === courseId)?.name}</dd>
                    </div>
                  )}
                  {period && (
                    <div className="flex">
                      <dt className="w-32 text-gray-600">Periode:</dt>
                      <dd>{period}</dd>
                    </div>
                  )}
                  {startDate && (
                    <div className="flex">
                      <dt className="w-32 text-gray-600">Startdatum:</dt>
                      <dd>{new Date(startDate).toLocaleDateString("nl-NL")}</dd>
                    </div>
                  )}
                  {endDate && (
                    <div className="flex">
                      <dt className="w-32 text-gray-600">Einddatum:</dt>
                      <dd>{new Date(endDate).toLocaleDateString("nl-NL")}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="bg-gray-50/80 rounded-xl border border-gray-100 p-4">
                <h3 className="font-semibold mb-2">Evaluaties</h3>
                <ul className="space-y-2 text-sm">
                  {peerTussenEnabled && (
                    <li>
                      <div className="font-medium">
                        ✓ Peerevaluatie tussentijds
                      </div>
                      {peerTussenDeadline && (
                        <div className="text-xs text-gray-600 ml-4">
                          Deadline:{" "}
                          {new Date(peerTussenDeadline).toLocaleString("nl-NL")}
                        </div>
                      )}
                    </li>
                  )}
                  {peerEindEnabled && (
                    <li>
                      <div className="font-medium">✓ Peerevaluatie eind</div>
                      {peerEindDeadline && (
                        <div className="text-xs text-gray-600 ml-4">
                          Deadline:{" "}
                          {new Date(peerEindDeadline).toLocaleString("nl-NL")}
                        </div>
                      )}
                    </li>
                  )}
                  {projectAssessmentTussenEnabled && (
                    <li>
                      <div className="font-medium">
                        ✓ Projectbeoordeling Tussentijds
                      </div>
                      <div className="text-xs text-gray-600 ml-4">
                        Rubric:{" "}
                        {rubrics.find(
                          (r) => r.id === projectAssessmentTussenRubricId,
                        )?.title || "Niet geselecteerd"}
                      </div>
                      {projectAssessmentTussenDeadline && (
                        <div className="text-xs text-gray-600 ml-4">
                          Deadline:{" "}
                          {new Date(
                            projectAssessmentTussenDeadline,
                          ).toLocaleString("nl-NL")}
                        </div>
                      )}
                    </li>
                  )}
                  {projectAssessmentEnabled && (
                    <li>
                      <div className="font-medium">
                        ✓ Projectbeoordeling (Eind)
                      </div>
                      <div className="text-xs text-gray-600 ml-4">
                        Rubric:{" "}
                        {rubrics.find((r) => r.id === projectAssessmentRubricId)
                          ?.title || "Niet geselecteerd"}
                      </div>
                      {projectAssessmentDeadline && (
                        <div className="text-xs text-gray-600 ml-4">
                          Deadline:{" "}
                          {new Date(projectAssessmentDeadline).toLocaleString(
                            "nl-NL",
                          )}
                        </div>
                      )}
                    </li>
                  )}
                  {!peerTussenEnabled &&
                    !peerEindEnabled &&
                    !projectAssessmentEnabled &&
                    !projectAssessmentTussenEnabled && (
                      <li className="text-gray-500 italic">
                        Geen evaluaties geselecteerd
                      </li>
                    )}
                </ul>
              </div>

              {isBovenbouw && (
                <div className="bg-gray-50/80 rounded-xl border border-gray-100 p-4">
                  <h3 className="font-semibold mb-2">Bovenbouw-opties</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex">
                      <span className="w-32 text-gray-600">Projectplan:</span>
                      <span className="font-medium">
                        {projectPlanEnabled ? "Ja" : "Nee"}
                      </span>
                    </div>
                    {projectPlanEnabled && projectPlanTitle && (
                      <div className="flex">
                        <span className="w-32 text-gray-600">Titel:</span>
                        <span>{projectPlanTitle}</span>
                      </div>
                    )}
                    {projectPlanEnabled && (
                      <div className="flex">
                        <span className="w-32 text-gray-600">Status:</span>
                        <span className="capitalize">{projectPlanStatus}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-gray-50/80 rounded-xl border border-gray-100 p-4">
                <h3 className="font-semibold mb-2">Extra&apos;s</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex">
                    <span className="w-36 text-gray-600">Competentiescan:</span>
                    <span className="font-medium">
                      {competencyScanEnabled ? "Ja" : "Nee"}
                    </span>
                  </div>
                  {competencyScanEnabled &&
                    competencyScanCompetencyIds.length > 0 && (
                      <div className="flex">
                        <span className="w-36 text-gray-600">
                          Competenties:
                        </span>
                        <span>
                          {competencyScanCompetencyIds.length} geselecteerd
                        </span>
                      </div>
                    )}
                  <div className="flex">
                    <span className="w-36 text-gray-600">Projectfeedback:</span>
                    <span className="font-medium">
                      {projectFeedbackEnabled ? "Ja" : "Nee"}
                    </span>
                  </div>
                  {projectFeedbackEnabled && (
                    <div className="flex">
                      <span className="w-36 text-gray-600">Titel:</span>
                      <span>
                        {projectFeedbackTitle ||
                          `Projectfeedback ${title}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50/80 rounded-xl border border-gray-100 p-4">
                <h3 className="font-semibold mb-2">
                  Opdrachtgevers & aantekeningen
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">
                      Geselecteerde opdrachtgevers:{" "}
                    </span>
                    <span className="font-medium">
                      {selectedClientIds.length === 0
                        ? "Geen"
                        : selectedClientIds.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">
                      Projectaantekeningen:{" "}
                    </span>
                    <span className="font-medium">
                      {createDefaultNote ? "Ja" : "Nee"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-6 pt-6 border-t">
          <button
            onClick={step > 1 ? handleBack : () => router.push("/teacher")}
            className="px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50"
            disabled={submitting}
          >
            {step > 1 ? "Vorige" : "Annuleren"}
          </button>

          {step < 5 ? (
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
            >
              Volgende
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Bezig..." : "Project aanmaken"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
