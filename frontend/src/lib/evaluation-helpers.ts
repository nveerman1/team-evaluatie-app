import type { EvalStatus } from "@/dtos/evaluation.dto";

/**
 * Helper function to check if student can see evaluation results.
 * Students can see results only when evaluation is closed (published).
 */
export function canStudentSeeResult(status: EvalStatus): boolean {
  return status === "closed";
}
