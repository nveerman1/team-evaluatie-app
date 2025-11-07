"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { competencyService } from "@/services/competency.service";
import type {
  ExternalInvitePublicInfo,
  ExternalScoreSubmit,
} from "@/dtos/competency.dto";

export default function ExternalReviewPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<ExternalInvitePublicInfo | null>(
    null
  );
  const [scores, setScores] = useState<Record<number, number>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerOrg, setReviewerOrg] = useState("");
  const [generalComment, setGeneralComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    loadInviteInfo();
  }, [token]);

  const loadInviteInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const info = await competencyService.getPublicInviteInfo(token);
      setInviteInfo(info);

      // Initialize scores to scale_min (neutral default)
      const initialScores: Record<number, number> = {};
      info.competencies.forEach((comp) => {
        initialScores[comp.id] = Math.ceil((info.scale_min + info.scale_max) / 2);
      });
      setScores(initialScores);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          "Invalid or expired invitation link. Please contact the person who sent you this link."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all competencies have scores
    const allScored = inviteInfo?.competencies.every(
      (comp) => scores[comp.id] !== undefined
    );
    if (!allScored) {
      alert("Please provide a score for all competencies.");
      return;
    }

    try {
      setSubmitting(true);
      const submitData: ExternalScoreSubmit = {
        token,
        scores: Object.entries(scores).map(([competency_id, score]) => ({
          competency_id: parseInt(competency_id),
          score,
          comment: comments[parseInt(competency_id)] || undefined,
        })),
        reviewer_name: reviewerName || undefined,
        reviewer_organization: reviewerOrg || undefined,
        general_comment: generalComment || undefined,
      };

      await competencyService.submitExternalScores(submitData);
      setSubmitted(true);
    } catch (err: any) {
      alert(
        err.response?.data?.detail ||
          "Failed to submit scores. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">
              Invalid Invitation
            </h2>
            <p className="mt-2 text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">
              Thank You!
            </h2>
            <p className="mt-2 text-gray-600">
              Your assessment has been submitted successfully. You can now close
              this window.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!inviteInfo) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Competency Assessment
          </h1>
          <p className="text-gray-600">
            Window: <span className="font-medium">{inviteInfo.window_title}</span>
          </p>
          <p className="text-gray-600">
            Student: <span className="font-medium">{inviteInfo.subject_name}</span>
          </p>
          {inviteInfo.instructions && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-900">{inviteInfo.instructions}</p>
            </div>
          )}
        </div>

        {/* Privacy Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">Privacy Notice</h3>
          <p className="text-sm text-blue-800">
            Your assessment will be processed anonymously and aggregated with other
            external assessments. Only the average scores will be shared with the
            student. The teacher may see individual assessments for coaching
            purposes. You can provide your name and organization optionally below.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Reviewer Information (Optional) */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Your Information (Optional)
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization
                </label>
                <input
                  type="text"
                  value={reviewerOrg}
                  onChange={(e) => setReviewerOrg(e.target.value)}
                  placeholder="Your organization or company"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Competency Assessments */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Competency Assessments
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Rate the student on each competency using the scale below. A higher
              score indicates stronger performance.
            </p>

            <div className="space-y-6">
              {inviteInfo.competencies.map((competency) => (
                <div
                  key={competency.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {competency.name}
                  </h3>
                  {competency.description && (
                    <p className="text-sm text-gray-600 mb-3">
                      {competency.description}
                    </p>
                  )}

                  {/* Score Selection */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Score: {scores[competency.id] || inviteInfo.scale_min}
                    </label>
                    <div className="flex gap-2">
                      {Array.from(
                        {
                          length:
                            inviteInfo.scale_max - inviteInfo.scale_min + 1,
                        },
                        (_, i) => inviteInfo.scale_min + i
                      ).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setScores({ ...scores, [competency.id]: value })
                          }
                          className={`flex-1 py-2 px-3 rounded-md border font-medium transition ${
                            scores[competency.id] === value
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Comment */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Comment (optional)
                    </label>
                    <textarea
                      value={comments[competency.id] || ""}
                      onChange={(e) =>
                        setComments({
                          ...comments,
                          [competency.id]: e.target.value,
                        })
                      }
                      placeholder="Add a comment or explanation for your score..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* General Comment */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              General Comments (Optional)
            </h2>
            <textarea
              value={generalComment}
              onChange={(e) => setGeneralComment(e.target.value)}
              placeholder="Add any overall comments or observations..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {submitting ? "Submitting..." : "Submit Assessment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
