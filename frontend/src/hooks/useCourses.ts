import { useState, useEffect, useMemo } from "react";
import { courseService } from "@/services/course.service";
import { CourseLite } from "@/dtos/course.dto";

/**
 * Hook to fetch and manage courses list
 */
export function useCourses() {
  const [courses, setCourses] = useState<CourseLite[]>([]);

  useEffect(() => {
    courseService
      .getCourses()
      .then((data) => setCourses(data))
      .catch(() => setCourses([]));
  }, []);

  const courseNameById = useMemo(() => {
    const map = new Map<number, string>();
    courses.forEach((c) => map.set(c.id, c.name ?? `Course #${c.id}`));
    return map;
  }, [courses]);

  return { courses, courseNameById };
}
