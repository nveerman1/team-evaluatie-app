"use client";

import { useState, useEffect } from "react";
import { Teacher, TeacherCreate, TeacherUpdate } from "@/services/teacher.service";

type TeacherFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TeacherCreate | TeacherUpdate) => Promise<void>;
  teacher?: Teacher | null;
  mode: "create" | "edit";
};

export default function TeacherFormModal({
  isOpen,
  onClose,
  onSubmit,
  teacher,
  mode,
}: TeacherFormModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"teacher" | "admin">("teacher");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "edit" && teacher) {
      setName(teacher.name);
      setEmail(teacher.email);
      setRole(teacher.role);
      setPassword("");
    } else {
      setName("");
      setEmail("");
      setRole("teacher");
      setPassword("");
    }
    setError(null);
  }, [mode, teacher, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === "create") {
        await onSubmit({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role,
          password: password || undefined,
        });
      } else {
        const updates: TeacherUpdate = {};
        if (name.trim() !== teacher?.name) updates.name = name.trim();
        if (email.trim().toLowerCase() !== teacher?.email)
          updates.email = email.trim().toLowerCase();
        if (role !== teacher?.role) updates.role = role;

        await onSubmit(updates);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {mode === "create" ? "Nieuwe docent aanmaken" : "Docent bewerken"}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Naam *
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Bijv. Anna de Vries"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              E-mailadres *
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="bijv. a.devries@school.nl"
            />
          </div>

          <div>
            <label
              htmlFor="role"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Rol *
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as "teacher" | "admin")}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="teacher">Docent</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {mode === "create" && (
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Wachtwoord (optioneel)
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Minimaal 8 tekens"
                minLength={8}
              />
              <p className="mt-1 text-xs text-gray-500">
                Laat leeg om de docent later zelf een wachtwoord te laten
                instellen
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting
                ? "Bezig..."
                : mode === "create"
                ? "Aanmaken"
                : "Opslaan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
