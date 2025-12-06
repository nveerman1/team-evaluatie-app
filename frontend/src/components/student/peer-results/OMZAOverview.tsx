"use client";

import React, { useState, useMemo } from "react";
import { EvaluationResult, OmzaKey } from "@/dtos";
import { OMZALineChart, OmzaTrendPoint } from "./OMZALineChart";
import { OMZARadarChart } from "./OMZARadarChart";
import { mean, round1 } from "./helpers";

type OMZAOverviewProps = {
  items: EvaluationResult[];
};

export function OMZAOverview({ items }: OMZAOverviewProps) {
  const [showAllScans, setShowAllScans] = useState(false);

  // Build trend data from evaluations
  const omzaTrend = useMemo(() => {
    const trend: OmzaTrendPoint[] = [];
    const sortedItems = [...items].sort((a, b) => {
      const dateA = a.deadlineISO ? new Date(a.deadlineISO).getTime() : 0;
      const dateB = b.deadlineISO ? new Date(b.deadlineISO).getTime() : 0;
      return dateA - dateB;
    });

    const itemsToShow = showAllScans ? sortedItems : sortedItems.slice(-3);

    itemsToShow.forEach((item, idx) => {
      const omzaKeys: OmzaKey[] = ["organiseren", "meedoen", "zelfvertrouwen", "autonomie"];
      const averages = {
        O: 0,
        M: 0,
        Z: 0,
        A: 0,
      };

      // Calculate averages from peer scores
      omzaKeys.forEach((key, i) => {
        const scores = item.peers.map((p) => p.scores[key]).filter(Boolean);
        const keyMap = ["O", "M", "Z", "A"];
        averages[keyMap[i] as "O" | "M" | "Z" | "A"] = round1(mean(scores));
      });

      trend.push({
        label: item.title || `Sprint ${idx + 1}`,
        ...averages,
      });
    });

    // If no data, provide dummy data
    if (trend.length === 0) {
      trend.push(
        { label: "Sprint 1", O: 2.4, M: 2.6, Z: 2.8, A: 2.3 },
        { label: "Sprint 2", O: 2.7, M: 2.8, Z: 3.0, A: 2.6 },
        { label: "Sprint 3", O: 3.0, M: 3.1, Z: 3.2, A: 2.9 }
      );
    }

    return trend;
  }, [items, showAllScans]);

  // Get profile from last scan
  const omzaProfileLastScan = useMemo(() => {
    if (items.length === 0) {
      return { O: 3.0, M: 3.8, Z: 3.2, A: 3.4 };
    }

    const lastItem = items[0]; // Assuming items are sorted newest first
    const omzaKeys: OmzaKey[] = ["organiseren", "meedoen", "zelfvertrouwen", "autonomie"];
    const profile = { O: 0, M: 0, Z: 0, A: 0 };

    omzaKeys.forEach((key, i) => {
      const scores = lastItem.peers.map((p) => p.scores[key]).filter(Boolean);
      const keyMap = ["O", "M", "Z", "A"];
      profile[keyMap[i] as "O" | "M" | "Z" | "A"] = round1(mean(scores));
    });

    return profile;
  }, [items]);

  // Calculate strongest domain and growth opportunity
  const { strongestDomain, growthOpportunity } = useMemo(() => {
    const entries = Object.entries(omzaProfileLastScan);
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    const labels = { O: "Organiseren", M: "Meedoen", Z: "Zelfvertrouwen", A: "Autonomie" };

    return {
      strongestDomain: {
        label: labels[sorted[0][0] as "O" | "M" | "Z" | "A"],
        value: sorted[0][1],
      },
      growthOpportunity: {
        label: labels[sorted[sorted.length - 1][0] as "O" | "M" | "Z" | "A"],
        value: sorted[sorted.length - 1][1],
      },
    };
  }, [omzaProfileLastScan]);

  return (
    <section className="mx-auto max-w-6xl px-6 pt-5 space-y-4">
      <div className="grid gap-4 grid-cols-[3fr_2fr]">
        {/* Ontwikkeling over tijd */}
        <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Ontwikkeling van OMZA over tijd
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAllScans(false)}
                className={`rounded-full border px-3 py-1 text-[11px] font-medium ${
                  !showAllScans
                    ? "border-slate-200 bg-slate-50 text-slate-600"
                    : "border-transparent bg-white text-slate-400 hover:border-slate-200"
                }`}
              >
                Laatste 3 scans
              </button>
              <button
                onClick={() => setShowAllScans(true)}
                className={`rounded-full border px-3 py-1 text-[11px] font-medium ${
                  showAllScans
                    ? "border-slate-200 bg-slate-50 text-slate-600"
                    : "border-transparent bg-white text-slate-400 hover:border-slate-200"
                }`}
              >
                Alle scans
              </button>
            </div>
          </div>
          <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2">
            <div className="h-40 md:h-52">
              <OMZALineChart data={omzaTrend} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Organiseren
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Meedoen
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-violet-500" />
              Zelfvertrouwen
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              Autonomie
            </div>
          </div>
        </div>

        {/* Profiel laatste scan */}
        <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            Profiel laatste scan (OMZA)
          </h2>
          <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2">
            <div className="h-40 md:h-52">
              <OMZARadarChart data={omzaProfileLastScan} />
            </div>
          </div>
          <div className="mt-3 space-y-1 text-xs text-slate-600">
            <p>
              <span className="font-semibold">Sterkste domein:</span> {strongestDomain.label} (
              {strongestDomain.value.toFixed(1)})
            </p>
            <p>
              <span className="font-semibold">Grootste groeikans:</span> {growthOpportunity.label} (
              {growthOpportunity.value.toFixed(1)})
            </p>
            <p className="text-[11px] text-slate-500">
              Tip: koppel een leerdoel aan jouw ontwikkelpunt en verwijs ernaar in je volgende
              reflectie.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
