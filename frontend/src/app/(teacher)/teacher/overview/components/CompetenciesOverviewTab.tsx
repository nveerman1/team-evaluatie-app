"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCompetencyFilterOptions } from "@/hooks/useCompetencyOverview";
import type { CompetencyOverviewFilters } from "@/dtos/competency-monitor.dto";
import { OverviewSubTab } from "./competency/OverviewSubTab";
import { LearningGoalsSubTab } from "./competency/LearningGoalsSubTab";
import { ReflectionsSubTab } from "./competency/ReflectionsSubTab";
import OverviewFilters, { OverviewFilterValues } from "./OverviewFilters";
import EmptyState from "./EmptyState";

const competencySubTabs = [
  { id: "overzicht", label: "Overzicht" },
  { id: "leerdoelen", label: "Leerdoelen" },
  { id: "reflecties", label: "Reflecties" },
];

export default function CompetenciesOverviewTab() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  const [activeSubTab, setActiveSubTab] = useState("overzicht");
  
  // Initialize filter values from URL
  const [filterValues, setFilterValues] = useState<OverviewFilterValues>({
    academicYear: searchParams.get("year") || undefined,
    courseId: searchParams.get("subjectId") || undefined,
    period: searchParams.get("period") || undefined,
    searchQuery: searchParams.get("q") || undefined,
  });
  
  const [filters, setFilters] = useState<CompetencyOverviewFilters>({
    scanRange: filterValues.period as CompetencyOverviewFilters["scanRange"] || "last_3",
    academicYearId: filterValues.academicYear ? Number(filterValues.academicYear) : undefined,
    courseId: filterValues.courseId ? Number(filterValues.courseId) : undefined,
  });
  
  const { data: filterOptions } = useCompetencyFilterOptions();
  
  // Sync URL with filter values
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (filterValues.academicYear) {
      params.set("year", filterValues.academicYear);
    } else {
      params.delete("year");
    }
    
    if (filterValues.courseId) {
      params.set("subjectId", filterValues.courseId);
    } else {
      params.delete("subjectId");
    }
    
    if (filterValues.period) {
      params.set("period", filterValues.period);
    } else {
      params.delete("period");
    }
    
    if (filterValues.searchQuery) {
      params.set("q", filterValues.searchQuery);
    } else {
      params.delete("q");
    }
    
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [filterValues, pathname, router, searchParams]);
  
  // Update internal filters when filterValues change
  useEffect(() => {
    const academicYearId = filterValues.academicYear ? Number(filterValues.academicYear) : undefined;
    setFilters({
      scanRange: filterValues.period as CompetencyOverviewFilters["scanRange"] || "last_3",
      academicYearId,
      courseId: filterValues.courseId ? Number(filterValues.courseId) : undefined,
    });
  }, [filterValues]);
  
  const handleFilterChange = (newFilters: OverviewFilterValues) => {
    setFilterValues(newFilters);
  };
  
  // Period options
  const periodOptions = [
    { value: "last_3", label: "Laatste 3 scans" },
    { value: "last_5", label: "Laatste 5 scans" },
    { value: "last_year", label: "Dit schooljaar" },
    { value: "all", label: "Alles" },
  ];

  
  // Show empty state if no course selected
  if (!filterValues.courseId) {
    return (
      <div className="space-y-6">
        <OverviewFilters
          filters={filterValues}
          onFiltersChange={handleFilterChange}
          academicYears={filterOptions?.academicYears}
          courses={filterOptions?.courses}
          periods={periodOptions}
          loading={!filterOptions}
          showAcademicYear={true}
          showPeriod={true}
          showClass={false}
          showSearch={true}
        />
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Filter Bar */}
      <OverviewFilters
        filters={filterValues}
        onFiltersChange={handleFilterChange}
        academicYears={filterOptions?.academicYears}
        courses={filterOptions?.courses}
        periods={periodOptions}
        loading={!filterOptions}
        showAcademicYear={true}
        showPeriod={true}
        showClass={false}
        showSearch={true}
      />

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
