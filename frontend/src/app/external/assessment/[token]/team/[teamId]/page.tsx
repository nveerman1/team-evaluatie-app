"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { externalAssessmentService } from "@/services/external-assessment.service";
import type {
  ExternalAssessmentDetail,
  ExternalAssessmentScoreSubmit,
  RubricCriterionForExternal,
} from "@/dtos/external-assessment.dto";

/**
 * Helper function to get descriptor for a level from criterion.descriptors.
 * Handles different formats the data might be in (object, array, etc.)
 */
function getDescriptorForLevel(
  criterion: RubricCriterionForExternal,
  level: number,
  scaleMin: number
): string {
  const raw: any = criterion.descriptors;

  if (!raw) return "";

  // Case 1: array of strings, index based on scale-min
  if (Array.isArray(raw) && typeof raw[0] === "string") {
    const idx = level - scaleMin;
    return raw[idx] ?? "";
  }

  // Case 2: array of objects with level + description/text
  if (Array.isArray(raw) && typeof raw[0] === "object") {
    const match = raw.find(
      (d: any) =>
        d &&
        (d.level === level ||
          d.value === level ||
          d.score === level ||
          d.index === level - scaleMin)
    );
    if (!match) return "";
    return match.description ?? match.text ?? match.label ?? "";
  }

  // Case 3: plain object: { "1": "description", "2": "..." } or { 1: "...", ... }
  if (typeof raw === "object") {
    // 3a: direct key lookup (1, "1")
    let v = raw[level] ?? raw[String(level)];
    if (v !== undefined) {
      if (typeof v === "string") return v;
      if (typeof v === "object") {
        return v.description ?? v.text ?? v.label ?? "";
      }
    }

    // 3b: sort keys and index based on scale-min
    const keys = Object.keys(raw).sort((a, b) => Number(a) - Number(b));
    const idx = level - scaleMin;
    const key = keys[idx];
    if (key !== undefined) {
      const val = raw[key];
      if (typeof val === "string") return val;
      if (typeof val === "object") {
        return val.description ?? val.text ?? val.label ?? "";
      }
    }
  }

  return "";
}

export default function ExternalAssessmentTeamPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const teamId = parseInt(params.teamId as string);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExternalAssessmentDetail | null>(null);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [generalComment, setGeneralComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    loadDetail();
  }, [token, teamId]);

  const loadDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await externalAssessmentService.getTeamDetail(token, teamId);
      setDetail(data);

      // Initialize scores from existing data or defaults
      const initialScores: Record<number, number> = {};
      const initialComments: Record<number, string> = {};

      data.rubric.criteria.forEach((criterion) => {
        const existing = data.existing_scores.find(
          (s) => s.criterion_id === criterion.id
        );
        if (existing) {
          initialScores[criterion.id] = existing.score;
          if (existing.comment) {
            initialComments[criterion.id] = existing.comment;
          }
        } else {
          // Default to middle of scale
          initialScores[criterion.id] = Math.ceil(
            (data.rubric.scale_min + data.rubric.scale_max) / 2
          );
        }
      });

      setScores(initialScores);
      setComments(initialComments);
      setGeneralComment(data.general_comment || "");
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          "Fout bij het laden van de beoordeling. Probeer het opnieuw."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (criterionId: number, score: number) => {
    setScores((prev) => ({ ...prev, [criterionId]: score }));
  };

  const handleCommentChange = (criterionId: number, comment: string) => {
    setComments((prev) => ({ ...prev, [criterionId]: comment }));
  };

  const handleSave = async (submit: boolean) => {
    setValidationError(null);

    // Validate all criteria have scores
    const allScored = detail?.rubric.criteria.every(
      (c) => scores[c.id] !== undefined
    );
    if (!allScored) {
      setValidationError("Geef voor alle criteria een score.");
      return;
    }

    try {
      setSubmitting(true);

      const submitScores: ExternalAssessmentScoreSubmit[] =
        detail?.rubric.criteria.map((c) => ({
          criterion_id: c.id,
          score: scores[c.id],
          comment: comments[c.id] || undefined,
        })) || [];

      const response = await externalAssessmentService.submitAssessment(
        token,
        teamId,
        {
          scores: submitScores,
          general_comment: generalComment || undefined,
          submit,
        }
      );

      if (submit) {
        // Show success and redirect to overview
        alert(
          "Beoordeling succesvol ingeleverd! De docent ontvangt je advies."
        );
        router.push(`/external/assessment/${token}`);
      } else {
        // Show success message for draft save
        alert("Concept opgeslagen! Je kunt later terugkomen om verder te werken.");
        // Reload to get updated status
        await loadDetail();
      }
    } catch (err: any) {
      setValidationError(
        err.response?.data?.detail ||
          "Fout bij het opslaan. Probeer het opnieuw."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isReadOnly = detail?.status === "SUBMITTED";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Laden...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 text-center mb-2">
            Fout bij laden
          </h2>
          <p className="text-gray-600 text-center mb-4">{error}</p>
          <button
            onClick={() => router.push(`/external/assessment/${token}`)}
            className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md"
          >
            Terug naar overzicht
          </button>
        </div>
      </div>
    );
  }

  if (!detail) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.push(`/external/assessment/${token}`)}
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Terug naar overzicht
            </button>
            {isReadOnly && (
              <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                Ingeleverd
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {detail.team_number ? `Team ${detail.team_number}` : detail.team_name}
          </h1>
          {detail.members && (
            <p className="text-sm text-gray-500 mb-2">
              {detail.members}
            </p>
          )}
          {detail.project_title && (
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">Project:</span>{" "}
              {detail.project_title}
            </p>
          )}
          {detail.project_description && (
            <p className="text-sm text-gray-600 mt-2">
              {detail.project_description}
            </p>
          )}
        </div>

        {/* Validation Error */}
        {validationError && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{validationError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Rubric */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80">
            <h2 className="text-lg font-bold text-gray-900">
              {detail.rubric.title}
            </h2>
            {detail.rubric.description && (
              <p className="text-sm text-gray-600 mt-1">
                {detail.rubric.description}
              </p>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {detail.rubric.criteria.map((criterion, idx) => {
              const currentScore = scores[criterion.id] ?? detail.rubric.scale_min;
              const currentComment = comments[criterion.id] ?? "";

              return (
                <div key={criterion.id} className="px-6 py-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                      {criterion.name}
                      {criterion.category && (
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          ({criterion.category})
                        </span>
                      )}
                    </h3>
                    <span className="inline-flex items-baseline gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                      <span className="font-medium text-slate-700">Score</span>
                      <span className="text-slate-400">
                        {currentScore} / {detail.rubric.scale_max}
                      </span>
                    </span>
                  </div>

                  {/* Score buttons with descriptions - matching teacher edit style */}
                  <div className="flex flex-col gap-4">
                    {/* Levels */}
                    <div className="grid grid-cols-5 gap-2">
                      {Array.from(
                        { length: detail.rubric.scale_max - detail.rubric.scale_min + 1 },
                        (_, i) => i + detail.rubric.scale_min
                      ).map((level) => {
                        const isSelected = currentScore === level;
                        const descriptor = getDescriptorForLevel(
                          criterion,
                          level,
                          detail.rubric.scale_min
                        );

                        return (
                          <button
                            key={level}
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => handleScoreChange(criterion.id, level)}
                            className={`group flex flex-col items-center justify-start rounded-xl border px-3 py-2 text-center text-xs transition-all hover:border-emerald-500 hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 ${
                              isSelected
                                ? "border-emerald-600 bg-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,0.5)]"
                                : "border-slate-200 bg-white"
                            } ${
                              isReadOnly
                                ? "cursor-not-allowed opacity-60"
                                : "cursor-pointer"
                            }`}
                          >
                            <span
                              className={`mb-1 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold group-hover:border-emerald-500 group-hover:text-emerald-700 ${
                                isSelected
                                  ? "border-emerald-600 bg-emerald-600 text-white"
                                  : "border-slate-300 text-slate-700 bg-slate-50"
                              }`}
                            >
                              {level}
                            </span>
                            {descriptor && (
                              <span className="line-clamp-3 text-[11px] leading-snug text-slate-600">
                                {descriptor}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Comment - below scores */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-600">
                          Toelichting
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                          Optioneel
                        </span>
                      </div>
                      <textarea
                        value={currentComment}
                        onChange={(e) =>
                          handleCommentChange(criterion.id, e.target.value)
                        }
                        disabled={isReadOnly}
                        placeholder="Schrijf hier een korte, concrete terugkoppeling..."
                        className="min-h-[80px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 shadow-inner outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Tip: benoem zowel wat goed gaat als 1 verbeterpunt.</span>
                        <span>{currentComment.length}/400</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* General Comment */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <label
            htmlFor="general-comment"
            className="block text-lg font-medium text-gray-900 mb-3"
          >
            Algemeen advies voor dit team (optioneel):
          </label>
          <textarea
            id="general-comment"
            value={generalComment}
            onChange={(e) => setGeneralComment(e.target.value)}
            disabled={isReadOnly}
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="Vul hier je algemene feedback en advies voor het team in..."
          />
        </div>

        {/* Action Buttons */}
        {!isReadOnly && (
          <div className="flex gap-4 justify-end">
            <button
              onClick={() => handleSave(false)}
              disabled={submitting}
              className="px-6 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Bezig..." : "Opslaan als concept"}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={submitting}
              className="px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Bezig..." : "Versturen"}
            </button>
          </div>
        )}

        {isReadOnly && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-green-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  Deze beoordeling is ingeleverd. Je kunt deze niet meer
                  aanpassen.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
