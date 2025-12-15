"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { competencyService } from "@/services";
import type {
  CompetencyWindow,
  CompetencyGoal,
  CompetencyReflection,
  CompetencyReflectionCreate,
} from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import { studentStyles } from "@/styles/student-dashboard.styles";

export default function ReflectionPage() {
  const router = useRouter();
  const params = useParams();
  const windowId = Number(params.windowId);

  const [window, setWindow] = useState<CompetencyWindow | null>(null);
  const [goals, setGoals] = useState<CompetencyGoal[]>([]);
  const [existingReflection, setExistingReflection] =
    useState<CompetencyReflection | null>(null);
  const [formData, setFormData] = useState<CompetencyReflectionCreate>({
    window_id: windowId,
    text: "",
    goal_id: undefined,
    goal_achieved: undefined,
    evidence: "",
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
      const [win, windowGoals, reflections] = await Promise.all([
        competencyService.getWindow(windowId),
        competencyService.getMyGoals(windowId),
        competencyService.getMyReflections(windowId),
      ]);

      setWindow(win);
      setGoals(windowGoals);

      // Pre-populate if reflection exists
      if (reflections.length > 0) {
        const reflection = reflections[0];
        setExistingReflection(reflection);
        setFormData({
          window_id: windowId,
          text: reflection.text,
          goal_id: reflection.goal_id || undefined,
          goal_achieved: reflection.goal_achieved ?? undefined,
          evidence: reflection.evidence || "",
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.text.trim()) {
      setError("Reflectie tekst is verplicht");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await competencyService.createReflection(formData);

      setSuccessMessage("Reflectie succesvol opgeslagen!");
      setTimeout(() => {
        router.push("/student");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save reflection");
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
              Reflectie Schrijven
            </h1>
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

        {existingReflection && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-700">
              ⚠️ Je hebt al een reflectie voor deze periode. Let op: het indienen
              van een nieuwe reflectie kan de oude vervangen.
            </p>
          </div>
        )}

        {/* Show goals if any */}
        {goals.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-indigo-50 p-5 shadow-sm">
          <h3 className={studentStyles.typography.cardTitle + " mb-3"}>Jouw Leerdoelen</h3>
          <div className="space-y-2">
            {goals.map((goal) => (
              <div
                key={goal.id}
                className="rounded-xl border border-indigo-200 bg-white p-3"
              >
                <p className="font-medium text-slate-900">{goal.goal_text}</p>
                {goal.success_criteria && (
                  <p className={studentStyles.typography.infoText + " mt-1"}>
                    Criterium: {goal.success_criteria}
                  </p>
                )}
              </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {/* Goal Selection */}
          {goals.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Gerelateerd Leerdoel (optioneel)
              </label>
              <select
                value={formData.goal_id || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    goal_id: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecteer een leerdoel</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.goal_text.length > 80
                      ? goal.goal_text.substring(0, 80) + '...'
                      : goal.goal_text}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Goal Achieved */}
          {formData.goal_id && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Heb je je leerdoel behaald?
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="goal_achieved"
                    checked={formData.goal_achieved === true}
                    onChange={() =>
                      setFormData({ ...formData, goal_achieved: true })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-slate-700">Ja</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="goal_achieved"
                    checked={formData.goal_achieved === false}
                    onChange={() =>
                      setFormData({ ...formData, goal_achieved: false })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-slate-700">Nee</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="goal_achieved"
                    checked={formData.goal_achieved === undefined}
                    onChange={() =>
                      setFormData({ ...formData, goal_achieved: undefined })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-slate-700">Gedeeltelijk</span>
                </label>
              </div>
            </div>
          )}

          {/* Reflection Text */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Reflectie <span className="text-rose-600">*</span>
            </label>
            <textarea
              value={formData.text}
              onChange={(e) =>
                setFormData({ ...formData, text: e.target.value })
              }
              placeholder="Reflecteer op je competentieontwikkeling. Wat ging goed? Wat kan beter? Wat heb je geleerd?"
              rows={8}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
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
              value={formData.evidence}
              onChange={(e) =>
                setFormData({ ...formData, evidence: e.target.value })
              }
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
              className={studentStyles.buttons.primary + " px-6 py-2 text-white disabled:opacity-50"}
            >
              {submitting ? "Opslaan..." : "Reflectie Indienen"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
