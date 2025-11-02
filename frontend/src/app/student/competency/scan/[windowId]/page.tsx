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
      setCompetencies(comps);

      // Load rubric levels for each competency
      const levelsMap: Record<number, any[]> = {};
      await Promise.all(
        comps.map(async (comp) => {
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

      // Pre-populate with existing scores
      const scoreMap: Record<number, CompetencySelfScoreInput> = {};
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
        score: prev[competencyId]?.score || 3,
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
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">{window.title}</h1>
        <p className="text-gray-600">
          {window.description ||
            "Beoordeel jezelf op de volgende competenties"}
        </p>
        {window.end_date && (
          <p className="text-sm text-gray-500 mt-2">
            Sluit op: {new Date(window.end_date).toLocaleDateString("nl-NL")}
          </p>
        )}
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Competencies */}
        {competencies.map((comp) => {
          const levels = Array.from(
            { length: comp.scale_max - comp.scale_min + 1 },
            (_, i) => comp.scale_min + i
          );
          const currentScore = scores[comp.id]?.score || 3;
          const compRubricLevels = rubricLevels[comp.id] || [];

          // Default labels if no rubric levels are defined
          const defaultLabels = ["Startend", "Basis", "Competent", "Gevorderd", "Excellent"];

          return (
            <div key={comp.id} className="p-5 border rounded-xl bg-white space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">{comp.name}</h3>
                {comp.description && (
                  <p className="text-sm text-gray-600">{comp.description}</p>
                )}
              </div>

              {/* Rubric Button Grid */}
              <div>
                <label className="block text-sm font-medium mb-3">
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
                        className={`p-4 border-2 rounded-lg transition-all ${
                          isSelected
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-300 bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex flex-col items-center gap-2 h-full">
                          {/* Check Icon or Radio Circle - Fixed height container */}
                          <div className="flex items-center justify-center w-6 h-6 flex-shrink-0">
                            {isSelected ? (
                              <svg
                                className="w-6 h-6 text-blue-600"
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
                              <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                            )}
                          </div>

                          {/* Label (instead of number) - Fixed height for alignment */}
                          <span className="text-sm font-semibold text-gray-900 text-center flex-shrink-0">
                            {label}
                          </span>

                          {/* Description - Allow to grow and wrap */}
                          {description && (
                            <span className="text-xs text-gray-600 text-center leading-tight">
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
                <label className="block text-sm font-medium mb-2">
                  Wanneer heb je dit laten zien? (optioneel)
                </label>
                <textarea
                  value={scores[comp.id]?.example || ""}
                  onChange={(e) => handleExampleChange(comp.id, e.target.value)}
                  placeholder="Beschrijf een concreet voorbeeld..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          );
        })}

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
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Opslaan..." : "Scan Indienen"}
          </button>
        </div>
      </form>
    </main>
  );
}
