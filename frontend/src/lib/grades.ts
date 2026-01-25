/**
 * Utility functions for grade conversions and formatting
 */

/**
 * Convert a numeric grade (1-10 scale) to Dutch grade label
 * @param grade - Numeric grade on 1-10 scale
 * @returns Dutch label for the grade
 */
export function getGradeLabel(grade: number | null | undefined): string | null {
  if (grade == null) return null;
  
  // Dutch grading labels based on standard scale
  if (grade >= 9.0) return "uitstekend";
  if (grade >= 8.5) return "zeer goed";
  if (grade >= 8.0) return "goed";
  if (grade >= 7.5) return "ruim voldoende";
  if (grade >= 6.5) return "voldoende";
  if (grade >= 5.5) return "bijna voldoende";
  if (grade >= 4.5) return "onvoldoende";
  return "ruim onvoldoende";
}

/**
 * Get color classes for grade display based on value
 * @param grade - Numeric grade on 1-10 scale
 * @returns Tailwind CSS classes for coloring
 */
export function getGradeColorClasses(grade: number | null | undefined): string {
  if (grade == null) return "bg-slate-100 text-slate-700";
  
  if (grade >= 8.5) return "bg-green-100 text-green-700";
  if (grade >= 7.5) return "bg-emerald-100 text-emerald-700";
  if (grade >= 6.5) return "bg-blue-100 text-blue-700";
  if (grade >= 5.5) return "bg-yellow-100 text-yellow-700";
  if (grade >= 4.5) return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700";
}

/**
 * Format grade for display with proper decimal places
 * @param grade - Numeric grade
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted grade string
 */
export function formatGrade(grade: number | null | undefined, decimals: number = 1): string {
  if (grade == null) return "–";
  return grade.toFixed(decimals);
}
