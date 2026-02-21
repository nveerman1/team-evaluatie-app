"use client";

import { useParams, usePathname } from "next/navigation";
import { useState, useEffect, ReactNode, useCallback, createContext, useContext } from "react";
import Link from "next/link";
import { ApiAuthError } from "@/lib/api";
import { evaluationService } from "@/services";
import { Evaluation, EvalStatus } from "@/dtos/evaluation.dto";
import { Loading, ErrorMessage, StatusToggle } from "@/components";
import { EvaluationLayoutProvider, useEvaluationLayout } from "./EvaluationLayoutContext";

type LayoutProps = {
  children: ReactNode;
};

// Context for focus mode state
type FocusModeContextType = {
  focusMode: boolean;
  setFocusMode: (value: boolean) => void;
};

const FocusModeContext = createContext<FocusModeContextType>({
  focusMode: false,
  setFocusMode: () => {},
});

export const useEvaluationFocusMode = () => useContext(FocusModeContext);

function EvaluationLayoutInner({ children }: LayoutProps) {
  const params = useParams();
  const evalId = params?.evalId as string;
  const pathname = usePathname();
  const { autoSaveLabel, exportCsvUrl, publishGrades } = useEvaluationLayout();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Evaluation | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);

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
      // If changing to closed status and on grades page with publishGrades function
      if (newStatus === "closed" && publishGrades) {
        await publishGrades();
        showToast("Cijfers gepubliceerd!");
      }
      
      await evaluationService.updateStatus(Number(evalId), newStatus as EvalStatus);
      
      // Reload data to get updated status
      await loadData();
      
      const statusLabels: Record<string, string> = {
        draft: "concept",
        open: "open",
        closed: "gepubliceerd"
      };
      if (newStatus !== "closed" || !publishGrades) {
        showToast(`Status gewijzigd naar "${statusLabels[newStatus]}"`);
      }
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
    { id: "assessment", label: "Beoordeling", href: `/teacher/evaluations/${evalId}/assessment` },
    { id: "omza", label: "OMZA", href: `/teacher/evaluations/${evalId}/omza` },
    { id: "grades", label: "Cijfers", href: `/teacher/evaluations/${evalId}/grades` },
    { id: "feedback", label: "Feedback", href: `/teacher/evaluations/${evalId}/feedback` },
    { id: "reflections", label: "Reflecties", href: `/teacher/evaluations/${evalId}/reflections` },
    { id: "settings", label: "Instellingen", href: `/teacher/evaluations/${evalId}/settings` },
  ];

  return (
    <FocusModeContext.Provider value={{ focusMode, setFocusMode }}>
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
              prefetch={process.env.NODE_ENV === "production" ? false : undefined}
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
              {/* Auto-save label above toggle */}
              {autoSaveLabel && (
                <p className="text-xs text-gray-500 mt-2">
                  {autoSaveLabel}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Export CSV button if provided */}
              {exportCsvUrl && (
                <a
                  href={exportCsvUrl}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  Export CSV
                </a>
              )}
              <StatusToggle
                options={[
                  { value: "draft", label: "Concept" },
                  { value: "open", label: "Open" },
                  { value: "closed", label: "Gepubliceerd" },
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
      <div className={`transition-all duration-300 py-6 space-y-6 ${focusMode ? 'w-full max-w-none px-4 sm:px-6' : 'max-w-6xl mx-auto px-4 sm:px-6'}`}>
        {/* Tabs Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-6 text-sm" aria-label="Tabs">
            {tabs.map((tab) => {
              // Use pathname to detect active tab
              const isActive = pathname?.includes(tab.id) ?? false;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  prefetch={process.env.NODE_ENV === "production" ? false : undefined}
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
    </FocusModeContext.Provider>
  );
}

export default function EvaluationLayout({ children }: LayoutProps) {
  return (
    <EvaluationLayoutProvider>
      <EvaluationLayoutInner>{children}</EvaluationLayoutInner>
    </EvaluationLayoutProvider>
  );
}
