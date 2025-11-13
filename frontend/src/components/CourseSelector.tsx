"use client";

import { useState, useEffect } from "react";
import { Course } from "@/dtos/course.dto";
import { courseService } from "@/services/course.service";

interface CourseSelectorProps {
  selectedCourseId?: number;
  onCourseChange: (course: Course | null) => void;
  filterLevel?: string;
  filterYear?: number;
}

export default function CourseSelector({
  selectedCourseId,
  onCourseChange,
  filterLevel,
  filterYear,
}: CourseSelectorProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCourses();
  }, [filterLevel, filterYear]);

  const loadCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await courseService.listCourses({
        is_active: true,
        level: filterLevel,
        year: filterYear,
        per_page: 100,
      });
      setCourses(response.courses);

      // If no course is selected but we have courses, select the first one
      if (!selectedCourseId && response.courses.length > 0) {
        onCourseChange(response.courses[0]);
      }
    } catch (err) {
      console.error("Failed to load courses:", err);
      setError("Kon vakken niet laden");
    } finally {
      setLoading(false);
    }
  };

  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const courseId = parseInt(e.target.value);
    if (courseId === 0) {
      onCourseChange(null);
    } else {
      const course = courses.find((c) => c.id === courseId);
      onCourseChange(course || null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
        <span className="text-gray-600">Vakken laden...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-800">
        <p className="font-medium">Fout bij laden</p>
        <p className="text-sm">{error}</p>
        <button
          onClick={loadCourses}
          className="mt-2 rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
        >
          Opnieuw proberen
        </button>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="rounded-lg bg-yellow-50 p-4 text-yellow-800">
        <p className="font-medium">Geen vakken beschikbaar</p>
        <p className="text-sm">
          Er zijn geen actieve vakken gevonden. Neem contact op met een
          beheerder.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="course-select"
        className="text-sm font-medium text-gray-700"
      >
        Selecteer vak
      </label>
      <select
        id="course-select"
        value={selectedCourseId || 0}
        onChange={handleCourseChange}
        className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
      >
        <option value={0}>-- Selecteer een vak --</option>
        {courses.map((course) => (
          <option key={course.id} value={course.id}>
            {course.code ? `${course.code} - ` : ""}
            {course.name}
            {course.period ? ` (${course.period})` : ""}
            {course.level ? ` - ${course.level}` : ""}
          </option>
        ))}
      </select>

      {selectedCourseId && (
        <div className="text-sm text-gray-600">
          <span className="font-medium">
            {courses.find((c) => c.id === selectedCourseId)?.name}
          </span>
          {courses.find((c) => c.id === selectedCourseId)?.description && (
            <p className="mt-1 text-gray-500">
              {courses.find((c) => c.id === selectedCourseId)?.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
