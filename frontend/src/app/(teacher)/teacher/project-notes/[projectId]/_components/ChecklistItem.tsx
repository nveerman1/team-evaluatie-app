interface ChecklistItemProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function ChecklistItem({ label, checked, onChange }: ChecklistItemProps) {
  return (
    <label className="flex items-start gap-1.5 text-[11px] text-slate-600 cursor-pointer">
      <input 
        type="checkbox" 
        className="mt-[2px] h-3 w-3 rounded border-slate-300 cursor-pointer" 
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
