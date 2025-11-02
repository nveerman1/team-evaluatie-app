"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { competencyService } from "@/services";
import type { Competency, CompetencyUpdate } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";

export default function EditCompetencyPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [competency, setCompetency] = useState<Competency | null>(null);
  const [formData, setFormData] = useState<CompetencyUpdate>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCompetency();
  }, [id]);

  const loadCompetency = async () => {
    try {
      setLoading(true);
      const data = await competencyService.getCompetency(id);
      setCompetency(data);
      setFormData({
        name: data.name,
        description: data.description || "",
        category: data.category || "",
        order: data.order,
        active: data.active,
        scale_min: data.scale_min,
        scale_max: data.scale_max,
        scale_labels: data.scale_labels,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load competency");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      setError("Naam is verplicht");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await competencyService.updateCompetency(id, formData);
      router.push("/teacher/competencies");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update competency");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Weet je zeker dat je deze competentie wilt verwijderen?")) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await competencyService.deleteCompetency(id);
      router.push("/teacher/competencies");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete competency");
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;
  if (error && !competency) return <ErrorMessage message={error} />;
  if (!competency) return <ErrorMessage message="Competency not found" />;

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Competentie Bewerken</h1>
        <p className="text-gray-600">Wijzig de details van deze competentie</p>
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
              value={formData.name || ""}
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
              value={formData.description || ""}
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
              value={formData.category || ""}
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
              value={formData.order ?? 0}
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
                value={formData.scale_min ?? 1}
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
                value={formData.scale_max ?? 5}
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
              checked={formData.active ?? true}
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
        <div className="flex justify-between">
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            Verwijderen
          </button>
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
              {submitting ? "Opslaan..." : "Wijzigingen Opslaan"}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
