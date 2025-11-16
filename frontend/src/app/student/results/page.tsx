"use client";

import { useState, useMemo } from "react";
import { EvaluationResult } from "@/dtos";
import {
  PageHeader,
  Filters,
  EvaluationCard,
  DetailModal,
} from "@/components/student/peer-results";
import { mockData } from "@/components/student/peer-results/mockData";

// --- Main Page
export default function PeerFeedbackResultsPage() {
  const [items, setItems] = useState<EvaluationResult[]>(mockData);
  const [detailOpen, setDetailOpen] = useState(false);
  const [active, setActive] = useState<EvaluationResult | undefined>();
  const [filters, setFilters] = useState<{
    q: string;
    course: string;
    status: string;
  }>({ q: "", course: "", status: "" });

  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      const qOk =
        !filters.q ||
        i.title.toLowerCase().includes(filters.q.toLowerCase()) ||
        i.course.toLowerCase().includes(filters.q.toLowerCase());
      const cOk = !filters.course || i.course === filters.course;
      const sOk = !filters.status || i.status === filters.status;
      return qOk && cOk && sOk;
    });
  }, [items, filters]);

  // TODO – vervang door echte fetch
  const handleRefresh = () => {
    setItems((s) => [...s]);
  };

  const handleExportAll = () => {
    alert("Export alle resultaten naar PDF – TODO: hooken aan jouw export endpoint");
  };

  const openDetails = (ev: EvaluationResult) => {
    setActive(ev);
    setDetailOpen(true);
  };

  return (
    <>
      <PageHeader onRefresh={handleRefresh} onExportAll={handleExportAll} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Filters (Styling Guide order: Search → Course → Status) */}
        <Filters items={items} onFilter={(next) => setFilters(next)} />

        {/* Subtle info banner */}
        <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
          <p className="text-sm text-gray-700">
            Je hebt evaluaties toegewezen gekregen. Zodra resultaten binnen zijn, verschijnen ze hieronder.{" "}
            <span className="ml-1 text-blue-700 underline decoration-dotted underline-offset-2 hover:text-blue-800 cursor-pointer">
              Bekijk alle ruwe feedback
            </span>
          </p>
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {filteredItems.map((ev) => (
            <EvaluationCard key={ev.id} data={ev} onOpen={openDetails} />
          ))}
          {filteredItems.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 text-sm text-gray-600">
              Geen resultaten voor deze filters.
            </div>
          )}
        </div>
      </div>

      <DetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        evaluation={active}
      />
    </>
  );
}
