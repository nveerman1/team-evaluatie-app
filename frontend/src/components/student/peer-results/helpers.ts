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

export function formatDelta(delta: number): string {
  if (delta === 0) return "0,0";
  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${delta.toFixed(1).replace(".", ",")}`;
}

// Convert gcfScore (0-100) to teamContributionFactor (0.90-1.10)
export function getTeamContributionFactor(
  teamContributionFactor?: number,
  gcfScore?: number
): number | undefined {
  if (teamContributionFactor !== undefined) return teamContributionFactor;
  if (gcfScore !== undefined) return 0.9 + (gcfScore / 100) * 0.2;
  return undefined;
}

// Determine label for teamContributionFactor
export function getTeamContributionLabel(factor: number): string {
  if (factor >= 1.05) return "Boven verwachting";
  if (factor >= 0.95) return "Naar verwachting";
  return "Onder verwachting";
}
