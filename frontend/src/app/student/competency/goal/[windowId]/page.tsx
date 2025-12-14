"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { competencyService } from "@/services";
import type {
  CompetencyWindow,
  Competency,
  CompetencyGoal,
  CompetencyGoalCreate,
} from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import { studentStyles } from "@/styles/student-dashboard.styles";

export default function GoalPage() {
  const router = useRouter();
  const params = useParams();
  const windowId = Number(params.windowId);

  const [window, setWindow] = useState<CompetencyWindow | null>(null);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [existingGoals, setExistingGoals] = useState<CompetencyGoal[]>([]);
  const [formData, setFormData] = useState<CompetencyGoalCreate>({
    window_id: windowId,
    goal_text: "",
    success_criteria: "",
    competency_id: undefined,
    status: "in_progress",
  });
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
      const [win, comps, goals] = await Promise.all([
        competencyService.getWindow(windowId),
        competencyService.getCompetencies(true),
        competencyService.getMyGoals(windowId),
      ]);

      setWindow(win);
      
      // Filter competencies to only show those selected for this window
      const selectedCompetencyIds = win.settings?.selected_competency_ids || [];
      const filteredComps = selectedCompetencyIds.length > 0
        ? comps.filter((comp) => selectedCompetencyIds.includes(comp.id))
        : comps; // Fallback: show all if no selection (backward compatibility)
      
      setCompetencies(filteredComps);
      setExistingGoals(goals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.goal_text.trim()) {
      setError("Leerdoel is verplicht");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await competencyService.createGoal(formData);

      setSuccessMessage("Leerdoel succesvol opgeslagen!");
      
      // Reset form to allow adding another goal
      setFormData({
        window_id: windowId,
        goal_text: "",
        success_criteria: "",
        competency_id: undefined,
        status: "in_progress",
      });
      
      // Reload goals to show the new one
      const goals = await competencyService.getMyGoals(windowId);
      setExistingGoals(goals);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save goal");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;
  if (error && !window) return <ErrorMessage message={error} />;
  if (!window) return <ErrorMessage message="Window not found" />;

  return (
    <div className={studentStyles.layout.pageContainer}>
      {/* Header */}
      <div className={studentStyles.header.container}>
        <header className={studentStyles.header.wrapper}>
          <div className={studentStyles.header.titleSection}>
            <h1 className={studentStyles.header.title}>
              Leerdoel Instellen
            </h1>
            <p className={studentStyles.header.subtitle}>
              Stel een persoonlijk leerdoel in voor {window.title}
            </p>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <main className={studentStyles.layout.contentWrapper + " space-y-6"}>

        {/* Existing Goals List */}
        {existingGoals.length > 0 && (
          <div className="space-y-4">
            <h2 className={studentStyles.typography.sectionTitle}>
              Mijn Leerdoelen ({existingGoals.length})
            </h2>
            {existingGoals.map((goal) => {
              const competency = competencies.find((c) => c.id === goal.competency_id);
              return (
                <div
                  key={goal.id}
                  className="space-y-3 rounded-2xl border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {competency && (
                        <div className="mb-1 text-sm font-medium text-indigo-600">
                          {competency.name}
                        </div>
                      )}
                      <p className={studentStyles.typography.cardTitle}>{goal.goal_text}</p>
                      {goal.success_criteria && (
                        <div className="mt-2">
                          <p className={studentStyles.typography.infoText}>
                            <span className="font-medium">Succescriterium:</span>{" "}
                            {goal.success_criteria}
                          </p>
                        </div>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        goal.status === "achieved"
                          ? studentStyles.badges.completedGoal
                          : goal.status === "not_achieved"
                          ? "bg-rose-50 text-rose-700 border border-rose-100"
                          : studentStyles.badges.activeGoal
                      }`}
                    >
                      {goal.status === "achieved"
                        ? "Behaald"
                        : goal.status === "not_achieved"
                        ? "Niet behaald"
                        : "Bezig"}
                    </span>
                  </div>
                  {goal.submitted_at && (
                    <p className={studentStyles.typography.metaTextSmall}>
                      Aangemaakt op:{" "}
                      {new Date(goal.submitted_at).toLocaleDateString("nl-NL")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* New Goal Form */}
        <div>
          <h2 className={studentStyles.typography.sectionTitle + " mb-4"}>
            {existingGoals.length > 0 ? "Nieuw Leerdoel Toevoegen" : "Leerdoel Aanmaken"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4 rounded-2xl border-slate-200 bg-white p-6 shadow-sm">
          {/* Competency Selection */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Gerelateerde Competentie (optioneel)
            </label>
            <select
              value={formData.competency_id || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  competency_id: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Geen specifieke competentie</option>
              {competencies.map((comp) => (
                <option key={comp.id} value={comp.id}>
                  {comp.name}
                </option>
              ))}
            </select>
            <p className={studentStyles.typography.infoTextSmall + " mt-1"}>
              Selecteer een competentie waarop je je wilt verbeteren
            </p>
          </div>

          {/* Goal Text */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Leerdoel <span className="text-rose-600">*</span>
            </label>
            <textarea
              value={formData.goal_text}
              onChange={(e) =>
                setFormData({ ...formData, goal_text: e.target.value })
              }
              placeholder="Wat wil je leren of verbeteren? Bijv. 'Ik wil beter leren samenwerken door actief naar anderen te luisteren'"
              rows={4}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Success Criteria */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Succescriterium (optioneel)
            </label>
            <textarea
              value={formData.success_criteria}
              onChange={(e) =>
                setFormData({ ...formData, success_criteria: e.target.value })
              }
              placeholder="Hoe weet je dat je je doel hebt bereikt? Bijv. 'Ik heb in elke vergadering minimaal 3 keer actief input gegeven op ideeën van anderen'"
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Tips */}
          <div className="rounded-xl bg-indigo-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">
              💡 Tips voor een goed leerdoel:
            </h3>
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
              <li>Maak het specifiek en meetbaar</li>
              <li>Zorg dat het realistisch en haalbaar is</li>
              <li>Koppel het aan concrete acties</li>
              <li>Denk na over hoe je je voortgang kunt meten</li>
              </ul>
            </div>
          </div>

          {/* Messages */}
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
              className={studentStyles.buttons.primary + " px-6 py-2 text-white disabled:opacity-50"}
            >
              {submitting ? "Opslaan..." : "Leerdoel Opslaan"}
            </button>
          </div>
        </form>
        </div>
      </main>
    </div>
  );
}
