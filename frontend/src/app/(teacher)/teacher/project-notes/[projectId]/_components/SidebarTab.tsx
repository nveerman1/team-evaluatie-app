interface SidebarTabProps {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}

export function SidebarTab({
  label,
  description,
  active,
  onClick,
}: SidebarTabProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl px-3 py-2 transition border ${
        active
          ? "bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm"
          : "border-transparent hover:bg-slate-50 text-slate-700"
      }`}
    >
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-slate-500 mt-0.5">{description}</p>
    </button>
  );
}
