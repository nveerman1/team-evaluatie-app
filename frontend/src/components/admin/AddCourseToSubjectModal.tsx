"use client";

import { useState, useEffect } from "react";
import { Course } from "@/dtos/course.dto";
import { courseService } from "@/services/course.service";

type AddCourseToSubjectModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (courseId: number) => Promise<void>;
  subjectId: number;
  existingCourseIds: number[];
};

export default function AddCourseToSubjectModal({
  isOpen,
  onClose,
  onAdd,
  subjectId,
  existingCourseIds,
}: AddCourseToSubjectModalProps) {
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadAvailableCourses();
    }
  }, [isOpen, subjectId]);

  const loadAvailableCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get all active courses
      const response = await courseService.listCourses({
        is_active: true,
        per_page: 100,
      });
      
      // Filter out courses that are already linked to this subject
      const available = response.courses.filter(
        (course) => !existingCourseIds.includes(course.id)
      );
      
      setAvailableCourses(available);
      setSelectedCourseId(available.length > 0 ? available[0].id : null);
    } catch (err) {
      console.error("Failed to load courses:", err);
      setError("Kon beschikbare courses niet laden");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCourseId) {
      setError("Selecteer een course");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onAdd(selectedCourseId);
      onClose();
    } catch (err: any) {
      console.error("Failed to add course:", err);
      setError(
        err?.response?.data?.detail ||
          "Kon course niet toevoegen. Probeer het opnieuw."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const filteredCourses = availableCourses.filter((course) =>
    course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (course.code && course.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-2xl font-bold text-gray-900">
          Course toevoegen aan sectie
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          </div>
        ) : availableCourses.length === 0 ? (
          <div className="py-8">
            <div className="rounded-lg bg-yellow-50 p-6 text-center">
              <p className="text-lg font-medium text-yellow-900">
                Geen beschikbare courses
              </p>
              <p className="mt-1 text-yellow-700 text-sm">
                Alle actieve courses zijn al gekoppeld aan deze sectie
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-6">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Sluiten
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="search"
                className="block text-sm font-medium text-gray-700"
              >
                Zoeken
              </label>
              <input
                id="search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Zoek op naam of code..."
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="course"
                className="block text-sm font-medium text-gray-700"
              >
                Selecteer course *
              </label>
              <select
                id="course"
                value={selectedCourseId || ""}
                onChange={(e) => setSelectedCourseId(parseInt(e.target.value))}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {filteredCourses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                    {course.code && ` (${course.code})`}
                    {course.level && ` - ${course.level}`}
                    {course.year && ` - ${course.year}`}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {filteredCourses.length} beschikbare course(s)
              </p>
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
                disabled={submitting || !selectedCourseId}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Toevoegen..." : "Course toevoegen"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
