import { EvalStatus } from "@/dtos/evaluation.dto";

const STATUS_LABEL: Record<EvalStatus, string> = {
  draft: "Concept",
  open: "Open",
  closed: "Gepubliceerd",
};

export function StatusBadge({ status }: { status: EvalStatus }) {
  const styles: Record<EvalStatus, string> = {
    draft: "bg-gray-100 text-gray-700",
    open: "bg-green-100 text-green-700",
    closed: "bg-green-100 text-green-700",
  };
  const icons: Record<EvalStatus, string> = {
    draft: "⚠️",
    open: "✅",
    closed: "✅",
  };
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs ${styles[status]}`}
    >
      {icons[status]} {STATUS_LABEL[status]}
    </span>
  );
}
