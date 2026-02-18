"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, ExternalLink, Circle, Flag, Clock, CheckCircle2, BadgeCheck, X, Sparkles } from "lucide-react";
import { skillTrainingService } from "@/services";
import type { StudentTrainingItem, SkillTrainingStatus } from "@/dtos";
import { STUDENT_ALLOWED_STATUSES } from "@/dtos";

// Status metadata with icons and styling
const STATUS_META = {
  none: { label: "Niet gestart", icon: Circle, pill: "bg-slate-100 text-slate-700" },
  planned: { label: "Gepland", icon: Flag, pill: "bg-blue-50 text-blue-700" },
  in_progress: { label: "Bezig", icon: Clock, pill: "bg-amber-50 text-amber-700" },
  submitted: { label: "Ingeleverd", icon: CheckCircle2, pill: "bg-teal-50 text-teal-700" },
  completed: { label: "Afgerond", icon: CheckCircle2, pill: "bg-emerald-50 text-emerald-700" },
  mastered: { label: "Beheerst", icon: BadgeCheck, pill: "bg-violet-50 text-violet-700" },
} as const;

function cn(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

function StatusPill({ status }: { status: SkillTrainingStatus }) {
  const meta = STATUS_META[status] || STATUS_META.none;
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", meta.pill)}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

function Modal({ open, onClose, title, children }: any) {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/50 transition-opacity" onClick={onClose} />
      <div className="relative z-10 w-[min(820px,92vw)] rounded-2xl bg-white shadow-xl transition-all">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="text-base font-semibold text-slate-900">{title}</div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function SkillTrainingTab() {
  const [trainings, setTrainings] = useState<StudentTrainingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyOpen, setShowOnlyOpen] = useState(false);
  const [selectedCompetency, setSelectedCompetency] = useState<number | null>(null);
  const [detailsTraining, setDetailsTraining] = useState<StudentTrainingItem | null>(null);

  useEffect(() => {
    loadTrainings();
  }, []);

  async function loadTrainings() {
    try {
      setLoading(true);
      const response = await skillTrainingService.getMyTrainings();
      setTrainings(response.items);
    } catch (error) {
      console.error("Failed to load trainings:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredTrainings = useMemo(() => {
    return trainings.filter((training) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !training.training.title.toLowerCase().includes(query) &&
          !training.training.competency_category_name.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Open filter
      if (showOnlyOpen) {
        if (training.status === "completed" || training.status === "mastered") {
          return false;
        }
      }

      // Competency filter
      if (selectedCompetency !== null) {
        if (training.training.competency_category_id !== selectedCompetency) {
          return false;
        }
      }

      return true;
    });
  }, [trainings, searchQuery, showOnlyOpen, selectedCompetency]);

  const competencyProgress = useMemo(() => {
    const categories = new Map<number, { name: string; total: number; done: number }>();

    trainings.forEach((training) => {
      const catId = training.training.competency_category_id;
      const catName = training.training.competency_category_name;

      if (!categories.has(catId)) {
        categories.set(catId, { name: catName, total: 0, done: 0 });
      }

      const cat = categories.get(catId)!;
      cat.total++;
      if (training.status === "completed" || training.status === "mastered") {
        cat.done++;
      }
    });

    return Array.from(categories.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      total: data.total,
      done: data.done,
      percentage: data.total > 0 ? Math.round((data.done / data.total) * 100) : 0,
    }));
  }, [trainings]);

  const openCount = useMemo(() => {
    return trainings.filter((t) => t.status !== "completed" && t.status !== "mastered").length;
  }, [trainings]);

  async function updateStatus(trainingId: number, status: SkillTrainingStatus) {
    try {
      await skillTrainingService.updateMyStatus(trainingId, { status });
      await loadTrainings();
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  }

  function cycleStatus(training: StudentTrainingItem) {
    const allowedStatuses = STUDENT_ALLOWED_STATUSES;

    // If teacher has set completed/mastered, don't allow changes
    if (training.status === "completed" || training.status === "mastered") {
      return;
    }

    const currentIndex = allowedStatuses.indexOf(training.status);
    const nextIndex = (currentIndex + 1) % allowedStatuses.length;
    const nextStatus = allowedStatuses[nextIndex];

    updateStatus(training.training.id, nextStatus);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-slate-500">Trainingen laden...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and filters */}
      <div className="rounded-2xl border-slate-200 bg-slate-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-slate-600" />
              <p className="text-sm font-semibold text-slate-900">Trainingen</p>
            </div>
            <p className="text-sm text-slate-600">Werk aan je vaardigheden en volg je voortgang.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoek training…"
                className="w-[220px] max-w-full rounded-2xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
              />
            </div>

            <label className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
              <input
                type="checkbox"
                checked={showOnlyOpen}
                onChange={(e) => setShowOnlyOpen(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Alleen open
            </label>

            <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              Open items: {openCount}
            </div>
          </div>
        </div>
      </div>

      {/* Progress per competency */}
      <div className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">Voortgang per competentie</div>
          <div className="text-xs text-slate-500">Afgerond/beheerst ÷ totaal</div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {competencyProgress.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCompetency(selectedCompetency === cat.id ? null : cat.id)}
              className={cn(
                "rounded-2xl border border-slate-200 p-4 text-left shadow-sm transition hover:bg-slate-50",
                selectedCompetency === cat.id && "border-slate-300 ring-4 ring-slate-100"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">{cat.name}</div>
                <div className="text-xs font-semibold text-slate-700">
                  {cat.done}/{cat.total}
                </div>
              </div>
              <div className="mt-3">
                <div className="h-2 w-full rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-slate-900" style={{ width: `${cat.percentage}%` }} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Trainings table */}
      <div className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Training</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Competentie</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Leerdoel</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Niveau</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tijd</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Acties</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrainings.map((item) => {
                const canChangeStatus = STUDENT_ALLOWED_STATUSES.includes(item.status);
                return (
                  <tr key={item.training.id} className="border-t hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <span className="text-sm font-semibold text-slate-900 truncate">{item.training.title}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">{item.training.competency_category_name}</td>
                    <td className="px-5 py-3 text-sm text-slate-700">{item.training.learning_objective_title || "–"}</td>
                    <td className="px-5 py-3 text-sm text-slate-700">{item.training.level || "–"}</td>
                    <td className="px-5 py-3 text-sm text-slate-700">{item.training.est_minutes || "–"}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => canChangeStatus && cycleStatus(item)}
                        disabled={!canChangeStatus}
                        className={cn(
                          "transition-opacity",
                          canChangeStatus ? "cursor-pointer hover:opacity-80" : "cursor-not-allowed opacity-60"
                        )}
                        title={canChangeStatus ? "Klik om status te wijzigen" : "Status is door docent gezet"}
                      >
                        <StatusPill status={item.status} />
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => setDetailsTraining(item)}
                          className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Details
                        </button>
                        <a
                          href={item.training.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details modal */}
      <Modal open={!!detailsTraining} onClose={() => setDetailsTraining(null)} title="Training details">
        {detailsTraining && (
          <div className="space-y-4">
            <div>
              <div className="text-lg font-semibold text-slate-900">{detailsTraining.training.title}</div>
              <div className="text-sm text-slate-600">{detailsTraining.training.competency_category_name}</div>
            </div>

            {/* Training details grid */}
            <div className="grid grid-cols-2 gap-3">
              {detailsTraining.training.level && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Niveau</div>
                  <div className="mt-1 text-sm text-slate-800">{detailsTraining.training.level}</div>
                </div>
              )}
              {detailsTraining.training.est_minutes && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tijd</div>
                  <div className="mt-1 text-sm text-slate-800">{detailsTraining.training.est_minutes}</div>
                </div>
              )}
            </div>

            {detailsTraining.training.learning_objective_title && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Leerdoel</div>
                <div className="mt-1 text-sm text-slate-800">{detailsTraining.training.learning_objective_title}</div>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Status</div>
              <button
                onClick={() => cycleStatus(detailsTraining)}
                disabled={detailsTraining.status === "completed" || detailsTraining.status === "mastered"}
                className={cn(
                  "transition-opacity",
                  detailsTraining.status === "completed" || detailsTraining.status === "mastered"
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer hover:opacity-80"
                )}
                title={
                  detailsTraining.status === "completed" || detailsTraining.status === "mastered"
                    ? "Status is door docent gezet"
                    : "Klik om status te wijzigen"
                }
              >
                <StatusPill status={detailsTraining.status} />
              </button>
              <div className="mt-2 text-xs text-slate-500">
                {detailsTraining.status === "completed" || detailsTraining.status === "mastered" 
                  ? "Status is door docent gezet en kan niet worden gewijzigd."
                  : "Klik op de status pill om te wijzigen: Niet gestart → Gepland → Bezig → Ingeleverd."}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <a
                href={detailsTraining.training.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                <ExternalLink className="h-4 w-4" />
                Open training
              </a>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
