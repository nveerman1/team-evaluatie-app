"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { fetchWithErrorHandling } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import { Pagination } from "@/components/ui/pagination";

interface StudentOverview {
  user_id: number;
  user_name: string;
  user_email: string;
  class_name: string | null;
  total_school_seconds: number;
  total_external_approved_seconds: number;
  total_external_pending_seconds: number;
  lesson_blocks: number;
}

interface OverviewResponse {
  items: StudentOverview[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface Project {
  id: number;
  title: string;
  class_name: string | null;
  course_id: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
}

interface Course {
  id: number;
  name: string;
  code: string | null;
  period: string | null;
  level: string | null;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}u ${minutes}m`;
}

export default function OverzichtTab() {
  const [students, setStudents] = useState<StudentOverview[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseFilter, setCourseFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  // Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [debouncedSearchTerm, courseFilter, projectFilter, page]);

  useEffect(() => {
    // Reset page to 1 when search or filters change (immediate, before debounce)
    setPage(1);
  }, [searchTerm, courseFilter, projectFilter]);

  useEffect(() => {
    // Fetch projects when course filter changes
    if (courseFilter) {
      fetchProjects();
    } else {
      setProjects([]);
      setProjectFilter("");
    }
  }, [courseFilter]);

  const fetchCourses = async () => {
    try {
      const response = await fetchWithErrorHandling(`/api/v1/attendance/courses`);
      const data = await response.json();
      setCourses(data);
    } catch (err) {
      console.error("Error fetching courses:", err);
      setCourses([]);
    }
  };

  const fetchProjects = async () => {
    try {
      const params = new URLSearchParams();
      if (courseFilter) params.append("course_id", courseFilter);
      
      const response = await fetchWithErrorHandling(`/api/v1/attendance/projects-by-course?${params.toString()}`);
      const data = await response.json();
      setProjects(data);
      console.log(`Fetched ${data.length} projects for course ${courseFilter}`);
    } catch (err) {
      console.error("Error fetching projects:", err);
      // Don't set error state for projects, just log it
      setProjects([]);
    }
  };

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (debouncedSearchTerm) params.append("q", debouncedSearchTerm);
      if (courseFilter) params.append("course_id", courseFilter);
      if (projectFilter) params.append("project_id", projectFilter);
      params.append("page", page.toString());
      params.append("per_page", pageSize.toString());
      
      const response = await fetchWithErrorHandling(`/api/v1/attendance/overview?${params.toString()}`);
      const data: OverviewResponse = await response.json();
      setStudents(data.items);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Error fetching overview:", err);
      setError(`Kon overzicht niet ophalen: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Get unique classes
  const uniqueClasses = Array.from(new Set(students.map(s => s.class_name).filter(Boolean)));

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-gray-200/80 rounded-xl p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-4 flex-1 min-w-[200px]">
            <Search className="h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Zoek student op naam of email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
          <select
            className="px-3 py-2 border border-gray-300 rounded-md min-w-[200px] text-sm"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
          >
            <option value="">Alle vakken</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name} {course.code ? `(${course.code})` : ''}
              </option>
            ))}
          </select>
          <select
            className="px-3 py-2 border border-gray-300 rounded-md min-w-[200px] text-sm"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            disabled={!courseFilter || projects.length === 0}
          >
            <option value="">Alle projecten</option>
            {projects.map((project) => {
              let dateRange = '';
              try {
                if (project.start_date && project.end_date) {
                  const startDate = new Date(project.start_date);
                  const endDate = new Date(project.end_date);
                  if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                    dateRange = ` (${startDate.toLocaleDateString('nl-NL')} - ${endDate.toLocaleDateString('nl-NL')})`;
                  }
                } else if (project.start_date) {
                  const startDate = new Date(project.start_date);
                  if (!isNaN(startDate.getTime())) {
                    dateRange = ` (vanaf ${startDate.toLocaleDateString('nl-NL')})`;
                  }
                }
              } catch (error) {
                // Ignore date parsing errors
                console.warn('Error parsing project dates:', error);
              }
              return (
                <option key={project.id} value={project.id}>
                  {project.title}{dateRange}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Students Table */}
      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          Toont {students.length > 0 ? (page - 1) * pageSize + 1 : 0} tot {Math.min(page * pageSize, total)} van {total} studenten
        </div>
        <div className="overflow-x-auto overflow-y-hidden rounded-xl">
          <table className="w-full bg-white">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Rang</th>
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3">Klas</th>
                <th className="px-5 py-3">School uren</th>
                <th className="px-5 py-3">Extern (goedgekeurd)</th>
                <th className="px-5 py-3">Extern (in afwachting)</th>
                <th className="px-5 py-3">Lesblokken</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                      <p className="text-sm text-slate-600">Laden...</p>
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    Geen studenten gevonden
                  </td>
                </tr>
              ) : (
                students.map((student, index) => (
                  <tr key={student.user_id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {(page - 1) * pageSize + index < 3 ? (
                          <span className="text-2xl">
                            {(page - 1) * pageSize + index === 0 ? "🥇" : (page - 1) * pageSize + index === 1 ? "🥈" : "🥉"}
                          </span>
                        ) : (
                          <span className="text-gray-500 font-medium">#{(page - 1) * pageSize + index + 1}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-base font-bold text-slate-900">{student.user_name}</div>
                    </td>
                    <td className="px-5 py-4">
                      {student.class_name ? (
                        <Badge variant="outline">{student.class_name}</Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-700">
                        {formatDuration(student.total_school_seconds)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-green-600">
                        {formatDuration(student.total_external_approved_seconds)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-yellow-600">
                        {formatDuration(student.total_external_pending_seconds)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="default" className="text-lg px-3 py-1">
                        {student.lesson_blocks}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex justify-center pt-4">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
