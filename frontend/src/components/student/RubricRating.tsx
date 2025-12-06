"use client";

import { Criterion } from "@/dtos";

type RubricRatingProps = {
  criterion: Criterion;
  value: number;
  comment: string;
  onChange: (value: number) => void;
  onCommentChange: (comment: string) => void;
};

export function RubricRating({
  criterion,
  value,
  comment,
  onChange,
  onCommentChange,
}: RubricRatingProps) {
  const levels = [1, 2, 3, 4, 5];

  return (
    <div className="px-6 py-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          {criterion.name}
        </h3>
        <span className="inline-flex items-baseline gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
          <span className="font-medium text-slate-700">Score</span>
          <span className="text-slate-400">
            {value} / 5
          </span>
        </span>
      </div>

      {/* Score buttons with descriptions - matching external assessment style */}
      <div className="flex flex-col gap-4">
        {/* Levels */}
        <div className="grid grid-cols-5 gap-2">
          {levels.map((level) => {
            const isSelected = value === level;
            const descriptor = criterion.descriptors[`level${level}`] || "";

            return (
              <button
                key={level}
                type="button"
                onClick={() => onChange(level)}
                className={`group flex flex-col items-center justify-start rounded-xl border px-3 py-2 text-center text-xs transition-all hover:border-emerald-500 hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 ${
                  isSelected
                    ? "border-emerald-600 bg-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,0.5)]"
                    : "border-slate-200 bg-white"
                } cursor-pointer`}
              >
                <span
                  className={`mb-1 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold group-hover:border-emerald-500 group-hover:text-emerald-700 ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-300 text-slate-700 bg-slate-50"
                  }`}
                >
                  {level}
                </span>
                {descriptor && (
                  <span className="line-clamp-3 text-[11px] leading-snug text-slate-600">
                    {descriptor}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Comment - below scores */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-600">
              Toelichting
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Optioneel
            </span>
          </div>
          <textarea
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder="Schrijf hier een korte, concrete terugkoppeling..."
            className="min-h-[80px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 shadow-inner outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
          />
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Tip: benoem zowel wat goed gaat als 1 verbeterpunt.</span>
            <span>{comment.length}/400</span>
          </div>
        </div>
      </div>
    </div>
  );
}
