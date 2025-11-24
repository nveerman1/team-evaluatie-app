"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { externalAssessmentService } from "@/services/external-assessment.service";
import type {
  ExternalAssessmentDetail,
  ExternalAssessmentScoreSubmit,
} from "@/dtos/external-assessment.dto";

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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {detail.team_name}
          </h1>
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
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {detail.rubric.title}
          </h2>
          {detail.rubric.description && (
            <p className="text-sm text-gray-600 mb-6">
              {detail.rubric.description}
            </p>
          )}

          <div className="space-y-6">
            {detail.rubric.criteria.map((criterion, idx) => (
              <div key={criterion.id} className="border-t pt-6 first:border-t-0 first:pt-0">
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  {criterion.name}
                  {criterion.category && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({criterion.category})
                    </span>
                  )}
                </h3>

                {/* Score buttons */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Score:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(
                      { length: detail.rubric.scale_max - detail.rubric.scale_min + 1 },
                      (_, i) => i + detail.rubric.scale_min
                    ).map((level) => {
                      const isSelected = scores[criterion.id] === level;
                      const descriptor = criterion.descriptors[level.toString()];
                      
                      return (
                        <button
                          key={level}
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => handleScoreChange(criterion.id, level)}
                          className={`flex-1 min-w-[80px] px-4 py-3 rounded-lg border-2 transition-all ${
                            isSelected
                              ? "border-blue-600 bg-blue-50 text-blue-900 font-semibold"
                              : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                          } ${
                            isReadOnly
                              ? "cursor-not-allowed opacity-60"
                              : "cursor-pointer"
                          }`}
                          title={descriptor}
                        >
                          <div className="text-center">
                            <div className="text-xl font-bold">{level}</div>
                            {descriptor && (
                              <div className="text-xs mt-1 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                {descriptor}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <label
                    htmlFor={`comment-${criterion.id}`}
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Toelichting (optioneel):
                  </label>
                  <textarea
                    id={`comment-${criterion.id}`}
                    value={comments[criterion.id] || ""}
                    onChange={(e) =>
                      handleCommentChange(criterion.id, e.target.value)
                    }
                    disabled={isReadOnly}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Optionele toelichting bij deze score..."
                  />
                </div>
              </div>
            ))}
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
