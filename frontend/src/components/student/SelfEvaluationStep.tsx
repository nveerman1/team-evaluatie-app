"use client";

import { useState, useEffect } from "react";
import { Criterion, ScoreItem } from "@/dtos";
import { studentService } from "@/services";
import { RubricRating } from "./RubricRating";

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

  const [loading, setLoading] = useState(false);

  // Load existing scores when component mounts
  useEffect(() => {
    setLoading(true);
    studentService
      .getScores(allocationId)
      .then((scores) => {
        const mapV: Record<number, number> = {};
        const mapC: Record<number, string> = {};
        scores.forEach((item) => {
          mapV[item.criterion_id] = item.score;
          if (item.comment) mapC[item.criterion_id] = item.comment;
        });
        setValues((s) => ({ ...s, ...mapV }));
        setComments((s) => ({ ...s, ...mapC }));
      })
      .catch(() => {
        // No existing scores, use defaults
      })
      .finally(() => setLoading(false));
  }, [allocationId]);

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
          Beoordeel jezelf op elk criterium. Klik op het niveau dat het beste bij jouw prestatie past.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-4 text-gray-500">Laden...</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {(() => {
              // Group criteria by category
              const grouped = criteria.reduce((acc, c) => {
                const cat = c.category || "Overig";
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(c);
                return acc;
              }, {} as Record<string, Criterion[]>);

              // Render each category with its criteria
              return Object.entries(grouped).map(([category, categoryCriteria], categoryIndex) => (
                <div key={category}>
                  {/* Category header */}
                  {categoryIndex === 0 ? (
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80">
                      <h2 className="text-lg font-bold text-gray-900">{category}</h2>
                    </div>
                  ) : (
                    <div className="px-6 py-3 bg-slate-50/50">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{category}</h3>
                    </div>
                  )}
                  {/* Criteria in this category */}
                  {categoryCriteria.map((criterion) => (
                    <RubricRating
                      key={criterion.id}
                      criterion={criterion}
                      value={values[criterion.id] ?? 3}
                      comment={comments[criterion.id] || ""}
                      onChange={(newValue) =>
                        setValues((s) => ({ ...s, [criterion.id]: newValue }))
                      }
                      onCommentChange={(newComment) =>
                        setComments((s) => ({ ...s, [criterion.id]: newComment }))
                      }
                    />
                  ))}
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          onClick={handleSubmit}
          disabled={!allScored || sending || loading}
          className="px-6 py-3 rounded-xl bg-black text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
        >
          {sending ? "Bezig..." : "Opslaan & Volgende"}
        </button>
      </div>
    </div>
  );
}
