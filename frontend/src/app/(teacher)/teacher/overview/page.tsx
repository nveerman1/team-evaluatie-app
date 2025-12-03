"use client";

import { useState } from "react";
import AllItemsTab from "./components/AllItemsTab";
import LearningObjectivesOverviewTab from "./components/LearningObjectivesOverviewTab";
import PeerevaluatiesTab from "./components/PeerevaluatiesTab";

export default function OverviewPage() {
  const [activeTab, setActiveTab] = useState("totaal");

  const tabs = [
    { id: "totaal", label: "Totaal" },
    { id: "projecten", label: "Projecten" },
    { id: "peerevaluaties", label: "Peerevaluaties" },
    { id: "competenties", label: "Competenties" },
    { id: "leerdoelen", label: "Leerdoelen" },
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
        
        {activeTab === "projecten" && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium mb-2">In ontwikkeling</p>
            <p className="text-sm">Deze tab wordt binnenkort toegevoegd</p>
          </div>
        )}
        
        {activeTab === "peerevaluaties" && <PeerevaluatiesTab />}
        
        {activeTab === "competenties" && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium mb-2">In ontwikkeling</p>
            <p className="text-sm">Deze tab wordt binnenkort toegevoegd</p>
          </div>
        )}
        
        {activeTab === "leerdoelen" && <LearningObjectivesOverviewTab />}
        </div>
      </div>
    </>
  );
}
