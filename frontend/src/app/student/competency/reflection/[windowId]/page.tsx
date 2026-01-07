"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { competencyService } from "@/services";
import type {
  CompetencyWindow,
  CompetencyGoal,
  CompetencyReflection,
  CompetencyReflectionBulkCreate,
} from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import { studentStyles } from "@/styles/student-dashboard.styles";

// Draft state for a single goal's reflection
type GoalReflectionDraft = {
  goalId: number;
  text: string;
  goalAchieved?: boolean;
  evidence: string;
  isDirty: boolean;
};

export default function ReflectionPage() {
  const router = useRouter();
  const params = useParams();
  const windowId = Number(params.windowId);

  const [window, setWindow] = useState<CompetencyWindow | null>(null);
  const [goals, setGoals] = useState<CompetencyGoal[]>([]);
  const [existingReflections, setExistingReflections] = useState<CompetencyReflection[]>([]);
  
  // Active goal being edited
  const [activeGoalId, setActiveGoalId] = useState<number | null>(null);
  
  // Draft reflections keyed by goal ID
  const [drafts, setDrafts] = useState<Record<number, GoalReflectionDraft>>({});
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [win, windowGoals, reflections] = await Promise.all([
        competencyService.getWindow(windowId),
        competencyService.getMyGoals(windowId),
        competencyService.getMyReflections(windowId),
      ]);

      setWindow(win);
      setGoals(windowGoals);
      setExistingReflections(reflections);

      // Initialize drafts from existing reflections
      const initialDrafts: Record<number, GoalReflectionDraft> = {};
      
      for (const goal of windowGoals) {
        const existingReflection = reflections.find((r) => r.goal_id === goal.id);
        initialDrafts[goal.id] = {
          goalId: goal.id,
          text: existingReflection?.text || "",
          goalAchieved: existingReflection?.goal_achieved,
          evidence: existingReflection?.evidence || "",
          isDirty: false,
        };
      }

      setDrafts(initialDrafts);

      // Set active goal to first goal by default
      if (windowGoals.length > 0) {
        setActiveGoalId(windowGoals[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleGoalSelect = (goalId: number) => {
    setActiveGoalId(goalId);
    setError(null);
  };

  const updateDraft = (field: keyof GoalReflectionDraft, value: any) => {
    if (activeGoalId === null) return;
    
    setDrafts((prev) => ({
      ...prev,
      [activeGoalId]: {
        ...prev[activeGoalId],
        [field]: value,
        isDirty: true,
      },
    }));
  };

  const getReflectionStatus = (goalId: number): string => {
    const draft = drafts[goalId];
    const existing = existingReflections.find((r) => r.goal_id === goalId);
    
    if (existing && existing.submitted_at) {
      return "Ingediend";
    }
    if (draft?.isDirty || (draft?.text && draft.text.trim().length > 0)) {
      return "Concept";
    }
    return "Leeg";
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "Ingediend":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "Concept":
        return "bg-amber-100 text-amber-700 border-amber-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Gather all drafts that have content
    const reflectionsToSubmit = Object.values(drafts).filter(
      (draft) => draft.text.trim().length > 0
    );

    if (reflectionsToSubmit.length === 0) {
      setError("Vul minimaal één reflectie in voordat je indient");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const bulkData: CompetencyReflectionBulkCreate = {
        window_id: windowId,
        reflections: reflectionsToSubmit.map((draft) => ({
          goal_id: draft.goalId,
          text: draft.text,
          goal_achieved: draft.goalAchieved,
          evidence: draft.evidence,
        })),
      };

      await competencyService.createReflectionsBulk(bulkData);

      setSuccessMessage(
        `${reflectionsToSubmit.length} reflectie${reflectionsToSubmit.length > 1 ? "s" : ""} succesvol opgeslagen!`
      );
      
      // Mark all submitted drafts as not dirty
      setDrafts((prev) => {
        const updated = { ...prev };
        reflectionsToSubmit.forEach((draft) => {
          updated[draft.goalId] = { ...draft, isDirty: false };
        });
        return updated;
      });

      setTimeout(() => {
        router.push("/student");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save reflections");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;
  if (error && !window) return <ErrorMessage message={error} />;
  if (!window) return <ErrorMessage message="Window not found" />;

  if (goals.length === 0) {
    return (
      <div className={studentStyles.layout.pageContainer}>
        <div className={studentStyles.header.container}>
          <header className={studentStyles.header.wrapper}>
            <div className={studentStyles.header.titleSection}>
              <h1 className={studentStyles.header.title}>Reflectie Schrijven</h1>
              <p className={studentStyles.header.subtitle}>
                Reflecteer op je competentieontwikkeling tijdens {window.title}
              </p>
            </div>
          </header>
        </div>
        <main className={studentStyles.layout.contentWrapper}>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-slate-600">
              Je hebt nog geen leerdoelen ingesteld voor deze periode. Stel eerst
              leerdoelen in voordat je een reflectie kunt schrijven.
            </p>
            <button
              onClick={() => router.push("/student")}
              className={studentStyles.buttons.primary + " mt-4 px-6 py-2 text-white"}
            >
              Terug naar Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  const activeDraft = activeGoalId ? drafts[activeGoalId] : null;
  const activeGoal = goals.find((g) => g.id === activeGoalId);

  return (
    <div className={studentStyles.layout.pageContainer}>
      {/* Header */}
      <div className={studentStyles.header.container}>
        <header className={studentStyles.header.wrapper}>
          <div className={studentStyles.header.titleSection}>
            <h1 className={studentStyles.header.title}>Reflectie Schrijven</h1>
            <p className={studentStyles.header.subtitle}>
              Reflecteer op je competentieontwikkeling tijdens {window.title}
            </p>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <main className={studentStyles.layout.contentWrapper + " space-y-6"}>
        {successMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
            {error}
          </div>
        )}

        {/* Learning Goals List */}
        <div className="rounded-2xl border border-slate-200 bg-indigo-50 p-5 shadow-sm">
          <h3 className={studentStyles.typography.cardTitle + " mb-3"}>
            Jouw Leerdoelen
          </h3>
          <div className="space-y-2">
            {goals.map((goal) => {
              const status = getReflectionStatus(goal.id);
              const isActive = goal.id === activeGoalId;
              return (
                <div
                  key={goal.id}
                  onClick={() => handleGoalSelect(goal.id)}
                  className={`cursor-pointer rounded-xl border p-3 transition-all ${
                    isActive
                      ? "border-indigo-500 bg-white ring-2 ring-indigo-500"
                      : "border-indigo-200 bg-white hover:border-indigo-400"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">
                        {goal.goal_text}
                      </p>
                      {goal.success_criteria && (
                        <p className={studentStyles.typography.infoText + " mt-1"}>
                          Criterium: {goal.success_criteria}
                        </p>
                      )}
                    </div>
                    <span
                      className={`ml-3 rounded-lg border px-3 py-1 text-xs font-medium ${getStatusColor(
                        status
                      )}`}
                    >
                      {status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reflection Form */}
        {activeDraft && activeGoal && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 border-b border-slate-200 pb-3">
                <h3 className="text-lg font-semibold text-slate-900">
                  Reflectie voor: {activeGoal.goal_text}
                </h3>
              </div>

              {/* Goal Achieved */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Heb je je leerdoel behaald?
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name={`goal_achieved_${activeGoalId}`}
                      checked={activeDraft.goalAchieved === true}
                      onChange={() => updateDraft("goalAchieved", true)}
                      className="mr-2"
                    />
                    <span className="text-sm text-slate-700">Ja</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name={`goal_achieved_${activeGoalId}`}
                      checked={activeDraft.goalAchieved === false}
                      onChange={() => updateDraft("goalAchieved", false)}
                      className="mr-2"
                    />
                    <span className="text-sm text-slate-700">Nee</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name={`goal_achieved_${activeGoalId}`}
                      checked={activeDraft.goalAchieved === undefined}
                      onChange={() => updateDraft("goalAchieved", undefined)}
                      className="mr-2"
                    />
                    <span className="text-sm text-slate-700">Gedeeltelijk</span>
                  </label>
                </div>
              </div>

              {/* Reflection Text */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Reflectie <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={activeDraft.text}
                  onChange={(e) => updateDraft("text", e.target.value)}
                  placeholder="Reflecteer op je competentieontwikkeling. Wat ging goed? Wat kan beter? Wat heb je geleerd?"
                  rows={8}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className={studentStyles.typography.infoTextSmall + " mt-1"}>
                  Minimaal 50 woorden aanbevolen
                </p>
              </div>

              {/* Evidence */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Bewijs/Voorbeelden (optioneel)
                </label>
                <textarea
                  value={activeDraft.evidence}
                  onChange={(e) => updateDraft("evidence", e.target.value)}
                  placeholder="Beschrijf concrete voorbeelden of bewijs van je ontwikkeling..."
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Tips */}
              <div className="rounded-xl bg-indigo-50 p-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-900">
                  💡 Tips voor een goede reflectie:
                </h3>
                <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
                  <li>Wees eerlijk en kritisch over je eigen ontwikkeling</li>
                  <li>Geef concrete voorbeelden van situaties</li>
                  <li>Beschrijf wat je hebt geleerd en waarom</li>
                  <li>Kijk vooruit: wat neem je mee naar volgende keer?</li>
                </ul>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.push("/student")}
                className={studentStyles.buttons.secondary + " border px-6 py-2"}
              >
                Annuleren
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={
                  studentStyles.buttons.primary +
                  " px-6 py-2 text-white disabled:opacity-50"
                }
              >
                {submitting
                  ? "Opslaan..."
                  : "Alle Reflecties Indienen"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
