import React from "react";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

type SparklineProps = {
  points: number[];
  max?: number;
};

export function Sparkline({ points, max = 5 }: SparklineProps) {
  if (!points.length) return null;
  const w = 120,
    h = 28,
    pad = 2;
  const xs = points.map(
    (_, i) => pad + (i * (w - pad * 2)) / (points.length - 1 || 1)
  );
  const ys = points.map((p) => h - pad - (p / max) * (h - pad * 2));
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const last = points[points.length - 1];
  const prev = points.length > 1 ? points[points.length - 2] : last;
  const delta = last - prev;
  const dir = delta > 0 ? "▲" : delta < 0 ? "▼" : "▬";
  return (
    <div className="flex items-center gap-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-28">
        <path d={d} fill="none" strokeWidth={2} className="stroke-blue-500" />
      </svg>
      <span className="text-xs text-gray-600">
        {dir} {delta > 0 ? `+${round1(delta)}` : round1(delta)}
      </span>
    </div>
  );
}
