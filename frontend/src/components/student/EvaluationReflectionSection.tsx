"use client";

import { useState, useEffect } from "react";
import { studentService } from "@/services";

type EvaluationReflectionSectionProps = {
  evaluationId: number;
  minWords?: number;
  maxWords?: number;
};

export function EvaluationReflectionSection({
  evaluationId,
  minWords = 50,
  maxWords = 500,
}: EvaluationReflectionSectionProps) {
  const [reflection, setReflection] = useState<{
    text: string;
    submitted_at?: string;
  } | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    if (!evaluationId) return;

    setLoading(true);
    studentService
      .getReflection(evaluationId)
      .then((data) => {
        setReflection(data);
        setText(data?.text || "");
      })
      .catch(() => {
        setReflection(null);
        setText("");
      })
      .finally(() => setLoading(false));
  }, [evaluationId]);

  const wordCount = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).filter(Boolean).length;
  const isValid = wordCount >= minWords && wordCount <= maxWords;
  const submitted = !!reflection?.submitted_at;

  const handleSave = async (submit: boolean) => {
    setSaving("saving");
    setJustSubmitted(false);
    try {
      await studentService.submitReflection(evaluationId, { text, submit });
      const updated = await studentService.getReflection(evaluationId);
      setReflection(updated);
      setSaving("saved");
      if (submit) {
        setJustSubmitted(true);
      }
      setTimeout(() => setSaving("idle"), 2000);
    } catch {
      setSaving("error");
      setTimeout(() => setSaving("idle"), 2000);
    }
  };

  const getWordCountColor = () => {
    if (wordCount < minWords) return "text-red-600";
    if (wordCount > maxWords) return "text-red-600";
    if (wordCount > maxWords * 0.9) return "text-yellow-600";
    return "text-green-600";
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Laden...</p>
      </div>
    );
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Section Header */}
      <div className="mb-4 border-b border-slate-200 pb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Stap 2: Jouw reflectie op dit resultaat
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Na het bekijken van je feedback en scores is het tijd om te reflecteren.
        </p>
      </div>

      {/* Instruction Box */}
      <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <p className="text-sm text-blue-800">
          <strong>Reflecteer op je samenwerking en wat je hebt geleerd.</strong>
          <br />
          Wat ging goed? Wat zou je volgende keer anders doen? Hoe heb je bijgedragen aan het team?
        </p>
      </div>

      {/* Success Message - Shown after submission */}
      {justSubmitted && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            ✓ Je reflectie is ingediend en opgeslagen.
          </p>
        </div>
      )}

      {/* Already Submitted Message */}
      {submitted && !justSubmitted && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            ✓ Je reflectie is ingediend en niet meer te bewerken.
          </p>
        </div>
      )}

      {/* Reflection Text Area */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-900">Jouw reflectie</label>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${getWordCountColor()}`}>
              {wordCount} / {minWords}-{maxWords} woorden
            </span>
            {saving === "saving" && (
              <span className="text-sm text-slate-600">Opslaan...</span>
            )}
            {saving === "saved" && (
              <span className="text-sm text-green-600">✓ Opgeslagen</span>
            )}
            {saving === "error" && (
              <span className="text-sm text-red-600">Fout bij opslaan</span>
            )}
          </div>
        </div>

        <textarea
          className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-transparent focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 min-h-[200px]"
          placeholder="Schrijf hier je reflectie..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={submitted}
        />

        {!isValid && !submitted && (
          <p className="text-sm text-red-600">
            {wordCount < minWords
              ? `Nog ${minWords - wordCount} woorden nodig.`
              : `${wordCount - maxWords} woorden te veel.`}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      {!submitted && (
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => handleSave(false)}
            disabled={saving === "saving" || text.trim().length === 0}
            className="rounded-xl border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Opslaan (concept)
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={!isValid || saving === "saving"}
            className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Indienen
          </button>
        </div>
      )}
    </article>
  );
}
