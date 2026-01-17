/**
 * Project Assessment Status Utilities
 * 
 * Centralizes status normalization and display logic for project assessments.
 * Ensures consistency between status toggle, cards, and detail views.
 */

export type ProjectAssessmentStatus = "draft" | "open" | "published";

/**
 * Normalizes raw status values to a consistent format.
 * Maps legacy "closed" status to "published" for backward compatibility.
 * 
 * @param rawStatus - Raw status from API
 * @returns Normalized status
 */
export function normalizeProjectAssessmentStatus(
  rawStatus: string | undefined | null
): ProjectAssessmentStatus {
  if (!rawStatus) return "draft";
  
  const normalized = rawStatus.toLowerCase().trim();
  
  // Map closed/gesloten to published for backward compatibility
  if (normalized === "closed" || normalized === "gesloten") {
    return "published";
  }
  
  // Return valid statuses
  if (normalized === "open") return "open";
  if (normalized === "published" || normalized === "gepubliceerd") return "published";
  
  // Default to draft for unknown statuses
  return "draft";
}

/**
 * Status pill display properties
 */
type StatusPillProps = {
  label: string;
  className: string;
};

/**
 * Gets the display properties for a status pill/badge.
 * 
 * @param status - Normalized status
 * @returns Display label and CSS classes
 */
export function getStatusPillProps(status: ProjectAssessmentStatus): StatusPillProps {
  switch (status) {
    case "open":
      return {
        label: "Open",
        className: "inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-100",
      };
    case "published":
      return {
        label: "Gepubliceerd",
        className: "inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-100",
      };
    case "draft":
    default:
      return {
        label: "Concept",
        className: "inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-100",
      };
  }
}

/**
 * Gets the display properties for student-facing status badges.
 * Uses different styling appropriate for student views.
 * 
 * @param status - Normalized status
 * @returns Display label and CSS classes
 */
export function getStudentStatusBadgeProps(status: ProjectAssessmentStatus): StatusPillProps {
  switch (status) {
    case "open":
      return {
        label: "Open",
        className: "rounded-full bg-blue-600 text-white",
      };
    case "published":
      return {
        label: "Gepubliceerd",
        className: "rounded-full bg-slate-100 text-slate-700",
      };
    case "draft":
    default:
      return {
        label: "Concept",
        className: "rounded-full bg-slate-900 text-white",
      };
  }
}

/**
 * Status options for the toggle component
 */
export const STATUS_TOGGLE_OPTIONS = [
  { value: "draft", label: "Concept" },
  { value: "open", label: "Open" },
  { value: "published", label: "Gepubliceerd" },
] as const;

/**
 * Gets the toast message for a status change
 * 
 * @param newStatus - The new status
 * @returns User-friendly message
 */
export function getStatusChangeMessage(newStatus: ProjectAssessmentStatus): string {
  switch (newStatus) {
    case "draft":
      return "Status gewijzigd naar Concept";
    case "open":
      return "Status gewijzigd naar Open (studenten kunnen nu zelfbeoordeling invullen)";
    case "published":
      return "Status gewijzigd naar Gepubliceerd (studenten kunnen beoordeling bekijken)";
    default:
      return "Status gewijzigd";
  }
}
