"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, ReactNode, useCallback } from "react";
import Link from "next/link";
import { competencyService } from "@/services";
import type { CompetencyWindow } from "@/dtos";
import { Loading, ErrorMessage, StatusToggle } from "@/components";
import { CompetencyMonitorTabs } from "@/components/teacher/competencies/CompetencyMonitorTabs";

type LayoutProps = {
  children: ReactNode;
};

export default function CompetencyWindowLayout({ children }: LayoutProps) {
  const params = useParams();
  const router = useRouter();
  const windowId = params?.windowId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowData, setWindowData] = useState<CompetencyWindow | null>(null);
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | undefined>(undefined);

  const loadData = useCallback(async () => {
    if (!windowId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await competencyService.getWindow(Number(windowId));
      setWindowData(result);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(err?.response?.data?.detail || err?.message || "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }, [windowId]);

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
    if (!windowData || updating) return;
    
    // Don't do anything if status is the same
    if (windowData.status === newStatus) return;
    
    setUpdating(true);
    try {
      await competencyService.updateWindow(Number(windowId), {
        status: newStatus,
      });
      
      // Reload data to get updated status
      await loadData();
      
      const statusLabels: Record<string, string> = {
        draft: "Concept",
        open: "Open",
        closed: "Gesloten",
      };
      showToast(`Status gewijzigd naar ${statusLabels[newStatus] || newStatus}`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      showToast(err?.response?.data?.detail || err?.message || "Status wijzigen mislukt");
    } finally {
      setUpdating(false);
    }
  }

  // Handle delete
  async function handleDelete() {
    if (!windowData) return;

    const confirmed = confirm(
      `Weet je zeker dat je "${windowData.title}" wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`
    );

    if (!confirmed) return;

    try {
      await competencyService.deleteWindow(Number(windowId));
      showToast("Venster succesvol verwijderd");
      router.push("/teacher/competencies");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      showToast(err?.response?.data?.detail || err?.message || "Verwijderen mislukt");
    }
  }

  if (loading) return <Loading />;
  if (error && !windowData) return <ErrorMessage message={error} />;
  if (!windowData) return <ErrorMessage message="Geen data gevonden" />;

  // Get unique classes from window
  const availableClasses = windowData.class_names || [];

  // Format date for subtitle
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const subtitle = windowData.start_date
    ? `${formatDate(windowData.start_date)}${windowData.end_date ? ` – ${formatDate(windowData.end_date)}` : ""}`
    : "";

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
              href="/teacher/competencies"
              prefetch={process.env.NODE_ENV === "production" ? false : undefined}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ← Terug naar overzicht
            </Link>
          </div>
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
                {windowData.title}
              </h1>
              {subtitle && (
                <p className="text-gray-600 mt-1 text-sm">{subtitle}</p>
              )}
              {windowData.description && (
                <p className="text-gray-500 mt-2 text-sm">{windowData.description}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Class Filter */}
              {availableClasses.length > 0 && (
                <select
                  value={selectedClass || "all"}
                  onChange={(e) =>
                    setSelectedClass(
                      e.target.value === "all" ? undefined : e.target.value
                    )
                  }
                  className="px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Alle klassen</option>
                  {availableClasses.map((className) => (
                    <option key={className} value={className}>
                      {className}
                    </option>
                  ))}
                </select>
              )}
              
              {/* Status Toggle */}
              <StatusToggle
                options={[
                  { value: "draft", label: "Concept" },
                  { value: "open", label: "Open" },
                  { value: "closed", label: "Gesloten" },
                ]}
                value={windowData.status}
                onChange={handleStatusChange}
                disabled={updating}
              />
              
              {/* Delete Button */}
              <button
                onClick={handleDelete}
                className="px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
              >
                Verwijderen
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Tabs Navigation */}
        <CompetencyMonitorTabs windowId={windowId} />

        {/* Page-specific content - pass context via React context or props */}
        {children}
      </div>
    </>
  );
}
