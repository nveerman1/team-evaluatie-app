"use client";

import { useState, useEffect } from "react";
import { Subject, SubjectCreate, SubjectUpdate } from "@/dtos/subject.dto";

type SubjectFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SubjectCreate | SubjectUpdate) => Promise<void>;
  subject?: Subject | null;
  mode: "create" | "edit";
};

export default function SubjectFormModal({
  isOpen,
  onClose,
  onSubmit,
  subject,
  mode,
}: SubjectFormModalProps) {
  const [formData, setFormData] = useState<SubjectCreate>({
    name: "",
    code: "",
    color: "",
    icon: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "edit" && subject) {
      setFormData({
        name: subject.name,
        code: subject.code,
        color: subject.color || "",
        icon: subject.icon || "",
      });
    } else {
      setFormData({
        name: "",
        code: "",
        color: "",
        icon: "",
      });
    }
    setError(null);
  }, [mode, subject, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const submitData: SubjectCreate | SubjectUpdate = {
        name: formData.name,
        code: formData.code,
        color: formData.color || undefined,
        icon: formData.icon || undefined,
      };

      await onSubmit(submitData);
      onClose();
    } catch (err: any) {
      console.error("Failed to submit subject:", err);
      setError(
        err?.response?.data?.detail ||
          `Kon sectie niet ${mode === "create" ? "aanmaken" : "bijwerken"}. Probeer het opnieuw.`
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
          {mode === "create" ? "Nieuwe sectie aanmaken" : "Sectie bewerken"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Naam van de sectie *
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
              Code *
            </label>
            <input
              id="code"
              type="text"
              required
              value={formData.code}
              onChange={(e) =>
                setFormData({ ...formData, code: e.target.value })
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="bijv. O&O"
            />
          </div>

          <div>
            <label
              htmlFor="color"
              className="block text-sm font-medium text-gray-700"
            >
              Kleur (optioneel)
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="color"
                type="color"
                value={formData.color || "#3B82F6"}
                onChange={(e) =>
                  setFormData({ ...formData, color: e.target.value })
                }
                className="h-10 w-20 rounded-md border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={formData.color || ""}
                onChange={(e) =>
                  setFormData({ ...formData, color: e.target.value })
                }
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="#3B82F6"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="icon"
              className="block text-sm font-medium text-gray-700"
            >
              Icoon (optioneel)
            </label>
            <input
              id="icon"
              type="text"
              value={formData.icon || ""}
              onChange={(e) =>
                setFormData({ ...formData, icon: e.target.value })
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="bijv. 🔬"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
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
              {submitting
                ? mode === "create"
                  ? "Aanmaken..."
                  : "Bijwerken..."
                : mode === "create"
                ? "Sectie aanmaken"
                : "Wijzigingen opslaan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
