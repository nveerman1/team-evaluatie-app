import React from "react";

type ProgressBarProps = {
  value: number;
  max?: number;
};

export function ProgressBar({ value, max = 5 }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-2 w-full rounded-full bg-gray-100">
      <div
        className="h-2 rounded-full bg-blue-500"
        style={{ width: `${pct}%` }}
        aria-label={`score ${value} van ${max}`}
      />
    </div>
  );
}
