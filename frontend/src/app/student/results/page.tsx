"use client";

import { useState, useMemo } from "react";
import { EvaluationResult } from "@/dtos";
import {
  PageHeader,
  Filters,
  EvaluationCard,
  DetailModal,
} from "@/components/student/peer-results";
import { usePeerFeedbackResults } from "@/hooks/usePeerFeedbackResults";

// --- Main Page
export default function PeerFeedbackResultsPage() {
  const { items, loading, error, refresh } = usePeerFeedbackResults();
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

  const handleRefresh = () => {
    refresh();
  };

  const handleExportAll = () => {
    alert("Export alle resultaten naar PDF – TODO: hooken aan jouw export endpoint");
  };

  const openDetails = (ev: EvaluationResult) => {
    setActive(ev);
    setDetailOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <PageHeader onRefresh={handleRefresh} onExportAll={handleExportAll} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Filters (Styling Guide order: Search → Course → Status) */}
        <Filters items={items} onFilter={(next) => setFilters(next)} />

        {/* Loading state */}
        {loading && (
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              Resultaten laden...
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-50 rounded-xl border border-red-200 shadow-sm p-6 text-sm text-red-700">
            <p className="font-medium">Er is iets misgegaan</p>
            <p>{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-2 text-red-600 underline hover:text-red-800"
            >
              Opnieuw proberen
            </button>
          </div>
        )}

        {/* Cards */}
        {!loading && !error && (
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
        )}
      </div>

      <DetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        evaluation={active}
      />
    </div>
  );
}
