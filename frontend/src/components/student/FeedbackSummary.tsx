"use client";

import { useState, useEffect } from "react";
import { feedbackSummaryService } from "@/services";
import {
  FeedbackSummaryResponse,
  FeedbackQuote,
} from "@/dtos/feedback-summary.dto";

interface FeedbackSummaryProps {
  evaluationId: number;
  studentId: number;
}

export function FeedbackSummary({
  evaluationId,
  studentId,
}: FeedbackSummaryProps) {
  const [summary, setSummary] = useState<FeedbackSummaryResponse | null>(null);
  const [quotes, setQuotes] = useState<FeedbackQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [showQuotes, setShowQuotes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await feedbackSummaryService.getStudentSummary(
        evaluationId,
        studentId
      );
      setSummary(data);
    } catch (err) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(error?.response?.data?.detail || error?.message || "Laden mislukt");
    } finally {
      setLoading(false);
    }
  };

  const loadQuotes = async () => {
    try {
      const data = await feedbackSummaryService.getFeedbackQuotes(
        evaluationId,
        studentId
      );
      setQuotes(data.quotes || []);
    } catch {
      // Silent fail for quotes
      setQuotes([]);
    }
  };

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluationId, studentId]);

  const handleRegenerate = async () => {
    try {
      setRegenerating(true);
      setError(null);
      const data = await feedbackSummaryService.regenerateSummary(
        evaluationId,
        studentId
      );
      setSummary(data);
    } catch (err) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(
        error?.response?.data?.detail || error?.message || "Regenereren mislukt"
      );
    } finally {
      setRegenerating(false);
    }
  };

  const handleToggleQuotes = async () => {
    if (!showQuotes && quotes.length === 0) {
      await loadQuotes();
    }
    setShowQuotes(!showQuotes);
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <span className="text-red-500 text-xl">⚠️</span>
          <div className="flex-1">
            <h3 className="font-semibold text-red-900 mb-2">Fout</h3>
            <p className="text-sm text-red-800 mb-4">{error}</p>
            <button
              onClick={loadSummary}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              Opnieuw proberen
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-1">
            AI-samenvatting peer-feedback
          </h3>
          {summary.feedback_count > 0 && (
            <p className="text-sm text-gray-500">
              Gebaseerd op {summary.feedback_count} peer-feedback reactie
              {summary.feedback_count !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        {summary.generation_method === "fallback" && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Automatisch (fallback)
          </span>
        )}
        {summary.generation_method === "ai" && summary.cached && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            ✓ Opgeslagen
          </span>
        )}
      </div>

      {/* Summary Text */}
      <div className="prose prose-sm max-w-none">
        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
          {summary.summary_text}
        </p>
      </div>

      {/* Action Buttons */}
      {summary.feedback_count > 0 && (
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            aria-label="Vernieuw samenvatting"
          >
            {regenerating ? "Bezig..." : "🔄 Vernieuw samenvatting"}
          </button>

          <button
            onClick={handleToggleQuotes}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            aria-label="Toon bronquotes"
          >
            {showQuotes ? "▼ Verberg bronquotes" : "▶ Toon bronquotes"}
          </button>
        </div>
      )}

      {/* Quotes Section (Collapsible) */}
      {showQuotes && quotes.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            Anonieme peer-feedback:
          </h4>
          <div className="space-y-2">
            {quotes.map((quote, idx) => (
              <div
                key={idx}
                className="bg-gray-50 border border-gray-200 rounded-lg p-3"
              >
                <p className="text-sm text-gray-700">{quote.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showQuotes && quotes.length === 0 && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-gray-500 italic">
            Geen bronquotes beschikbaar.
          </p>
        </div>
      )}
    </div>
  );
}
