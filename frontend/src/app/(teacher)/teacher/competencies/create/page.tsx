"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { competencyService } from "@/services";
import type { CompetencyCreate, CompetencyCategory } from "@/dtos";
import { ErrorMessage } from "@/components";

export default function CreateCompetencyPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<CompetencyCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [formData, setFormData] = useState<CompetencyCreate>({
    name: "",
    description: "",
    category: "",
    category_id: undefined,
    active: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const cats = await competencyService.getCategories();
      setCategories(cats);
    } catch (err) {
      console.error("Failed to load categories:", err);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent, saveAndContinue = false) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError("Naam is verplicht");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const newCompetency = await competencyService.createCompetency(formData);
      if (saveAndContinue) {
        // Redirect to rubric levels page
        router.push(`/teacher/competencies/${newCompetency.id}/rubrics`);
      } else {
        router.push("/teacher/competencies");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create competency");
    } finally {
      setSubmitting(false);
    }
  };

  // Get color for selected category
  const selectedCategory = categories.find(c => c.id === formData.category_id);

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Nieuwe Competentie</h1>
        <p className="text-gray-600">Voeg een nieuwe competentie toe</p>
      </div>

      {error && <ErrorMessage message={error} />}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-6 border rounded-xl bg-white space-y-4">
          {/* Category Selection - NEW */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Categorie <span className="text-blue-600">(nieuw)</span>
            </label>
            {loadingCategories ? (
              <div className="animate-pulse h-10 bg-gray-200 rounded-lg" />
            ) : categories.length > 0 ? (
              <div className="space-y-2">
                <select
                  value={formData.category_id ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      category_id: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Selecteer een categorie --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {selectedCategory && (
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: selectedCategory.color || "#3B82F6" }}
                    />
                    <span className="text-sm text-gray-600">
                      {selectedCategory.description || "Geen beschrijving"}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">
                Nog geen categorieën beschikbaar. Deze worden automatisch aangemaakt.
              </p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Naam <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="bijv. Samenwerken, Communiceren"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Beschrijving
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Beschrijf wat deze competentie inhoudt..."
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Legacy Category - now hidden but kept for backward compatibility */}
          <input type="hidden" value={formData.category} />

          {/* Active */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="active"
              checked={formData.active}
              onChange={(e) =>
                setFormData({ ...formData, active: e.target.checked })
              }
              className="mr-2"
            />
            <label htmlFor="active" className="text-sm font-medium">
              Actief (zichtbaar voor leerlingen)
            </label>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/teacher/competencies")}
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
            Annuleren
          </button>
          <button
            type="submit"
            disabled={submitting}
            onClick={(e) => handleSubmit(e, false)}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            {submitting ? "Opslaan..." : "Opslaan"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={(e) => handleSubmit(e as React.FormEvent, true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Opslaan..." : "Opslaan en Verder"}
          </button>
        </div>
      </form>
    </main>
  );
}
