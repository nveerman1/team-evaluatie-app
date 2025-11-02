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
  const [existingScores, setExistingScores] = useState<CompetencySelfScore[]>(
    []
  );
  const [scores, setScores] = useState<Record<number, CompetencySelfScoreInput>>(
    {}
  );
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
      const [win, comps, existing] = await Promise.all([
        competencyService.getWindow(windowId),
        competencyService.getCompetencies(true),
        competencyService.getMySelfScores(windowId),
      ]);

      setWindow(win);
      setCompetencies(comps);
      setExistingScores(existing);

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

  const scaleLabels = competencies[0]?.scale_labels || {};

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
        {competencies.map((comp) => (
          <div key={comp.id} className="p-5 border rounded-xl bg-white">
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-1">{comp.name}</h3>
              {comp.description && (
                <p className="text-sm text-gray-600">{comp.description}</p>
              )}
            </div>

            {/* Score Slider */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Score: {scores[comp.id]?.score || 3}
                {scaleLabels[String(scores[comp.id]?.score || 3)] && (
                  <span className="ml-2 text-gray-600">
                    ({scaleLabels[String(scores[comp.id]?.score || 3)]})
                  </span>
                )}
              </label>
              <input
                type="range"
                min={comp.scale_min}
                max={comp.scale_max}
                value={scores[comp.id]?.score || 3}
                onChange={(e) =>
                  handleScoreChange(comp.id, Number(e.target.value))
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>
                  {comp.scale_min}{" "}
                  {scaleLabels[String(comp.scale_min)] &&
                    `(${scaleLabels[String(comp.scale_min)]})`}
                </span>
                <span>
                  {comp.scale_max}{" "}
                  {scaleLabels[String(comp.scale_max)] &&
                    `(${scaleLabels[String(comp.scale_max)]})`}
                </span>
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
        ))}

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
