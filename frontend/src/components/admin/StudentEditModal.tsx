"use client";

import { useState, useEffect } from "react";
import { AdminStudent, adminStudentService } from "@/services/admin-students.service";
import { Course } from "@/dtos/course.dto";
import { courseService } from "@/services/course.service";

type StudentEditModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  studentId?: number | null;
  mode: "create" | "edit";
};

export default function StudentEditModal({
  isOpen,
  onClose,
  onSubmit,
  studentId,
  mode,
}: StudentEditModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [className, setClassName] = useState("");
  const [selectedCourseName, setSelectedCourseName] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [courses, setCourses] = useState<Course[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load student data when editing
  useEffect(() => {
    if (isOpen && mode === "edit" && studentId) {
      loadStudent(studentId);
    } else if (isOpen && mode === "create") {
      // Reset form for create mode
      setName("");
      setEmail("");
      setClassName("");
      setSelectedCourseName("");
      setStatus("active");
      setError(null);
    }
    loadCourses();
  }, [isOpen, mode, studentId]);

  const loadStudent = async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const student = await adminStudentService.getStudent(id);
      setName(student.name);
      setEmail(student.email);
      setClassName(student.class_name || "");
      setSelectedCourseName(student.course_name || "");
      setStatus(student.status);
    } catch (err) {
      console.error("Failed to load student:", err);
      setError("Kon leerling niet laden");
    } finally {
      setIsLoading(false);
    }
  };

  const loadCourses = async () => {
    try {
      const response = await courseService.listCourses({
        page: 1,
        per_page: 100,
        is_active: true,
      });
      setCourses(response.courses);
    } catch (err) {
      console.error("Failed to load courses:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const data = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        class_name: className.trim() || undefined,
        course_name: selectedCourseName || undefined,
        status,
      };

      await onSubmit(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er is een fout opgetreden");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {mode === "create" ? "Nieuwe leerling aanmaken" : "Leerling bewerken"}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          </div>
        ) : (
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
                placeholder="Bijv. Jan Jansen"
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
                placeholder="bijv. j.jansen@student.nl"
              />
            </div>

            <div>
              <label
                htmlFor="className"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Klas
              </label>
              <input
                id="className"
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Bijv. G2a"
              />
            </div>

            <div>
              <label
                htmlFor="course"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Vak/Koppeling
              </label>
              <select
                id="course"
                value={selectedCourseName}
                onChange={(e) => setSelectedCourseName(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Geen vak geselecteerd --</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.name}>
                    {course.name} {course.code && `(${course.code})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="status"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Status *
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="active">Actief</option>
                <option value="inactive">Inactief</option>
              </select>
            </div>

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
        )}
      </div>
    </div>
  );
}
