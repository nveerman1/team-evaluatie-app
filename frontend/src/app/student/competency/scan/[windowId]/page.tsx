"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { competencyService } from "@/services";
import type {
  CompetencyWindow,
  Competency,
  CompetencySelfScore,
  CompetencySelfScoreInput,
} from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import { studentStyles } from "@/styles/student-dashboard.styles";

export default function SelfScanPage() {
  const router = useRouter();
  const params = useParams();
  const windowId = Number(params.windowId);

  const [window, setWindow] = useState<CompetencyWindow | null>(null);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [rubricLevels, setRubricLevels] = useState<Record<number, any[]>>({});

  const [scores, setScores] = useState<Record<number, CompetencySelfScoreInput>>(
    {}
  );
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
      const [win, comps, existing] = await Promise.all([
        competencyService.getWindow(windowId),
        competencyService.getCompetencies(true),
        competencyService.getMySelfScores(windowId),
      ]);

      setWindow(win);
      
      // Filter competencies to only show those selected for this window
      const selectedCompetencyIds = win.settings?.selected_competency_ids || [];
      const filteredComps = selectedCompetencyIds.length > 0
        ? comps.filter((comp) => selectedCompetencyIds.includes(comp.id))
        : comps; // Fallback: show all if no selection (backward compatibility)
      
      setCompetencies(filteredComps);

      // Load rubric levels for each competency (only filtered ones)
      const levelsMap: Record<number, any[]> = {};
      await Promise.all(
        filteredComps.map(async (comp) => {
          try {
            const levels = await competencyService.getRubricLevels(comp.id);
            levelsMap[comp.id] = levels;
          } catch (err) {
            // If no rubric levels exist, use empty array
            levelsMap[comp.id] = [];
          }
        })
      );
      setRubricLevels(levelsMap);

      // Pre-populate with existing scores or defaults
      const scoreMap: Record<number, CompetencySelfScoreInput> = {};
      
      // First, initialize all competencies with default score of 1
      filteredComps.forEach((comp) => {
        scoreMap[comp.id] = {
          competency_id: comp.id,
          score: 1,
          example: "",
        };
      });
      
      // Then override with existing scores if any
      existing.forEach((score) => {
        scoreMap[score.competency_id] = {
          competency_id: score.competency_id,
          score: score.score,
          example: score.example || "",
        };
      });
      setScores(scoreMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (competencyId: number, score: number) => {
    setScores((prev) => ({
      ...prev,
      [competencyId]: {
        competency_id: competencyId,
        score,
        example: prev[competencyId]?.example || "",
      },
    }));
  };

  const handleExampleChange = (competencyId: number, example: string) => {
    setScores((prev) => ({
      ...prev,
      [competencyId]: {
        competency_id: competencyId,
        score: prev[competencyId]?.score || 1,
        example,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all competencies have scores
    const missingScores = competencies.filter((comp) => !scores[comp.id]);
    if (missingScores.length > 0) {
      setError(
        `Vul alle competenties in. Ontbrekend: ${missingScores.map((c) => c.name).join(", ")}`
      );
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await competencyService.submitSelfScores({
        window_id: windowId,
        scores: Object.values(scores),
      });

      setSuccessMessage("Scan succesvol ingediend!");
      setTimeout(() => {
        router.push("/student");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit scores");
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
              {window.title}
            </h1>
            <p className={studentStyles.header.subtitle}>
              {window.description ||
                "Beoordeel jezelf op de volgende competenties"}
            </p>
            {window.end_date && (
              <p className="mt-2 text-sm text-white/60">
                Sluit op: {new Date(window.end_date).toLocaleDateString("nl-NL")}
              </p>
            )}
          </div>
        </header>
      </div>

      {/* Main Content */}
      <main className={studentStyles.layout.contentWrapper + " space-y-6"}>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Competencies */}
          {competencies.map((comp) => {
          const levels = Array.from(
            { length: comp.scale_max - comp.scale_min + 1 },
            (_, i) => comp.scale_min + i
          );
          const currentScore = scores[comp.id]?.score || 1;
          const compRubricLevels = rubricLevels[comp.id] || [];

          // Default labels if no rubric levels are defined
          const defaultLabels = ["Startend", "Basis", "Competent", "Gevorderd", "Excellent"];

            return (
              <div key={comp.id} className="rounded-2xl border-slate-200 bg-white shadow-sm p-5 space-y-4">
              <div>
                <h3 className={studentStyles.typography.cardTitle}>{comp.name}</h3>
                {comp.description && (
                  <p className={studentStyles.typography.infoText}>{comp.description}</p>
                )}
              </div>

              {/* Rubric Button Grid */}
              <div>
                <label className="mb-3 block text-sm font-medium text-slate-700">
                  Selecteer je score:
                </label>
                <div className="grid grid-cols-5 gap-3">
                  {levels.map((level) => {
                    const isSelected = currentScore === level;
                    // Get rubric level data or fall back to scale_labels or defaults
                    const rubricLevel = compRubricLevels.find((rl: any) => rl.level === level);
                    const label = rubricLevel?.label || comp.scale_labels[String(level)] || defaultLabels[level - 1] || `Niveau ${level}`;
                    const description = rubricLevel?.description || "";

                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => handleScoreChange(comp.id, level)}
                        className={`rounded-xl border-2 p-4 transition-all ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex h-full flex-col items-center gap-2">
                          {/* Check Icon or Radio Circle - Fixed height container */}
                          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
                            {isSelected ? (
                              <svg
                                className="h-6 w-6 text-indigo-600"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            ) : (
                              <div className="h-5 w-5 rounded-full border-2 border-slate-300" />
                            )}
                          </div>

                          {/* Label (instead of number) - Fixed height for alignment */}
                          <span className="flex-shrink-0 text-center text-sm font-semibold text-slate-900">
                            {label}
                          </span>

                          {/* Description - Allow to grow and wrap */}
                          {description && (
                            <span className="text-center text-xs leading-tight text-slate-600">
                              {description}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Example (Optional) */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Wanneer heb je dit laten zien? (optioneel)
                </label>
                <textarea
                  value={scores[comp.id]?.example || ""}
                  onChange={(e) => handleExampleChange(comp.id, e.target.value)}
                  placeholder="Beschrijf een concreet voorbeeld..."
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            );
          })}

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
              {submitting ? "Opslaan..." : "Scan Indienen"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
