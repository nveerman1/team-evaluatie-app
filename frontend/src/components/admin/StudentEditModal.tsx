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
  const [firstName, setFirstName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [className, setClassName] = useState("");
  const [selectedCourseName, setSelectedCourseName] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [studentNumber, setStudentNumber] = useState("");
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
      setFirstName("");
      setPrefix("");
      setLastName("");
      setEmail("");
      setClassName("");
      setSelectedCourseName("");
      setStatus("active");
      setStudentNumber("");
      setError(null);
    }
    loadCourses();
  }, [isOpen, mode, studentId]);

  const loadStudent = async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const student = await adminStudentService.getStudent(id);
      setFirstName(student.first_name || "");
      setPrefix(student.prefix || "");
      setLastName(student.last_name || "");
      setEmail(student.email);
      setClassName(student.class_name || "");
      setSelectedCourseName(student.course_name || "");
      setStatus(student.status);
      setStudentNumber(student.student_number || "");
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
      const fn = firstName.trim() || null;
      const pfx = prefix.trim() || null;
      const ln = lastName.trim() || null;
      const nameParts = [fn, pfx, ln].filter(Boolean);
      const computedName = nameParts.join(" ") || undefined;

      const data = {
        name: computedName,
        email: email.trim().toLowerCase(),
        class_name: className.trim() || undefined,
        course_name: selectedCourseName || undefined,
        status,
        student_number: studentNumber.trim() || null,
        first_name: fn,
        prefix: pfx,
        last_name: ln,
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="first_name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Voornaam *
                </label>
                <input
                  id="first_name"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Bijv. Jan"
                />
              </div>
              <div>
                <label
                  htmlFor="prefix"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Tussenvoegsel
                </label>
                <input
                  id="prefix"
                  type="text"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Bijv. van der"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="last_name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Achternaam *
              </label>
              <input
                id="last_name"
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Bijv. Jansen"
              />
            </div>

            <div>
              <label
                htmlFor="student_number"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Leerlingnummer
              </label>
              <input
                id="student_number"
                type="text"
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Bijv. 450000"
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
