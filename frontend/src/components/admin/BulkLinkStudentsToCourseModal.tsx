"use client";

import { useState, useEffect } from "react";
import { Course } from "@/dtos/course.dto";
import { courseService } from "@/services/course.service";

type BulkLinkStudentsToCourseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  studentCount: number;
  onLink: (courseName: string) => Promise<void>;
};

export default function BulkLinkStudentsToCourseModal({
  isOpen,
  onClose,
  studentCount,
  onLink,
}: BulkLinkStudentsToCourseModalProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseName, setSelectedCourseName] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCourses();
      setSelectedCourseName("");
      setError(null);
    }
  }, [isOpen]);

  const loadCourses = async () => {
    setLoadingCourses(true);
    try {
      const response = await courseService.listCourses({
        page: 1,
        per_page: 200, // Increased limit to accommodate schools with many courses
        is_active: true,
      });
      setCourses(response.courses);
    } catch (err) {
      console.error("Failed to load courses:", err);
      setError("Kon vakken niet laden");
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCourseName) {
      setError("Selecteer een vak");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onLink(selectedCourseName);
      onClose();
    } catch (err: any) {
      console.error("Failed to bulk link students to course:", err);
      setError(err.message || "Kon leerlingen niet koppelen aan vak");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full mx-4">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Koppel leerlingen aan vak
          </h2>
          
          <p className="text-sm text-gray-600 mb-6">
            Koppel <strong>{studentCount} {studentCount === 1 ? "leerling" : "leerlingen"}</strong> aan een vak
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="course" className="block text-sm font-medium text-gray-700 mb-2">
                Selecteer vak *
              </label>
              {loadingCourses ? (
                <div className="text-sm text-gray-500">Vakken laden...</div>
              ) : (
                <select
                  id="course"
                  value={selectedCourseName}
                  onChange={(e) => setSelectedCourseName(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                >
                  <option value="">-- Selecteer een vak --</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.name}>
                      {course.name} {course.code && `(${course.code})`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Annuleren
              </button>
              <button
                type="submit"
                disabled={loading || loadingCourses}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Bezig met koppelen..." : "Koppelen"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
