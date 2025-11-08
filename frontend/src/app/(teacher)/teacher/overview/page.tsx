"use client";

import { useState } from "react";
import AllItemsTab from "./components/AllItemsTab";

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
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold mb-2">Overzicht</h1>
        <p className="text-gray-600">
          Gecombineerd overzicht van alle beoordelingen en evaluaties
        </p>
      </header>

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
      <div className="bg-white border rounded-2xl p-6">
        {activeTab === "totaal" && <AllItemsTab />}
        
        {activeTab === "projecten" && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium mb-2">In ontwikkeling</p>
            <p className="text-sm">Deze tab wordt binnenkort toegevoegd</p>
          </div>
        )}
        
        {activeTab === "peerevaluaties" && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium mb-2">In ontwikkeling</p>
            <p className="text-sm">Deze tab wordt binnenkort toegevoegd</p>
          </div>
        )}
        
        {activeTab === "competenties" && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium mb-2">In ontwikkeling</p>
            <p className="text-sm">Deze tab wordt binnenkort toegevoegd</p>
          </div>
        )}
        
        {activeTab === "leerdoelen" && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium mb-2">In ontwikkeling</p>
            <p className="text-sm">Deze tab wordt binnenkort toegevoegd</p>
          </div>
        )}
      </div>
    </div>
  );
}
