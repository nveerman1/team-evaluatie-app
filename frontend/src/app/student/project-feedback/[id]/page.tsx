"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { projectFeedbackService } from "@/services";
import type {
  ProjectFeedbackRoundDetail,
  ProjectFeedbackQuestion,
} from "@/dtos/project-feedback.dto";
import { ApiAuthError } from "@/lib/api";
import { Loading, ErrorMessage } from "@/components";
import Link from "next/link";

type AnswerMap = Record<number, { rating_value?: number; text_value?: string }>;

function StarRating({
  value,
  max,
  onChange,
}: {
  value: number | undefined;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`w-9 h-9 rounded-lg text-sm font-semibold border transition-colors ${
            value === n
              ? "bg-blue-600 border-blue-600 text-white"
              : "border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function StudentFeedbackFormPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const roundId = Number(id);

  const [round, setRound] = useState<ProjectFeedbackRoundDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await projectFeedbackService.getRound(roundId);
        setRound(data);

        // Pre-fill if already submitted
        try {
          const existing = await projectFeedbackService.getMyResponse(roundId);
          if (existing.submitted_at) {
            setAlreadySubmitted(true);
            const prefill: AnswerMap = {};
            existing.answers.forEach((a) => {
              prefill[a.question_id] = {
                rating_value: a.rating_value ?? undefined,
                text_value: a.text_value ?? undefined,
              };
            });
            setAnswers(prefill);
          }
        } catch {
          // No existing response — that's fine
        }
      } catch (e: any) {
        setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [roundId]);

  function setRating(questionId: number, value: number) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], rating_value: value },
    }));
  }

  function setText(questionId: number, value: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], text_value: value },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!round) return;

    // Validate required questions
    for (const q of round.questions) {
      if (!q.is_required) continue;
      const ans = answers[q.id];
      if (q.question_type !== "open") {
        if (!ans?.rating_value) {
          alert(`Beantwoord vraag ${q.order}: "${q.question_text}"`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      await projectFeedbackService.submitFeedback(roundId, {
        answers: round.questions.map((q) => ({
          question_id: q.id,
          rating_value: answers[q.id]?.rating_value,
          text_value: answers[q.id]?.text_value,
        })),
      });
      setSubmitted(true);
    } catch (e: any) {
      if (e instanceof ApiAuthError) {
        alert(e.originalMessage);
      } else {
        alert(e?.response?.data?.detail || e?.message || "Versturen mislukt");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!round) return null;

  if (submitted) {
    return (
      <main className="max-w-xl mx-auto p-6 space-y-4 text-center">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 space-y-3">
          <div className="text-4xl">✅</div>
          <h2 className="text-xl font-semibold text-gray-900">Bedankt voor je feedback!</h2>
          <p className="text-sm text-gray-600">Je antwoorden zijn opgeslagen.</p>
          <Link
            href="/student/project-feedback"
            className="inline-block mt-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Terug naar overzicht
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-5">
      <header>
        <div className="mb-1">
          <Link
            href="/student/project-feedback"
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ← Terug naar overzicht
          </Link>
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">
          {round.title}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {round.question_count} vragen · Vul eerlijk in, jouw antwoorden zijn anoniem
        </p>
      </header>

      {alreadySubmitted && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          ✓ Je hebt deze vragenlijst al ingevuld. Je kunt de antwoorden hieronder bekijken.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {round.questions.map((q: ProjectFeedbackQuestion, i: number) => (
          <div
            key={q.id}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3"
          >
            <p className="text-sm font-medium text-gray-900">
              <span className="text-gray-400 mr-1">{i + 1}.</span>
              {q.question_text}
              {q.is_required && q.question_type !== "open" && (
                <span className="text-red-500 ml-0.5">*</span>
              )}
            </p>

            {q.question_type === "open" ? (
              <textarea
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Typ je antwoord hier…"
                value={answers[q.id]?.text_value ?? ""}
                onChange={(e) => setText(q.id, e.target.value)}
                disabled={alreadySubmitted}
              />
            ) : (
              <div className="space-y-1">
                <StarRating
                  value={answers[q.id]?.rating_value}
                  max={q.question_type === "scale10" ? 10 : 5}
                  onChange={(v) => !alreadySubmitted && setRating(q.id, v)}
                />
                <div className="flex justify-between text-[10px] text-gray-400 px-0.5">
                  {q.question_type === "scale10" ? (
                    <>
                      <span>1 = heel slecht</span>
                      <span>10 = uitstekend</span>
                    </>
                  ) : (
                    <>
                      <span>1 = helemaal mee oneens</span>
                      <span>5 = helemaal mee eens</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {!alreadySubmitted && (
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? "Versturen…" : "Feedback versturen"}
            </button>
          </div>
        )}
      </form>
    </main>
  );
}
