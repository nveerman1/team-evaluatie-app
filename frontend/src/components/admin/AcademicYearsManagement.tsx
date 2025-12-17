"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { academicYearService } from "@/services/academic-year.service";
import { AcademicYear } from "@/dtos/academic-year.dto";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import YearTransitionWizard from "./YearTransitionWizard";

interface AcademicYearFormData {
  label: string;
  start_date: string;
  end_date: string;
}

const AcademicYearsManagement = forwardRef((props, ref) => {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showTransitionWizard, setShowTransitionWizard] = useState(false);
  const [formData, setFormData] = useState<AcademicYearFormData>({
    label: "",
    start_date: "",
    end_date: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useImperativeHandle(ref, () => ({
    handleCreate: () => setShowCreateForm(true),
    handleTransition: () => setShowTransitionWizard(true),
  }));

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showCreateForm) {
        handleCancel();
      }
    };
    
    if (showCreateForm) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [showCreateForm]);

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

      {/* Transition Wizard */}
      <YearTransitionWizard
        isOpen={showTransitionWizard}
        onClose={() => setShowTransitionWizard(false)}
        onSuccess={() => {
          setShowTransitionWizard(false);
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
                  <div>
                    <div className="font-semibold text-gray-900">
                      {year.label}
                    </div>
                    <div className="text-sm text-gray-600">
                      {new Date(year.start_date).toLocaleDateString("nl-NL")} -{" "}
                      {new Date(year.end_date).toLocaleDateString("nl-NL")}
                    </div>
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
