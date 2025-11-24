"use client";

import { useState } from "react";
import { CourseCreate } from "@/dtos/course.dto";
import { courseService } from "@/services/course.service";

type CourseFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  subjectId?: number;
};

export default function CourseFormModal({
  isOpen,
  onClose,
  onSuccess,
  subjectId,
}: CourseFormModalProps) {
  const [formData, setFormData] = useState<CourseCreate>({
    name: "",
    code: "",
    level: "",
    year: new Date().getFullYear(),
    description: "",
    subject_id: subjectId,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await courseService.createCourse({
        ...formData,
        code: formData.code || undefined,
        level: formData.level || undefined,
        description: formData.description || undefined,
        subject_id: subjectId,
      });
      onSuccess();
    } catch (err: any) {
      console.error("Failed to create course:", err);
      setError(
        err?.response?.data?.detail ||
          "Kon vak niet aanmaken. Probeer het opnieuw."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-2xl font-bold text-gray-900">
          Nieuw vak aanmaken
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Naam van het vak *
            </label>
            <input
              id="name"
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="bijv. Onderzoek & Ontwerpen"
            />
          </div>

          <div>
            <label
              htmlFor="code"
              className="block text-sm font-medium text-gray-700"
            >
              Vakcode
            </label>
            <input
              id="code"
              type="text"
              value={formData.code}
              onChange={(e) =>
                setFormData({ ...formData, code: e.target.value })
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="bijv. O&O"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="level"
                className="block text-sm font-medium text-gray-700"
              >
                Niveau
              </label>
              <select
                id="level"
                value={formData.level}
                onChange={(e) =>
                  setFormData({ ...formData, level: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Selecteer niveau --</option>
                <option value="onderbouw">Onderbouw</option>
                <option value="bovenbouw">Bovenbouw</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="year"
                className="block text-sm font-medium text-gray-700"
              >
                Jaar
              </label>
              <input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    year: parseInt(e.target.value) || undefined,
                  })
                }
                min="2020"
                max="2100"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700"
            >
              Beschrijving
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Korte beschrijving van het vak"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Aanmaken..." : "Vak aanmaken"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
