"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { academicYearService } from "@/services/academic-year.service";
import { AcademicYear } from "@/dtos/academic-year.dto";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import YearTransitionWizard from "./YearTransitionWizard";

interface AcademicYearFormData {
  label: string;
  start_date: string;
  end_date: string;
}

interface ArchiveConfirmDialog {
  isOpen: boolean;
  yearId: number | null;
  yearLabel: string;
  confirmed: boolean;
}

const AcademicYearsManagement = forwardRef((props, ref) => {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showTransitionWizard, setShowTransitionWizard] = useState(false);
  const [prefilledSourceYearId, setPrefilledSourceYearId] = useState<number | null>(null);
  const [formData, setFormData] = useState<AcademicYearFormData>({
    label: "",
    start_date: "",
    end_date: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [archiveDialog, setArchiveDialog] = useState<ArchiveConfirmDialog>({
    isOpen: false,
    yearId: null,
    yearLabel: "",
    confirmed: false,
  });
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  useImperativeHandle(ref, () => ({
    handleCreate: () => setShowCreateForm(true),
    handleTransition: () => {
      setPrefilledSourceYearId(null);
      setShowTransitionWizard(true);
    },
  }));

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showCreateForm) {
          handleCancel();
        } else if (archiveDialog.isOpen) {
          setArchiveDialog({ isOpen: false, yearId: null, yearLabel: "", confirmed: false });
        }
      }
    };
    
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showCreateForm, archiveDialog.isOpen]);

  const loadAcademicYears = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await academicYearService.listAcademicYears({
        per_page: 100,
      });
      setAcademicYears(response.academic_years);
    } catch (err: any) {
      setError("Kon academische jaren niet laden.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAcademicYears();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await academicYearService.createAcademicYear(formData);
      setShowCreateForm(false);
      setFormData({ label: "", start_date: "", end_date: "" });
      loadAcademicYears();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "Kon academisch jaar niet aanmaken. Probeer het opnieuw."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setShowCreateForm(false);
    setFormData({ label: "", start_date: "", end_date: "" });
    setError(null);
  };

  const handleStartTransition = (yearId: number) => {
    setPrefilledSourceYearId(yearId);
    setShowTransitionWizard(true);
    setOpenMenuId(null);
  };

  const handleArchiveClick = (year: AcademicYear) => {
    setArchiveDialog({
      isOpen: true,
      yearId: year.id,
      yearLabel: year.label,
      confirmed: false,
    });
    setOpenMenuId(null);
  };

  const handleArchiveConfirm = async () => {
    if (!archiveDialog.yearId || !archiveDialog.confirmed) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await academicYearService.archiveAcademicYear(archiveDialog.yearId);
      setArchiveDialog({ isOpen: false, yearId: null, yearLabel: "", confirmed: false });
      loadAcademicYears();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "Kon academisch jaar niet archiveren. Probeer het opnieuw."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Form Modal */}
      {showCreateForm && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-year-title"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 id="create-year-title" className="mb-4 text-xl font-bold text-gray-900">
              Nieuw Academisch Jaar
            </h3>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="label"
                  className="block text-sm font-medium text-gray-700"
                >
                  Label (bijv. 2025-2026) *
                </label>
                <input
                  id="label"
                  type="text"
                  required
                  value={formData.label}
                  onChange={(e) =>
                    setFormData({ ...formData, label: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="2025-2026"
                />
              </div>

              <div>
                <label
                  htmlFor="start_date"
                  className="block text-sm font-medium text-gray-700"
                >
                  Startdatum *
                </label>
                <input
                  id="start_date"
                  type="date"
                  required
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="end_date"
                  className="block text-sm font-medium text-gray-700"
                >
                  Einddatum *
                </label>
                <input
                  id="end_date"
                  type="date"
                  required
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, end_date: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCancel}
                  disabled={submitting}
                >
                  Annuleren
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Aanmaken..." : "Aanmaken"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      {archiveDialog.isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-dialog-title"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 id="archive-dialog-title" className="mb-4 text-xl font-bold text-gray-900">
              Academisch jaar archiveren
            </h3>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <p className="mb-4 text-sm text-gray-700">
              Dit schooljaar <strong>{archiveDialog.yearLabel}</strong> wordt alleen-lezen. 
              Historische gegevens blijven behouden, maar er kunnen geen wijzigingen meer worden aangebracht.
            </p>

            <div className="mb-6 flex items-start">
              <input
                type="checkbox"
                id="archive-confirm-checkbox"
                checked={archiveDialog.confirmed}
                onChange={(e) => setArchiveDialog({ ...archiveDialog, confirmed: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="archive-confirm-checkbox" className="ml-2 text-sm text-gray-700">
                Ik begrijp dat dit niet ongedaan kan worden gemaakt
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setArchiveDialog({ isOpen: false, yearId: null, yearLabel: "", confirmed: false });
                  setError(null);
                }}
                disabled={submitting}
              >
                Annuleren
              </Button>
              <Button 
                onClick={handleArchiveConfirm}
                disabled={!archiveDialog.confirmed || submitting}
              >
                {submitting ? "Archiveren..." : "Archiveren"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Transition Wizard */}
      <YearTransitionWizard
        isOpen={showTransitionWizard}
        prefilledSourceYearId={prefilledSourceYearId}
        onClose={() => {
          setShowTransitionWizard(false);
          setPrefilledSourceYearId(null);
        }}
        onSuccess={() => {
          setShowTransitionWizard(false);
          setPrefilledSourceYearId(null);
          loadAcademicYears();
        }}
      />

      {/* List of Academic Years */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Academische Jaren
          </h3>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          </div>
        ) : error && academicYears.length === 0 ? (
          <div className="rounded-lg bg-red-50 p-4 text-red-800">{error}</div>
        ) : academicYears.length === 0 ? (
          <Card className="p-6 text-center text-gray-500">
            Geen academische jaren gevonden. Maak er een aan om te beginnen.
          </Card>
        ) : (
          <div className="grid gap-3">
            {academicYears.map((year) => (
              <Card key={year.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-gray-900">
                          {year.label}
                        </div>
                        {year.is_archived && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Gearchiveerd
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {new Date(year.start_date).toLocaleDateString("nl-NL")} -{" "}
                        {new Date(year.end_date).toLocaleDateString("nl-NL")}
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === year.id ? null : year.id)}
                      className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                      aria-label="Acties"
                    >
                      <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                    
                    {openMenuId === year.id && (
                      <>
                        {/* Backdrop to close menu */}
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
                          <div className="py-1" role="menu">
                            <button
                              onClick={() => handleStartTransition(year.id)}
                              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              role="menuitem"
                            >
                              Jaartransitie starten
                            </button>
                            <button
                              onClick={() => handleArchiveClick(year)}
                              disabled={year.is_archived}
                              className={`block w-full text-left px-4 py-2 text-sm ${
                                year.is_archived
                                  ? "text-gray-400 cursor-not-allowed"
                                  : "text-gray-700 hover:bg-gray-100"
                              }`}
                              role="menuitem"
                            >
                              Archiveren
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

AcademicYearsManagement.displayName = "AcademicYearsManagement";

export default AcademicYearsManagement;
