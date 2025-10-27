"use client";

import { useState } from "react";
import { Criterion, ScoreItem } from "@/dtos";

type SelfEvaluationStepProps = {
  allocationId: number;
  criteria: Criterion[];
  onSubmit: (allocationId: number, items: ScoreItem[]) => Promise<void>;
  sending: boolean;
  initialValues?: Record<number, { score: number; comment: string }>;
};

export function SelfEvaluationStep({
  allocationId,
  criteria,
  onSubmit,
  sending,
  initialValues = {},
}: SelfEvaluationStepProps) {
  const [values, setValues] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    criteria.forEach((c) => {
      init[c.id] = initialValues[c.id]?.score ?? 3;
    });
    return init;
  });

  const [comments, setComments] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    criteria.forEach((c) => {
      init[c.id] = initialValues[c.id]?.comment ?? "";
    });
    return init;
  });

  const handleSubmit = async () => {
    const items: ScoreItem[] = criteria.map((c) => ({
      criterion_id: c.id,
      score: values[c.id] ?? 3,
      comment: comments[c.id] || "",
    }));
    await onSubmit(allocationId, items);
  };

  const allScored = criteria.every((c) => {
    const v = values[c.id];
    return v !== undefined && v >= 1 && v <= 5;
  });

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm text-blue-800">
          Beoordeel jezelf op elk criterium. Scores: 1 (zwak) tot 5 (uitstekend).
        </p>
      </div>

      <div className="space-y-4">
        {criteria.map((criterion) => (
          <div
            key={criterion.id}
            className="p-4 border rounded-lg bg-white space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{criterion.name}</h4>
              <span className="text-lg font-semibold text-gray-700">
                {values[criterion.id] ?? 3}
              </span>
            </div>

            <input
              type="range"
              min={1}
              max={5}
              value={values[criterion.id] ?? 3}
              onChange={(e) =>
                setValues((s) => ({ ...s, [criterion.id]: Number(e.target.value) }))
              }
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
            />

            <div className="flex justify-between text-xs text-gray-500">
              <span>1 - Zwak</span>
              <span>3 - Voldoende</span>
              <span>5 - Uitstekend</span>
            </div>

            <textarea
              className="w-full border rounded-lg p-2 text-sm"
              placeholder="Optionele toelichting..."
              value={comments[criterion.id] || ""}
              onChange={(e) =>
                setComments((s) => ({ ...s, [criterion.id]: e.target.value }))
              }
              rows={2}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={handleSubmit}
          disabled={!allScored || sending}
          className="px-6 py-3 rounded-xl bg-black text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
        >
          {sending ? "Bezig..." : "Opslaan & Volgende"}
        </button>
      </div>
    </div>
  );
}
