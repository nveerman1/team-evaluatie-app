"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import AllItemsTab from "./components/AllItemsTab";
import LearningObjectivesOverviewTab from "./components/LearningObjectivesOverviewTab";
import PeerevaluatiesTab from "./components/PeerevaluatiesTab";
import CompetenciesOverviewTab from "./components/CompetenciesOverviewTab";
import ProjectOverviewTab from "./components/ProjectOverviewTab";
import StudentOverviewTab from "./components/StudentOverviewTab";

function OverviewPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  // Initialize state from URL or defaults
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "totaal");

  // Sync URL with active tab
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (activeTab !== "totaal") {
      params.set("tab", activeTab);
    } else {
      params.delete("tab");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeTab, pathname, router, searchParams]);

  const tabs = [
    { id: "totaal", label: "Totaal" },
    { id: "projecten", label: "Projecten" },
    { id: "peerevaluaties", label: "Peerevaluaties" },
    { id: "competenties", label: "Competenties" },
    { id: "leerdoelen", label: "Leerdoelen" },
    { id: "leerlingoverzicht", label: "Leerlingoverzicht" },
  ];

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">Overzicht</h1>
          <p className="text-gray-600 mt-1 text-sm">
            Gecombineerd overzicht van alle beoordelingen en evaluaties
          </p>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Tabs Navigation */}
        <div className="border-b border-gray-200">
        <nav className="flex gap-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${
                  activeTab === tab.id
                    ? "border-black text-black"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
              aria-current={activeTab === tab.id ? "page" : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
        {activeTab === "totaal" && <AllItemsTab />}
        
        {activeTab === "projecten" && <ProjectOverviewTab />}
        
        {activeTab === "peerevaluaties" && <PeerevaluatiesTab />}
        
        {activeTab === "competenties" && <CompetenciesOverviewTab />}
        
        {activeTab === "leerdoelen" && <LearningObjectivesOverviewTab />}
        
        {activeTab === "leerlingoverzicht" && <StudentOverviewTab />}
        </div>
      </div>
    </>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Laden...</div>}>
      <OverviewPageContent />
    </Suspense>
  );
}
