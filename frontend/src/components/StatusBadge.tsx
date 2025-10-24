import { EvalStatus } from "@/dtos/evaluation.dto";

const STATUS_LABEL: Record<EvalStatus, string> = {
  draft: "draft",
  open: "open",
  closed: "closed",
};

export function StatusBadge({ status }: { status: EvalStatus }) {
  const styles: Record<EvalStatus, string> = {
    draft: "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
    open: "bg-green-50 text-green-700 ring-1 ring-green-200",
    closed: "bg-gray-100 text-gray-600 ring-1 ring-gray-200",
  };
  return (
    <span
      className={`px-2 py-1 rounded-lg text-xs font-medium ${styles[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
