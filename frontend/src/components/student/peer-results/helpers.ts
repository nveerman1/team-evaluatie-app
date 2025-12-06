import { OmzaKey } from "@/dtos";

export const OMZA_LABELS: Record<OmzaKey, string> = {
  organiseren: "Organiseren",
  meedoen: "Meedoen",
  zelfvertrouwen: "Zelfvertrouwen",
  autonomie: "Autonomie",
};

export const OMZA_KEYS: OmzaKey[] = ["organiseren", "meedoen", "zelfvertrouwen", "autonomie"];


export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function getOmzaEmoji(level: number): string {
  if (level <= 1.5) return "😀"; // alles oké
  if (level <= 2.5) return "V"; // in de gaten houden
  if (level <= 3.5) return "!"; // aandachtspunt
  return "!!"; // dringend
}

// Get color classes for OMZA emoji based on level (matching teacher OMZA page)
export function getOmzaEmojiColorClasses(level: number): string {
  const emoji = getOmzaEmoji(level);
  if (emoji === "!!") {
    return "border-rose-500 bg-rose-100 text-rose-700";
  }
  if (emoji === "!") {
    return "border-amber-400 bg-amber-100 text-amber-700";
  }
  // 😀 and V get green colors
  return "border-green-500 bg-green-100 text-green-700";
}

export function formatDelta(delta: number): string {
  if (delta === 0) return "0,0";
  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${delta.toFixed(1).replace(".", ",")}`;
}

// Get teamContributionFactor - gcfScore now comes directly as 0.90-1.10
export function getTeamContributionFactor(
  teamContributionFactor?: number,
  gcfScore?: number
): number | undefined {
  if (teamContributionFactor !== undefined) return teamContributionFactor;
  if (gcfScore !== undefined) return gcfScore; // gcfScore is already in 0.90-1.10 range
  return undefined;
}

// Determine label for teamContributionFactor
export function getTeamContributionLabel(factor: number): string {
  if (factor >= 1.05) return "Boven verwachting";
  if (factor >= 0.95) return "Naar verwachting";
  return "Onder verwachting";
}
