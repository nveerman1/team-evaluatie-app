"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { competencyService } from "@/services";
import type { CompetencyCreate } from "@/dtos";
import { ErrorMessage } from "@/components";

export default function CreateCompetencyPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<CompetencyCreate>({
    name: "",
    description: "",
    category: "",
    order: 0,
    active: true,
    scale_min: 1,
    scale_max: 5,
    scale_labels: {
      "1": "Startend",
      "2": "Basis",
      "3": "In opbouw",
      "4": "Voldoende",
      "5": "Sterk",
    },
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError("Naam is verplicht");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await competencyService.createCompetency(formData);
      router.push("/teacher/competencies");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create competency");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Nieuwe Competentie</h1>
        <p className="text-gray-600">Voeg een nieuwe competentie toe</p>
      </div>

      {error && <ErrorMessage message={error} />}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-6 border rounded-xl bg-white space-y-4">
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

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2">Categorie</label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
              placeholder="bijv. Domein, Denkwijzen, Werkwijzen"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Order */}
          <div>
            <label className="block text-sm font-medium mb-2">Volgorde</label>
            <input
              type="number"
              value={formData.order}
              onChange={(e) =>
                setFormData({ ...formData, order: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              Bepaalt de volgorde waarin competenties worden getoond
            </p>
          </div>

          {/* Scale */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Schaal Min
              </label>
              <input
                type="number"
                value={formData.scale_min}
                onChange={(e) =>
                  setFormData({ ...formData, scale_min: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Schaal Max
              </label>
              <input
                type="number"
                value={formData.scale_max}
                onChange={(e) =>
                  setFormData({ ...formData, scale_max: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

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
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Opslaan..." : "Competentie Aanmaken"}
          </button>
        </div>
      </form>
    </main>
  );
}
