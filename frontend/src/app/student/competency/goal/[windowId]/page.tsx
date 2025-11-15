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
      setCompetencies(comps);
      setExistingGoals(goals);

      // Pre-populate if goal exists
      if (goals.length > 0) {
        const goal = goals[0];
        setFormData({
          window_id: windowId,
          goal_text: goal.goal_text,
          success_criteria: goal.success_criteria || "",
          competency_id: goal.competency_id || undefined,
          status: goal.status,
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

    if (!formData.goal_text.trim()) {
      setError("Leerdoel is verplicht");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await competencyService.createGoal(formData);

      setSuccessMessage("Leerdoel succesvol opgeslagen!");
      setTimeout(() => {
        router.push("/student");
      }, 2000);
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
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
            Leerdoel Instellen
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            Stel een persoonlijk leerdoel in voor {window.title}
          </p>
        </header>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">

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

        {existingGoals.length > 0 && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              💡 Je hebt al een leerdoel voor deze periode. Het onderstaande
              formulier toont je huidige leerdoel. Je kunt een nieuw leerdoel
              toevoegen door op &apos;Opslaan&apos; te klikken.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="p-6 border border-gray-200/80 shadow-sm rounded-xl bg-white space-y-4">
          {/* Competency Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
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
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Geen specifieke competentie</option>
              {competencies.map((comp) => (
                <option key={comp.id} value={comp.id}>
                  {comp.name}
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Selecteer een competentie waarop je je wilt verbeteren
            </p>
          </div>

          {/* Goal Text */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Leerdoel <span className="text-red-600">*</span>
            </label>
            <textarea
              value={formData.goal_text}
              onChange={(e) =>
                setFormData({ ...formData, goal_text: e.target.value })
              }
              placeholder="Wat wil je leren of verbeteren? Bijv. 'Ik wil beter leren samenwerken door actief naar anderen te luisteren'"
              rows={4}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Success Criteria */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Succescriterium (optioneel)
            </label>
            <textarea
              value={formData.success_criteria}
              onChange={(e) =>
                setFormData({ ...formData, success_criteria: e.target.value })
              }
              placeholder="Hoe weet je dat je je doel hebt bereikt? Bijv. 'Ik heb in elke vergadering minimaal 3 keer actief input gegeven op ideeën van anderen'"
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Tips */}
          <div className="p-4 bg-purple-50 rounded-lg">
            <h3 className="text-sm font-semibold mb-2">
              💡 Tips voor een goed leerdoel:
            </h3>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li>Maak het specifiek en meetbaar</li>
              <li>Zorg dat het realistisch en haalbaar is</li>
              <li>Koppel het aan concrete acties</li>
              <li>Denk na over hoe je je voortgang kunt meten</li>
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
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {submitting ? "Opslaan..." : "Leerdoel Opslaan"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
