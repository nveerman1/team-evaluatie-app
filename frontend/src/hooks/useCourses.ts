import { useState, useEffect, useMemo } from "react";
import { courseService } from "@/services/course.service";
import { Course } from "@/dtos/course.dto";

/**
 * Hook to fetch and manage courses list with full course details
 */
export function useCourses() {
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    courseService
      .listCourses({ per_page: 100, is_active: true })
      .then((data) => setCourses(data.courses || []))
      .catch(() => setCourses([]));
  }, []);

  const courseNameById = useMemo(() => {
    const map = new Map<number, string>();
    courses.forEach((c) => map.set(c.id, c.name ?? `Course #${c.id}`));
    return map;
  }, [courses]);

  return { courses, courseNameById };
}
