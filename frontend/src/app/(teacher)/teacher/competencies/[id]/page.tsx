"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { competencyService } from "@/services";
import type { Competency, CompetencyUpdate, CompetencyCategory } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";

interface RubricLevel {
  id?: number;
  level: number;
  label?: string;
  description: string;
}

export default function EditCompetencyPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [competency, setCompetency] = useState<Competency | null>(null);
  const [categories, setCategories] = useState<CompetencyCategory[]>([]);
  const [formData, setFormData] = useState<CompetencyUpdate>({});
  const [rubricLevels, setRubricLevels] = useState<RubricLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCompetency();
  }, [id]);

  const loadCompetency = async () => {
    try {
      setLoading(true);
      const [data, levels, cats] = await Promise.all([
        competencyService.getCompetency(id),
        competencyService.getRubricLevels(id),
        competencyService.getCategories(),
      ]);
      
      setCompetency(data);
      setCategories(cats);
      setFormData({
        name: data.name,
        description: data.description || "",
        category: data.category || "",
        category_id: data.category_id,
        order: data.order,
        active: data.active,
        scale_min: data.scale_min,
        scale_max: data.scale_max,
        scale_labels: data.scale_labels,
      });

      // Initialize rubric levels
      if (levels.length === 0) {
        const defaultLabels = ["Startend", "Basis", "Competent", "Gevorderd", "Excellent"];
        const initialLevels: RubricLevel[] = [];
        for (let i = data.scale_min; i <= data.scale_max; i++) {
          initialLevels.push({
            level: i,
            label: defaultLabels[i - 1] || `Niveau ${i}`,
            description: "",
          });
        }
        setRubricLevels(initialLevels);
      } else {
        setRubricLevels(levels);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load competency");
    } finally {
      setLoading(false);
    }
  };

  const handleRubricLevelChange = (level: number, field: string, value: string) => {
    setRubricLevels((prev) =>
      prev.map((rl) =>
        rl.level === level ? { ...rl, [field]: value } : rl
      )
    );
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
      
      // Update competency
      await competencyService.updateCompetency(id, formData);

      // Save or update rubric levels
      for (const level of rubricLevels) {
        if (!level.description.trim()) {
          continue; // Skip empty levels
        }

        const data = {
          competency_id: id,
          level: level.level,
          label: level.label || undefined,
          description: level.description,
        };

        if (level.id) {
          // Update existing
          await competencyService.updateRubricLevel(id, level.id, {
            label: level.label || undefined,
            description: level.description,
          });
        } else {
          // Create new
          const created = await competencyService.createRubricLevel(id, data);
          // Update the level with the new id
          setRubricLevels((prev) =>
            prev.map((rl) =>
              rl.level === level.level ? { ...rl, id: created.id } : rl
            )
          );
        }
      }

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

  // Get color for selected category
  const selectedCategory = categories.find(c => c.id === formData.category_id);

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
          {/* Category Selection - NEW */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Categorie <span className="text-blue-600">(nieuw)</span>
            </label>
            {categories.length > 0 ? (
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
                Nog geen categorieën beschikbaar.
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

          {/* Legacy Category - now hidden */}
          <input type="hidden" value={formData.category || ""} />

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

        {/* Rubric Levels Section */}
        <div className="p-6 border rounded-xl bg-white space-y-4">
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-1">Rubric Niveaus</h2>
            <p className="text-sm text-gray-600">
              Definieer labels en voorbeeldgedrag voor elk niveau
            </p>
          </div>

          <div className="space-y-4">
            {rubricLevels.map((level) => (
              <div
                key={level.level}
                className="p-4 border rounded-lg bg-gray-50 space-y-3"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-lg font-bold text-blue-600">
                    Niveau {level.level}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Label
                  </label>
                  <input
                    type="text"
                    value={level.label || ""}
                    onChange={(e) =>
                      handleRubricLevelChange(level.level, "label", e.target.value)
                    }
                    placeholder="bijv. Startend, Basis, Competent, Gevorderd, Excellent"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Voorbeeldgedrag
                  </label>
                  <textarea
                    value={level.description}
                    onChange={(e) =>
                      handleRubricLevelChange(
                        level.level,
                        "description",
                        e.target.value
                      )
                    }
                    placeholder="Beschrijf concreet gedrag dat bij dit niveau hoort..."
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            ))}
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
