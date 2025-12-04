"use client";

type KpiTileProps = {
  label: string;
  value: number;
  hint?: string;
};

export function KpiTile({ label, value, hint }: KpiTileProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}
