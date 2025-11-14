interface ChecklistItemProps {
  label: string;
}

export function ChecklistItem({ label }: ChecklistItemProps) {
  return (
    <label className="flex items-start gap-1.5 text-[11px] text-slate-600">
      <input type="checkbox" className="mt-[2px] h-3 w-3 rounded border-slate-300" />
      <span>{label}</span>
    </label>
  );
}
