"use client";

import { useState } from "react";
import { OverviewSubTab } from "./competency/OverviewSubTab";
import { CategoriesSubTab } from "./competency/CategoriesSubTab";
import { StudentsSubTab } from "./competency/StudentsSubTab";
import { LearningGoalsSubTab } from "./competency/LearningGoalsSubTab";
import { ReflectionsSubTab } from "./competency/ReflectionsSubTab";

const competencySubTabs = [
  { id: "overzicht", label: "Overzicht" },
  { id: "categorieen", label: "Categorieën" },
  { id: "leerlingen", label: "Leerlingen" },
  { id: "leerdoelen", label: "Leerdoelen" },
  { id: "reflecties", label: "Reflecties" },
];

export default function CompetenciesOverviewTab() {
  const [activeSubTab, setActiveSubTab] = useState("overzicht");

  return (
    <div className="space-y-6">
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
        {activeSubTab === "overzicht" && <OverviewSubTab />}
        {activeSubTab === "categorieen" && <CategoriesSubTab />}
        {activeSubTab === "leerlingen" && <StudentsSubTab />}
        {activeSubTab === "leerdoelen" && <LearningGoalsSubTab />}
        {activeSubTab === "reflecties" && <ReflectionsSubTab />}
      </div>
    </div>
  );
}
