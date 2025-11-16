import { OmzaKey } from "@/dtos";

export const OMZA_LABELS: Record<OmzaKey, string> = {
  organiseren: "Organiseren",
  meedoen: "Meedoen",
  zelfvertrouwen: "Zelfvertrouwen",
  autonomie: "Autonomie",
};

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
