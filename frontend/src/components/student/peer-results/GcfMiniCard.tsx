import React from "react";

function gcfLabel(value: number): string {
  if (value >= 85) return "uitstekend";
  if (value >= 70) return "boven gemiddeld";
  if (value >= 55) return "gemiddeld";
  if (value >= 40) return "onder gemiddeld";
  return "laag";
}

function gcfHint(): string {
  return "GCF (Team-bijdrage): 0–100. Hoger = je droeg vaker en zichtbaarder bij aan het teamwerk (gebaseerd op peer- en/of zelfevaluaties).";
}

type GcfMiniCardProps = {
  value: number;
};

export function GcfMiniCard({ value }: GcfMiniCardProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className="rounded-lg border border-purple-200 bg-purple-50/60 px-3 py-2 text-xs text-gray-700 shadow-sm w-40 self-start"
      title={gcfHint()}
    >
      <div className="flex items-center justify-between font-medium text-gray-900">
        <span>Team-bijdrage</span>
        <span>{pct}</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-purple-100">
        <div
          className="h-1.5 rounded-full bg-purple-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] text-gray-600 text-right italic">
        {gcfLabel(pct)}
      </p>
    </div>
  );
}
