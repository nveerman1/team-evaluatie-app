"use client";

import { useState, useEffect } from "react";
import { Teacher, CourseInfo } from "@/services/teacher.service";
import { courseService } from "@/services/course.service";

type SubjectAssignmentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  teacher: Teacher | null;
  onAssign: (courseId: number) => Promise<void>;
  onRemove: (courseId: number) => Promise<void>;
};

export default function SubjectAssignmentModal({
  isOpen,
  onClose,
  teacher,
  onAssign,
  onRemove,
}: SubjectAssignmentModalProps) {
  const [availableCourses, setAvailableCourses] = useState<CourseInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && teacher) {
      loadCourses();
    }
  }, [isOpen, teacher]);

  const loadCourses = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await courseService.listCourses({
        per_page: 100,
        is_active: true,
      });
      
      // Filter out courses already assigned to teacher
      const assignedIds = new Set(teacher?.courses.map((c) => c.id) || []);
      const available = response.courses.filter((c) => !assignedIds.has(c.id));
      
      setAvailableCourses(
        available.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          level: c.level,
          year: c.year,
        }))
      );
    } catch (err) {
      setError("Kon vakken niet laden");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (courseId: number) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onAssign(courseId);
      // Move course from available to assigned
      const course = availableCourses.find((c) => c.id === courseId);
      if (course && teacher) {
        teacher.courses.push(course);
        setAvailableCourses(availableCourses.filter((c) => c.id !== courseId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kon vak niet toewijzen");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (courseId: number) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onRemove(courseId);
      // Move course from assigned to available
      const course = teacher?.courses.find((c) => c.id === courseId);
      if (course && teacher) {
        teacher.courses = teacher.courses.filter((c) => c.id !== courseId);
        setAvailableCourses([...availableCourses, course]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Kon vak niet verwijderen"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !teacher) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[80vh] overflow-y-auto">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Vakken beheren voor {teacher.name}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Koppel of ontkoppel vakken aan deze docent
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Assigned Courses */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Gekoppelde vakken ({teacher.courses.length})
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {teacher.courses.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">
                  Nog geen vakken gekoppeld
                </p>
              ) : (
                teacher.courses.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {course.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {course.code && `${course.code} · `}
                        {course.level && `${course.level} · `}
                        {course.year}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(course.id)}
                      disabled={isSubmitting}
                      className="ml-2 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                    >
                      Verwijder
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Available Courses */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Beschikbare vakken ({availableCourses.length})
            </h3>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {availableCourses.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">
                    Alle vakken zijn al gekoppeld
                  </p>
                ) : (
                  availableCourses.map((course) => (
                    <div
                      key={course.id}
                      className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {course.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {course.code && `${course.code} · `}
                          {course.level && `${course.level} · `}
                          {course.year}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAssign(course.id)}
                        disabled={isSubmitting}
                        className="ml-2 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                      >
                        Toevoegen
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 mt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}
