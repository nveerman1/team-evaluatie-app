"use client";

type KpiTileProps = {
  label: string;
  value: number;
  hint?: string;
};

export function KpiTile({ label, value, hint }: KpiTileProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-[11px] text-gray-400 tracking-wide">{label}</div>
      <div className="text-2xl font-semibold text-gray-900 mt-1">{value}</div>
      {hint && <div className="text-[11px] text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}
