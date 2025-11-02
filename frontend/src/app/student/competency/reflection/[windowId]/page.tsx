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
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Reflectie Schrijven</h1>
        <p className="text-gray-600">
          Reflecteer op je competentieontwikkeling tijdens {window.title}
        </p>
      </div>

      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {existingReflection && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-700">
            ⚠️ Je hebt al een reflectie voor deze periode. Let op: het indienen
            van een nieuwe reflectie kan de oude vervangen.
          </p>
        </div>
      )}

      {/* Show goals if any */}
      {goals.length > 0 && (
        <div className="p-5 border rounded-xl bg-purple-50">
          <h3 className="text-lg font-semibold mb-3">Jouw Leerdoelen</h3>
          <div className="space-y-2">
            {goals.map((goal) => (
              <div
                key={goal.id}
                className="p-3 bg-white rounded-lg border border-purple-200"
              >
                <p className="font-medium">{goal.goal_text}</p>
                {goal.success_criteria && (
                  <p className="text-sm text-gray-600 mt-1">
                    Criterium: {goal.success_criteria}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-6 border rounded-xl bg-white space-y-4">
          {/* Goal Selection */}
          {goals.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
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
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-sm font-medium mb-2">
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
                  <span>Ja</span>
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
                  <span>Nee</span>
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
                  <span>Gedeeltelijk</span>
                </label>
              </div>
            </div>
          )}

          {/* Reflection Text */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Reflectie <span className="text-red-600">*</span>
            </label>
            <textarea
              value={formData.text}
              onChange={(e) =>
                setFormData({ ...formData, text: e.target.value })
              }
              placeholder="Reflecteer op je competentieontwikkeling. Wat ging goed? Wat kan beter? Wat heb je geleerd?"
              rows={8}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Minimaal 50 woorden aanbevolen
            </p>
          </div>

          {/* Evidence */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Bewijs/Voorbeelden (optioneel)
            </label>
            <textarea
              value={formData.evidence}
              onChange={(e) =>
                setFormData({ ...formData, evidence: e.target.value })
              }
              placeholder="Beschrijf concrete voorbeelden of bewijs van je ontwikkeling..."
              rows={4}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Tips */}
          <div className="p-4 bg-indigo-50 rounded-lg">
            <h3 className="text-sm font-semibold mb-2">
              💡 Tips voor een goede reflectie:
            </h3>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
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
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
            Annuleren
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Opslaan..." : "Reflectie Indienen"}
          </button>
        </div>
      </form>
    </main>
  );
}
