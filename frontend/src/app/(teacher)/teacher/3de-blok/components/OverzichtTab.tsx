"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Search, Award, TrendingUp } from "lucide-react";
import { fetchWithErrorHandling } from "@/lib/api";

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

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [courseFilter, projectFilter]);

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
      if (courseFilter) params.append("course_id", courseFilter);
      if (projectFilter) params.append("project_id", projectFilter);
      
      const response = await fetchWithErrorHandling(`/api/v1/attendance/overview?${params.toString()}`);
      const data = await response.json();
      setStudents(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Error fetching overview:", err);
      setError(`Kon overzicht niet ophalen: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter((student) =>
    student.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.user_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get unique classes
  const uniqueClasses = Array.from(new Set(students.map(s => s.class_name).filter(Boolean)));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Overzicht laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-gray-200/80 rounded-xl p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Totaal studenten</p>
              <p className="text-2xl font-semibold">{students.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Gemiddeld lesblokken</p>
              <p className="text-2xl font-semibold">
                {students.length > 0
                  ? (students.reduce((sum, s) => sum + s.lesson_blocks, 0) / students.length).toFixed(1)
                  : "0"}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
          <div className="flex items-center gap-3">
            <Award className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-sm text-gray-600">Meeste lesblokken</p>
              <p className="text-2xl font-semibold">
                {students.length > 0 ? students[0].lesson_blocks : "0"}
              </p>
            </div>
          </div>
        </div>
      </div>

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
      <div className="overflow-hidden rounded-xl">
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
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-500">
                  Geen studenten gevonden
                </td>
              </tr>
            ) : (
              filteredStudents.map((student, index) => (
                <tr key={student.user_id} className="bg-white border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {index < 3 ? (
                        <span className="text-2xl">
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                        </span>
                      ) : (
                        <span className="text-gray-500 font-medium">#{index + 1}</span>
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
    </div>
  );
}
