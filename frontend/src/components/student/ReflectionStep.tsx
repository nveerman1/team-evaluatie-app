"use client";

import { useState, useEffect } from "react";

type ReflectionStepProps = {
  evaluationId: number;
  onSave: (text: string, submit: boolean) => Promise<void>;
  initialText?: string;
  minWords?: number;
  maxWords?: number;
  submitted?: boolean;
};

export function ReflectionStep({
  evaluationId,
  onSave,
  initialText = "",
  minWords = 50,
  maxWords = 500,
  submitted = false,
}: ReflectionStepProps) {
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );

  useEffect(() => {
    setText(initialText);
  }, [initialText]);

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const isValid = wordCount >= minWords && wordCount <= maxWords;

  const handleSave = async (submit: boolean) => {
    setSaving("saving");
    try {
      await onSave(text, submit);
      setSaving("saved");
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

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm text-blue-800">
          Reflecteer op je samenwerking en wat je hebt geleerd. Wat ging goed? Wat
          zou je volgende keer anders doen?
        </p>
      </div>

      {submitted && (
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-sm text-green-800 font-medium">
            ✓ Je reflectie is ingediend en niet meer te bewerken.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Jouw reflectie</label>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${getWordCountColor()}`}>
              {wordCount} / {minWords}-{maxWords} woorden
            </span>
            {saving === "saving" && (
              <span className="text-sm text-gray-600">Opslaan...</span>
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
          className="w-full border rounded-lg p-3 min-h-[200px] focus:ring-2 focus:ring-black focus:border-transparent"
          placeholder="Schrijf hier je reflectie..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={submitted}
        />

        {!isValid && (
          <p className="text-sm text-red-600">
            {wordCount < minWords
              ? `Nog ${minWords - wordCount} woorden nodig.`
              : `${wordCount - maxWords} woorden te veel.`}
          </p>
        )}
      </div>

      {!submitted && (
        <div className="flex justify-end gap-3">
          <button
            onClick={() => handleSave(false)}
            disabled={saving === "saving" || text.trim().length === 0}
            className="px-6 py-3 rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Opslaan (concept)
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={!isValid || saving === "saving"}
            className="px-6 py-3 rounded-xl bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Indienen
          </button>
        </div>
      )}
    </div>
  );
}
