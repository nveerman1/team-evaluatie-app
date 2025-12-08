/**
 * Close Project Assessment Button Component
 * 
 * Allows teachers to close and archive project assessments,
 * locking the associated project team roster
 */

"use client";

import { useState } from "react";
import { Lock, AlertCircle } from "lucide-react";

type CloseAssessmentButtonProps = {
  assessmentId: number;
  currentStatus: string;
  onClose?: () => void;
};

export default function CloseAssessmentButton({
  assessmentId,
  currentStatus,
  onClose,
}: CloseAssessmentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isClosed = currentStatus === "closed";

  const handleClose = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/project-assessments/${assessmentId}/close`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Email": localStorage.getItem("user_email") || "",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to close assessment");
      }

      // Success - call onClose callback if provided
      if (onClose) {
        onClose();
      }

      setShowConfirmModal(false);
    } catch (err) {
      console.error("Error closing assessment:", err);
      setError(err instanceof Error ? err.message : "Failed to close assessment");
    } finally {
      setLoading(false);
    }
  };

  if (isClosed) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg border border-gray-300">
        <Lock className="w-4 h-4" />
        <span className="font-medium">Assessment Closed</span>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowConfirmModal(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
      >
        <Lock className="w-4 h-4" />
        Close and Archive
      </button>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Close and Archive Assessment?
                </h3>
                <p className="text-sm text-gray-600">
                  This will mark the assessment as closed and permanently lock the team roster.
                  You will not be able to modify team members after this action.
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setError(null);
                }}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleClose}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Closing...
                  </span>
                ) : (
                  "Yes, Close Assessment"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
