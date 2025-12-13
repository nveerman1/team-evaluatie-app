import React from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Clock } from "lucide-react";

export function StatPill({ 
  icon, 
  label, 
  value 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string 
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border bg-white/70 px-3 py-1 text-sm shadow-sm">
      <span className="text-slate-600">{icon}</span>
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

export function ScoreRow({ 
  label, 
  value 
}: { 
  label: string; 
  value: number 
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold text-slate-900">{value.toFixed(1)}</span>
      </div>
      <Progress className="[&>div]:bg-indigo-500" value={(value / 5) * 100} />
    </div>
  );
}

export function StatusBadge({ 
  status 
}: { 
  status: "actief" | "afgerond" 
}) {
  if (status === "afgerond") {
    return (
      <Badge className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
        Afgerond
      </Badge>
    );
  }
  return (
    <Badge className="rounded-full bg-amber-50 text-amber-800 border border-amber-100">
      Actief
    </Badge>
  );
}

export type OmzaTeacherStatus = "goed" | "v" | "letop" | "urgent";

export function OmzaTeacherBadge({ 
  letter, 
  status 
}: { 
  letter: string; 
  status: OmzaTeacherStatus 
}) {
  const cfg =
    status === "goed"
      ? { bg: "bg-emerald-50", fg: "text-emerald-700", ring: "ring-emerald-200", content: "🙂" }
      : status === "v"
        ? { bg: "bg-emerald-50", fg: "text-emerald-700", ring: "ring-emerald-200", content: "V" }
        : status === "letop"
          ? { bg: "bg-amber-50", fg: "text-amber-800", ring: "ring-amber-200", content: "!" }
          : { bg: "bg-rose-50", fg: "text-rose-700", ring: "ring-rose-200", content: "!!" };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-slate-500">{letter}</span>
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${cfg.bg} ${cfg.fg} ring-1 ${cfg.ring} text-xs font-bold`}
        title={
          status === "goed"
            ? "Gaat goed"
            : status === "v"
              ? "Voldoet aan verwachting"
              : status === "letop"
                ? "Let op / bespreken"
                : "Urgent"
        }
      >
        {cfg.content}
      </span>
    </div>
  );
}

export function ActionChip({ 
  done, 
  label 
}: { 
  done: boolean; 
  label: string 
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      ) : (
        <Clock className="h-4 w-4 text-slate-400" />
      )}
      <span className={done ? "text-emerald-700" : "text-slate-600"}>
        {label}
      </span>
    </div>
  );
}

export function SectionHeader({ 
  icon, 
  title, 
  subtitle, 
  right 
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {icon && <span className="text-slate-600">{icon}</span>}
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        </div>
        {subtitle && (
          <p className="text-sm text-slate-600">{subtitle}</p>
        )}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}
