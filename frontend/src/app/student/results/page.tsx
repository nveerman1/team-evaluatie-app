"use client";

import { useState, useMemo } from "react";
import { EvaluationResult } from "@/dtos";
import {
  PageHeader,
  Filters,
  EvaluationCard,
  DetailModal,
  OMZAOverview,
} from "@/components/student/peer-results";
import { usePeerFeedbackResults } from "@/hooks/usePeerFeedbackResults";
import { studentStyles } from "@/styles/student-dashboard.styles";

// --- Main Page
export default function PeerFeedbackResultsPage() {
  const { items, loading, error, refresh } = usePeerFeedbackResults();
  const [detailOpen, setDetailOpen] = useState(false);
  const [active, setActive] = useState<EvaluationResult | undefined>();
  const [filters, setFilters] = useState<{
    q: string;
    course: string;
  }>({ q: "", course: "" });

  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      const qOk =
        !filters.q ||
        i.title.toLowerCase().includes(filters.q.toLowerCase()) ||
        i.course.toLowerCase().includes(filters.q.toLowerCase());
      const cOk = !filters.course || i.course === filters.course;
      return qOk && cOk;
    });
  }, [items, filters]);

  const handleRefresh = () => {
    refresh();
  };

  const handleExportAll = () => {
    // TODO: Implement PDF export functionality
    // This feature requires backend endpoint implementation:
    // - POST /api/v1/students/me/results/export
    // - Generate PDF with all evaluation results
    // - Include scores, feedback, and reflections
    console.warn("Export functionality not yet implemented");
    alert("Export functionaliteit is nog niet geïmplementeerd. Neem contact op met je docent voor een overzicht.");
  };

  const openDetails = (ev: EvaluationResult) => {
    setActive(ev);
    setDetailOpen(true);
  };

  return (
    <main className={studentStyles.layout.pageContainer}>
      <PageHeader onRefresh={handleRefresh} onExportAll={handleExportAll} />

      <Filters items={items} onFilter={(next) => setFilters(next)} />

      {/* OMZA Overview */}
      {!loading && !error && items.length > 0 && <OMZAOverview items={items} />}

      {/* Cards Section */}
      <section className="mx-auto max-w-6xl space-y-4 px-6 py-6">
        {/* Loading state */}
        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-indigo-600"></div>
              Resultaten laden...
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
            <p className="font-medium">Er is iets misgegaan</p>
            <p>{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-2 text-rose-600 underline hover:text-rose-800"
            >
              Opnieuw proberen
            </button>
          </div>
        )}

        {/* Cards */}
        {!loading && !error && (
          <>
            {filteredItems.map((ev) => (
              <EvaluationCard key={ev.id} data={ev} onOpen={openDetails} />
            ))}
            {filteredItems.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
                Geen resultaten voor deze filters.
              </div>
            )}
          </>
        )}
      </section>

      <DetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        evaluation={active}
      />
    </main>
  );
}
