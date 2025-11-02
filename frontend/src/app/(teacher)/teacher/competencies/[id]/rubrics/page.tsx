"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { competencyService } from "@/services";
import { Loading, ErrorMessage } from "@/components";

interface RubricLevel {
  id?: number;
  level: number;
  label?: string;
  description: string;
}

export default function CompetencyRubricsPage() {
  const router = useRouter();
  const params = useParams();
  const competencyId = Number(params.id);

  const [competency, setCompetency] = useState<any>(null);
  const [rubricLevels, setRubricLevels] = useState<RubricLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [competencyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [comp, levels] = await Promise.all([
        competencyService.getCompetency(competencyId),
        competencyService.getRubricLevels(competencyId),
      ]);
      setCompetency(comp);
      
      // Initialize rubric levels for the scale if none exist
      if (levels.length === 0) {
        const initialLevels: RubricLevel[] = [];
        for (let i = comp.scale_min; i <= comp.scale_max; i++) {
          initialLevels.push({
            level: i,
            label: comp.scale_labels[i.toString()] || "",
            description: "",
          });
        }
        setRubricLevels(initialLevels);
      } else {
        setRubricLevels(levels);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLevel = (level: number, field: string, value: string) => {
    setRubricLevels((prev) =>
      prev.map((rl) =>
        rl.level === level ? { ...rl, [field]: value } : rl
      )
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Save or update each level
      for (const level of rubricLevels) {
        if (!level.description.trim()) {
          continue; // Skip empty levels
        }

        const data = {
          competency_id: competencyId,
          level: level.level,
          label: level.label || null,
          description: level.description,
        };

        if (level.id) {
          // Update existing
          await competencyService.updateRubricLevel(competencyId, level.id, {
            label: level.label,
            description: level.description,
          });
        } else {
          // Create new
          const created = await competencyService.createRubricLevel(
            competencyId,
            data
          );
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
      setError(
        err instanceof Error ? err.message : "Failed to save rubric levels"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!competency) return <ErrorMessage message="Competency not found" />;

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">
          Rubric Levels voor {competency.name}
        </h1>
        <p className="text-gray-600">
          Definieer voorbeeldgedrag voor elk niveau van deze competentie
        </p>
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="space-y-4">
        {rubricLevels.map((level) => (
          <div
            key={level.level}
            className="p-6 border rounded-xl bg-white space-y-3"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl font-bold text-blue-600">
                Niveau {level.level}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Label (optioneel)
              </label>
              <input
                type="text"
                value={level.label || ""}
                onChange={(e) =>
                  handleUpdateLevel(level.level, "label", e.target.value)
                }
                placeholder="bijv. Startend, Basis, Gevorderd, Sterk"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Voorbeeldgedrag <span className="text-red-600">*</span>
              </label>
              <textarea
                value={level.description}
                onChange={(e) =>
                  handleUpdateLevel(level.level, "description", e.target.value)
                }
                placeholder="Beschrijf concreet gedrag dat bij dit niveau hoort..."
                rows={4}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Geef concrete voorbeelden van gedrag dat studenten op dit niveau
                laten zien
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.push("/teacher/competencies")}
          className="px-6 py-2 border rounded-lg hover:bg-gray-50"
        >
          Annuleren
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Opslaan..." : "Opslaan"}
        </button>
      </div>
    </main>
  );
}
