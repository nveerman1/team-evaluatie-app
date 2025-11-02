"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { competencyService } from "@/services";
import type { CompetencyWindowCreate } from "@/dtos";
import { ErrorMessage } from "@/components";

export default function CreateWindowPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<CompetencyWindowCreate>({
    title: "",
    description: "",
    class_names: [],
    start_date: "",
    end_date: "",
    status: "draft",
    require_self_score: true,
    require_goal: false,
    require_reflection: false,
  });
  const [classNameInput, setClassNameInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddClass = () => {
    if (classNameInput.trim() && !formData.class_names?.includes(classNameInput.trim())) {
      setFormData({
        ...formData,
        class_names: [...(formData.class_names || []), classNameInput.trim()],
      });
      setClassNameInput("");
    }
  };

  const handleRemoveClass = (className: string) => {
    setFormData({
      ...formData,
      class_names: (formData.class_names || []).filter((c) => c !== className),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setError("Titel is verplicht");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await competencyService.createWindow(formData);
      router.push("/teacher/competencies");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create window");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Nieuw Competentievenster</h1>
        <p className="text-gray-600">
          Maak een nieuwe periode aan voor competentiescans
        </p>
      </div>

      {error && <ErrorMessage message={error} />}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-6 border rounded-xl bg-white space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Titel <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="bijv. Startscan Q1 2025, Eindscan Project 2"
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
              placeholder="Optionele beschrijving van deze scan..."
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Startdatum
              </label>
              <input
                type="date"
                value={formData.start_date?.split("T")[0] || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    start_date: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : "",
                  })
                }
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Einddatum
              </label>
              <input
                type="date"
                value={formData.end_date?.split("T")[0] || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    end_date: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : "",
                  })
                }
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Classes */}
          <div>
            <label className="block text-sm font-medium mb-2">Klassen</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={classNameInput}
                onChange={(e) => setClassNameInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddClass();
                  }
                }}
                placeholder="bijv. 4A, 4B"
                className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddClass}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Toevoegen
              </button>
            </div>
            {formData.class_names && formData.class_names.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.class_names.map((className) => (
                  <span
                    key={className}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-2"
                  >
                    {className}
                    <button
                      type="button"
                      onClick={() => handleRemoveClass(className)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="draft">Concept</option>
              <option value="open">Open</option>
              <option value="closed">Gesloten</option>
            </select>
          </div>

          {/* Requirements */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Verplichte onderdelen:</p>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.require_self_score}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      require_self_score: e.target.checked,
                    })
                  }
                  className="mr-2"
                />
                <span className="text-sm">Zelfscore (aanbevolen)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.require_goal}
                  onChange={(e) =>
                    setFormData({ ...formData, require_goal: e.target.checked })
                  }
                  className="mr-2"
                />
                <span className="text-sm">Leerdoel</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.require_reflection}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      require_reflection: e.target.checked,
                    })
                  }
                  className="mr-2"
                />
                <span className="text-sm">Reflectie</span>
              </label>
            </div>
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
            {submitting ? "Opslaan..." : "Venster Aanmaken"}
          </button>
        </div>
      </form>
    </main>
  );
}
