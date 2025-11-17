/**
 * Utility functions for OMZA (Organiseren, Meedoen, Zelfvertrouwen, Autonomie)
 */

/**
 * Maps peer score (1-5 scale) to icon level (1-4 scale)
 * 
 * Mapping:
 * - 5 → 1 (🙂)
 * - 4 → 1 (🙂)
 * - 3 → 2 (V)
 * - 2 → 3 (!)
 * - 1 → 4 (!!)
 * 
 * @param peerScore Score on 1-5 scale from peer review
 * @returns Icon level on 1-4 scale
 */
export function mapPeerScoreToIconLevel(peerScore: number): number {
  if (peerScore >= 4) return 1; // 🙂
  if (peerScore >= 3) return 2; // V
  if (peerScore >= 2) return 3; // !
  return 4; // !!
}

/**
 * Icon labels for the 4-level system
 */
export const ICON_LABELS = ["🙂", "V", "!", "!!"];

/**
 * Descriptions for each icon level (for aria-labels)
 */
export const ICON_DESCRIPTIONS = [
  "Gaat goed",
  "Voldoet aan verwachting",
  "Let op: verbeterpunt",
  "Urgent: direct bespreken",
];
