"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { competencyService, courseService } from "@/services";
import type { CompetencyWindowCreate, Competency } from "@/dtos";
import { ErrorMessage, Loading } from "@/components";

interface Course {
  id: number;
  name: string;
}

export default function CreateWindowPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<CompetencyWindowCreate>({
    title: "",
    description: "",
    class_names: [],
    course_id: undefined,
    start_date: "",
    end_date: "",
    status: "draft",
    require_self_score: true,
    require_goal: false,
    require_reflection: false,
    settings: {},
  });
  const [courses, setCourses] = useState<Course[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [selectedCompetencies, setSelectedCompetencies] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [coursesData, competenciesData] = await Promise.all([
        courseService.getCourses(),
        competencyService.getCompetencies(true), // Only active competencies
      ]);
      setCourses(coursesData);
      setCompetencies(competenciesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleCompetencyToggle = (competencyId: number) => {
    setSelectedCompetencies(prev => {
      if (prev.includes(competencyId)) {
        return prev.filter(id => id !== competencyId);
      } else {
        return [...prev, competencyId];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setError("Titel is verplicht");
      return;
    }

    if (selectedCompetencies.length === 0) {
      setError("Selecteer minimaal één competentie");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      // Store selected competencies in settings
      const dataToSubmit = {
        ...formData,
        settings: {
          ...formData.settings,
          selected_competency_ids: selectedCompetencies,
        },
      };
      
      await competencyService.createWindow(dataToSubmit);
      router.push("/teacher/competencies");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create window");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;

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

          {/* Course Dropdown */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Vak/Course
            </label>
            <select
              value={formData.course_id || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  course_id: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Selecteer een vak (optioneel) --</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Koppel dit venster aan een specifiek vak voor betere organisatie
            </p>
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

          {/* Competency Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Competenties <span className="text-red-600">*</span>
            </label>
            <p className="text-sm text-gray-500 mb-3">
              Selecteer welke competenties je in dit venster wilt gebruiken
            </p>
            <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
              {competencies.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  Geen competenties beschikbaar. Maak eerst competenties aan.
                </p>
              ) : (
                competencies.map((comp) => (
                  <label
                    key={comp.id}
                    className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCompetencies.includes(comp.id)}
                      onChange={() => handleCompetencyToggle(comp.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{comp.name}</div>
                      {comp.description && (
                        <div className="text-sm text-gray-600">
                          {comp.description}
                        </div>
                      )}
                      {comp.category && (
                        <span className="inline-block px-2 py-0.5 mt-1 rounded bg-blue-50 text-blue-700 text-xs">
                          {comp.category}
                        </span>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
            {selectedCompetencies.length > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                {selectedCompetencies.length} competentie(s) geselecteerd
              </p>
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
