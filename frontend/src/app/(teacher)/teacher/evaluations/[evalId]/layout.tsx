"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, ReactNode, useCallback } from "react";
import Link from "next/link";
import { ApiAuthError } from "@/lib/api";
import { evaluationService } from "@/services";
import { Evaluation, EvalStatus } from "@/dtos/evaluation.dto";
import { Loading, ErrorMessage, StatusToggle } from "@/components";

type LayoutProps = {
  children: ReactNode;
};

export default function EvaluationLayout({ children }: LayoutProps) {
  const params = useParams();
  const evalId = params?.evalId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Evaluation | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!evalId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await evaluationService.getEvaluation(Number(evalId));
      setData(result);
    } catch (e: unknown) {
      if (e instanceof ApiAuthError) {
        setError(e.originalMessage);
      } else {
        const err = e as { response?: { data?: { detail?: string } }; message?: string };
        setError(err?.response?.data?.detail || err?.message || "Laden mislukt");
      }
    } finally {
      setLoading(false);
    }
  }, [evalId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Show toast notification
  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Handle status change from toggle
  async function handleStatusChange(newStatus: string) {
    if (!data || publishing) return;
    
    // Don't do anything if status is the same
    if (data.status === newStatus) return;
    
    setPublishing(true);
    try {
      await evaluationService.updateStatus(Number(evalId), newStatus as EvalStatus);
      
      // Reload data to get updated status
      await loadData();
      
      const statusLabels: Record<EvalStatus, string> = {
        draft: "concept",
        open: "open",
        closed: "gesloten"
      };
      showToast(`Status gewijzigd naar "${statusLabels[newStatus as EvalStatus]}"`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      showToast(err?.response?.data?.detail || err?.message || "Status wijzigen mislukt");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <Loading />;
  if (error && !data) return <ErrorMessage message={error} />;
  if (!data) return <ErrorMessage message="Geen data gevonden" />;

  // Define tabs for the navigation
  const tabs = [
    { id: "dashboard", label: "Dashboard", href: `/teacher/evaluations/${evalId}/dashboard` },
    { id: "omza", label: "OMZA", href: `/teacher/evaluations/${evalId}/omza` },
    { id: "grades", label: "Cijfers", href: `/teacher/evaluations/${evalId}/grades` },
    { id: "feedback", label: "Feedback", href: `/teacher/evaluations/${evalId}/feedback` },
    { id: "reflections", label: "Reflecties", href: `/teacher/evaluations/${evalId}/reflections` },
    { id: "settings", label: "Instellingen", href: `/teacher/evaluations/${evalId}/settings` },
  ];

  return (
    <>
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className="bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg">
            {toast}
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto">
          <div className="mb-4">
            <Link
              href="/teacher/evaluations"
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ← Terug naar overzicht
            </Link>
          </div>
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
                {data.title}
              </h1>
              <p className="text-gray-600 mt-1 text-sm">
                Evaluatie #{data.id}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusToggle
                options={[
                  { value: "draft", label: "Concept" },
                  { value: "open", label: "Open" },
                  { value: "closed", label: "Gesloten" },
                ]}
                value={data.status}
                onChange={handleStatusChange}
                disabled={publishing}
              />
            </div>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Tabs Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-6 text-sm" aria-label="Tabs">
            {tabs.map((tab) => {
              // Simple way to detect active tab - check if current path includes the tab's path
              const isActive = typeof window !== 'undefined' && window.location.pathname.includes(tab.id);
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`py-3 border-b-2 -mb-px transition-colors ${
                    isActive
                      ? "border-blue-600 text-blue-700 font-medium"
                      : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Page-specific content */}
        {children}
      </div>
    </>
  );
}
