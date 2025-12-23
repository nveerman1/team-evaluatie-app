"use client";

import { useState } from "react";
import OverzichtTab from "./components/OverzichtTab";
import EventsTab from "./components/EventsTab";
import ExternTab from "./components/ExternTab";
import RFIDTab from "./components/RFIDTab";
import AanwezigheidTab from "./components/AanwezigheidTab";
import StatistiekenTab from "./components/StatistiekenTab";

export default function AttendanceDashboardPage() {
  const [activeTab, setActiveTab] = useState("overzicht");

  const tabs = [
    { id: "overzicht", label: "Overzicht" },
    { id: "aanwezigheid", label: "Aanwezigheid" },
    { id: "gebeurtenissen", label: "In-/Uitcheck log" },
    { id: "extern", label: "Extern werk" },
    { id: "statistieken", label: "Statistieken" },
    { id: "rfid", label: "RFID Kaarten" },
  ];

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">3de Blok - Aanwezigheid</h1>
          <p className="text-gray-600 mt-1 text-sm">
            Real-time overzicht en beheer van aanwezigheid
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
        {activeTab === "overzicht" && <OverzichtTab />}
        
        {activeTab === "aanwezigheid" && <AanwezigheidTab />}
        
        {activeTab === "gebeurtenissen" && <EventsTab />}
        
        {activeTab === "extern" && <ExternTab />}
        
        {activeTab === "statistieken" && <StatistiekenTab />}
        
        {activeTab === "rfid" && <RFIDTab />}
      </div>
    </>
  );
}
