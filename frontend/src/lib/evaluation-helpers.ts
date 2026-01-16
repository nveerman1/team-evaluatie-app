import type { EvalStatus } from "@/dtos/evaluation.dto";

/**
 * Helper function to check if student can see evaluation results.
 * Students can see results when evaluation is closed or open.
 * Open status allows them to see feedback while still working on the evaluation.
 */
export function canStudentSeeResult(status: EvalStatus): boolean {
  return status === "closed" || status === "open";
}
