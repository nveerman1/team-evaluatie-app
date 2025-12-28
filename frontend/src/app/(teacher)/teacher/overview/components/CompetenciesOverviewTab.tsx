"use client";

import { useState } from "react";
import { useCompetencyFilterOptions } from "@/hooks/useCompetencyOverview";
import type { CompetencyOverviewFilters } from "@/dtos/competency-monitor.dto";
import { OverviewSubTab } from "./competency/OverviewSubTab";
import { LearningGoalsSubTab } from "./competency/LearningGoalsSubTab";
import { ReflectionsSubTab } from "./competency/ReflectionsSubTab";

const competencySubTabs = [
  { id: "overzicht", label: "Overzicht" },
  { id: "leerdoelen", label: "Leerdoelen" },
  { id: "reflecties", label: "Reflecties" },
];

export default function CompetenciesOverviewTab() {
  const [activeSubTab, setActiveSubTab] = useState("overzicht");
  const [filters, setFilters] = useState<CompetencyOverviewFilters>({
    scanRange: "last_3",
  });
  
  const { data: filterOptions } = useCompetencyFilterOptions();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Competentiemonitor – Overzicht</h2>
        <p className="text-sm text-slate-600 mt-1">Inzicht in ontwikkeling, trends en feedback uit meerdere scans.</p>
      </div>

      {/* Global Filter Bar */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Academisch Jaar</label>
            <select
              value={filters.academicYearId || ""}
              onChange={(e) => setFilters({ ...filters, academicYearId: e.target.value ? Number(e.target.value) : undefined })}
              className="px-3 py-2 text-sm border rounded-lg min-w-[150px]"
            >
              <option value="">Alle jaren</option>
              {filterOptions?.academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>{ay.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Vak</label>
            <select
              value={filters.courseId || ""}
              onChange={(e) => setFilters({ ...filters, courseId: e.target.value ? Number(e.target.value) : undefined })}
              className="px-3 py-2 text-sm border rounded-lg min-w-[150px]"
            >
              <option value="">Alle vakken</option>
              {filterOptions?.courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Periode</label>
            <select
              value={filters.scanRange || "last_3"}
              onChange={(e) => setFilters({ ...filters, scanRange: e.target.value as CompetencyOverviewFilters["scanRange"] })}
              className="px-3 py-2 text-sm border rounded-lg min-w-[150px]"
            >
              <option value="last_3">Laatste 3 scans</option>
              <option value="last_5">Laatste 5 scans</option>
              <option value="last_year">Dit schooljaar</option>
              <option value="all">Alles</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sub-tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4 flex-wrap" aria-label="Competentie sub-tabs">
          {competencySubTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`
                py-3 px-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap
                ${
                  activeSubTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
              aria-current={activeSubTab === tab.id ? "page" : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Sub-tab Content */}
      <div>
        {activeSubTab === "overzicht" && <OverviewSubTab filters={filters} />}
        {activeSubTab === "leerdoelen" && <LearningGoalsSubTab filters={filters} />}
        {activeSubTab === "reflecties" && <ReflectionsSubTab filters={filters} />}
      </div>
    </div>
  );
}
