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
import { studentStyles } from "@/styles/student-dashboard.styles";
import Link from "next/link";

type AnswerMap = Record<number, { rating_value?: number; text_value?: string }>;

function RatingButtons({
  value,
  max,
  onChange,
  disabled,
}: {
  value: number | undefined;
  max: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => !disabled && onChange(n)}
          disabled={disabled}
          className={`w-9 h-9 rounded-xl text-sm font-semibold border transition-colors disabled:cursor-not-allowed ${
            value === n
              ? "bg-slate-800 border-slate-800 text-white"
              : "border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-800 disabled:hover:border-slate-200 disabled:hover:text-slate-600"
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
      <div className={studentStyles.layout.pageContainer}>
        <div className={studentStyles.header.container}>
          <header className={studentStyles.header.wrapper}>
            <div className={studentStyles.header.titleSection}>
              <h1 className={studentStyles.header.title}>Bedankt!</h1>
              <p className={studentStyles.header.subtitle}>
                Je feedback is opgeslagen.
              </p>
            </div>
          </header>
        </div>
        <main className={studentStyles.layout.contentWrapper + " flex flex-col items-center py-16 gap-4"}>
          <div className="text-5xl">✅</div>
          <h2 className={studentStyles.typography.sectionTitle}>Bedankt voor je feedback!</h2>
          <p className={studentStyles.typography.infoText}>Je antwoorden zijn anoniem opgeslagen.</p>
          <button
            type="button"
            onClick={() => router.push("/student?tab=projectfeedback")}
            className={studentStyles.buttons.primary + " mt-2 px-6 py-2 text-sm font-semibold text-white"}
          >
            ← Terug naar dashboard
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className={studentStyles.layout.pageContainer}>
      {/* Header */}
      <div className={studentStyles.header.container}>
        <header className={studentStyles.header.wrapper}>
          <div className={studentStyles.header.titleSection}>
            <div className="mb-1 text-sm text-white/60">
              <Link href="/student?tab=projectfeedback" className="hover:text-white/90 transition-colors">
                ← Projectfeedback
              </Link>
            </div>
            <h1 className={studentStyles.header.title}>{round.title}</h1>
            <p className={studentStyles.header.subtitle}>
              {round.question_count} vragen · Jouw antwoorden zijn anoniem
            </p>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <main className={studentStyles.layout.contentWrapper + " space-y-6"}>
        {alreadySubmitted && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            ✓ Je hebt deze vragenlijst al ingevuld. Je kunt de antwoorden hieronder bekijken.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {round.questions.map((q: ProjectFeedbackQuestion, i: number) => (
              <div
                key={q.id}
                className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0"
              >
                <p className={studentStyles.typography.cardTitle + " mb-3"}>
                  <span className="text-slate-400 mr-1.5 text-sm font-normal">{i + 1}.</span>
                  {q.question_text}
                  {q.is_required && q.question_type !== "open" && (
                    <span className="text-rose-500 ml-0.5">*</span>
                  )}
                </p>

                {q.question_type === "open" ? (
                  <textarea
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
                    placeholder="Typ je antwoord hier…"
                    value={answers[q.id]?.text_value ?? ""}
                    onChange={(e) => setText(q.id, e.target.value)}
                    disabled={alreadySubmitted}
                  />
                ) : (
                  <div className="space-y-1.5">
                    <RatingButtons
                      value={answers[q.id]?.rating_value}
                      max={q.question_type === "scale10" ? 10 : 5}
                      onChange={(v) => setRating(q.id, v)}
                      disabled={alreadySubmitted}
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 px-0.5">
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
          </div>

          {!alreadySubmitted && (
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => router.push("/student?tab=projectfeedback")}
                className={studentStyles.buttons.secondary + " border border-slate-200 px-6 py-2 text-sm font-medium text-slate-700"}
              >
                Annuleren
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={studentStyles.buttons.primary + " px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"}
              >
                {submitting ? "Versturen…" : "Feedback versturen"}
              </button>
            </div>
          )}
        </form>

        {/* Info note */}
        <div className="rounded-xl bg-indigo-50 p-4">
          <p className="text-sm text-slate-700">
            💡 <span className="font-medium">Jouw antwoorden zijn anoniem.</span> De docent ziet alleen geaggregeerde resultaten, niet jouw individuele antwoorden.
          </p>
        </div>
      </main>
    </div>
  );
}

