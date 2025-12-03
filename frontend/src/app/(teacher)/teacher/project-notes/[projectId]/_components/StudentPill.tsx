"use client";

interface StudentPillProps {
  name: string;
  active: boolean;
  onClick: () => void;
}

export function StudentPill({ name, active, onClick }: StudentPillProps) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm text-center shadow-sm transition ${
        active
          ? "bg-indigo-100 border-indigo-300 text-indigo-800"
          : "bg-white border-slate-300 text-slate-800 hover:bg-indigo-50"
      }`}
    >
      {name}
    </button>
  );
}
