"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { competencyService, skillTrainingService } from "@/services";
import type {
  CompetencyWindow,
  Competency,
  CompetencyGoal,
  CompetencyGoalCreate,
  StudentTrainingItem,
  SkillTrainingStatus,
} from "@/dtos";
import { STUDENT_ALLOWED_STATUSES } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import { studentStyles } from "@/styles/student-dashboard.styles";
import { ExternalLink } from "lucide-react";

const STATUS_OPTIONS: { value: SkillTrainingStatus; label: string; description: string }[] = [
  { value: "none", label: "Niet gestart", description: "Nog niet van plan" },
  { value: "planned", label: "Gepland", description: "Ik ga deze doen" },
  { value: "in_progress", label: "Bezig", description: "Ik ben hiermee bezig" },
  { value: "submitted", label: "Ingeleverd", description: "Ik heb deze afgerond" },
];

const STATUS_COLORS: Record<SkillTrainingStatus, string> = {
  none: "bg-slate-100 text-slate-700",
  planned: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  submitted: "bg-teal-50 text-teal-700 border-teal-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  mastered: "bg-violet-50 text-violet-700 border-violet-200",
};

const STATUS_LABELS: Record<SkillTrainingStatus, string> = {
  none: "Niet gestart",
  planned: "Gepland",
  in_progress: "Bezig",
  submitted: "Ingeleverd",
  completed: "Voltooid (docent)",
  mastered: "Beheerst (docent)",
};

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
  const [allTrainings, setAllTrainings] = useState<StudentTrainingItem[]>([]);
  const [trainingsLoading, setTrainingsLoading] = useState(false);
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

    // Laad vaardigheidstrainingen
    try {
      setTrainingsLoading(true);
      const trainingsResp = await skillTrainingService.getMyTrainings();
      setAllTrainings(trainingsResp.items);
    } catch (err) {
      console.error("Failed to load trainings:", err);
      setAllTrainings([]);
    } finally {
      setTrainingsLoading(false);
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

  // Geselecteerde competentie opzoeken
  const selectedCompetency = competencies.find(
    (c) => c.id === formData.competency_id
  );

  // Filter trainingen op de category_id van de geselecteerde competentie
  const filteredTrainings = useMemo(() => {
    if (!selectedCompetency?.category_id) return [];
    return allTrainings.filter(
      (item) =>
        item.training.competency_category_id === selectedCompetency.category_id &&
        item.training.is_active
    );
  }, [allTrainings, selectedCompetency]);

  // Samenvattingstelling
  const trainingSummary = useMemo(() => {
    const total = filteredTrainings.length;
    const active = filteredTrainings.filter(
      (t) => t.status === "planned" || t.status === "in_progress" || t.status === "submitted"
    ).length;
    const done = filteredTrainings.filter(
      (t) => t.status === "completed" || t.status === "mastered"
    ).length;
    return { total, active, done };
  }, [filteredTrainings]);

  async function handleTrainingStatusChange(
    item: StudentTrainingItem,
    newStatus: SkillTrainingStatus
  ) {
    // Optimistic update
    setAllTrainings((prev) =>
      prev.map((t) =>
        t.training.id === item.training.id ? { ...t, status: newStatus } : t
      )
    );

    try {
      await skillTrainingService.updateMyStatus(item.training.id, {
        status: newStatus,
      });
    } catch (err) {
      console.error("Failed to update training status:", err);
      // Rollback bij fout
      setAllTrainings((prev) =>
        prev.map((t) =>
          t.training.id === item.training.id ? { ...t, status: item.status } : t
        )
      );
    }
  }

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
                  className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
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
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
            {formData.competency_id && !trainingsLoading && filteredTrainings.length > 0 && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                📚 {filteredTrainings.length} training{filteredTrainings.length !== 1 ? "en" : ""} beschikbaar — zie onder het formulier
              </div>
            )}
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

          {/* Vaardigheidstrainingen sectie */}
          {formData.competency_id && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {/* Sectie header */}
              <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      📚 Vaardigheidstrainingen
                      {selectedCompetency?.category_name && (
                        <span className="font-normal text-slate-500">
                          — {selectedCompetency.category_name}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Gebruik het dropdown-menu in de kolom &quot;Mijn planning&quot; om aan te geven welke trainingen je van plan bent te doen.
                    </p>
                  </div>
                  {filteredTrainings.length > 0 && (
                    <div className="hidden sm:flex items-center gap-3 text-xs">
                      {trainingSummary.active > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700">
                          {trainingSummary.active} ingepland
                        </span>
                      )}
                      {trainingSummary.done > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                          {trainingSummary.done} afgerond
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Tabel */}
              <div>
                {trainingsLoading ? (
                  <div className="text-sm text-slate-500 py-8 text-center">Trainingen laden...</div>
                ) : filteredTrainings.length === 0 ? (
                  <div className="p-6 text-sm text-slate-500 text-center">
                    Geen vaardigheidstrainingen beschikbaar voor deze competentiecategorie.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full w-full">
                      <thead className="bg-white border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Training</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Niveau</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tijd</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Mijn planning</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Link</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredTrainings.map((item) => {
                          const isTeacherSet = item.status === "completed" || item.status === "mastered";
                          return (
                            <tr key={item.training.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-3">
                                <span className="text-sm font-medium text-slate-900">{item.training.title}</span>
                                {item.training.learning_objective_title && (
                                  <div className="text-xs text-slate-500 mt-0.5">{item.training.learning_objective_title}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600">{item.training.level || "–"}</td>
                              <td className="px-4 py-3 text-sm text-slate-600">{item.training.est_minutes || "–"}</td>
                              <td className="px-4 py-3">
                                {isTeacherSet ? (
                                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[item.status]}`}>
                                    {STATUS_LABELS[item.status]}
                                  </span>
                                ) : (
                                  <select
                                    value={item.status}
                                    onChange={(e) => handleTrainingStatusChange(item, e.target.value as SkillTrainingStatus)}
                                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${STATUS_COLORS[item.status]}`}
                                  >
                                    {STATUS_OPTIONS.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label} — {opt.description}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <a
                                  href={item.training.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Open
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

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
