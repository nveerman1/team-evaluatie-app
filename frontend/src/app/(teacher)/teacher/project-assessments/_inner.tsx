"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import api, { ApiAuthError } from "@/lib/api";
import { projectAssessmentService } from "@/services";
import { ProjectAssessmentListItem } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";

type Course = {
  id: number;
  name: string;
};

export default function ProjectAssessmentsListInner() {
  const [data, setData] = useState<ProjectAssessmentListItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");

  useEffect(() => {
    async function loadCourses() {
      try {
        const response = await api.get<Course[]>("/students/courses");
        setCourses(Array.isArray(response.data) ? response.data : []);
      } catch (e) {
        console.error("Failed to load courses", e);
      }
    }
    loadCourses();
  }, []);

  async function fetchList(courseId?: number, status?: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await projectAssessmentService.getProjectAssessments(
        undefined,
        courseId,
        status === "all" ? undefined : status
      );
      setData(response.items || []);
    } catch (e: any) {
      if (e instanceof ApiAuthError) {
        setError(e.originalMessage);
      } else {
        setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const courseId = courseFilter === "all" ? undefined : Number(courseFilter);
    const status = statusFilter === "all" ? undefined : statusFilter;
    fetchList(courseId, status);
  }, [statusFilter, courseFilter]);

  const handleDelete = async (id: number) => {
    if (!confirm("Weet je zeker dat je deze projectbeoordeling wilt verwijderen?"))
      return;
    try {
      await projectAssessmentService.deleteProjectAssessment(id);
      const courseId = courseFilter === "all" ? undefined : Number(courseFilter);
      const status = statusFilter === "all" ? undefined : statusFilter;
      fetchList(courseId, status);
    } catch (e: any) {
      if (e instanceof ApiAuthError) {
        alert(e.originalMessage);
      } else {
        alert(e?.response?.data?.detail || e?.message || "Verwijderen mislukt");
      }
    }
  };

  // Group assessments by course
  const groupedByCourse: Record<string, ProjectAssessmentListItem[]> = {};
  data.forEach((item) => {
    const courseKey = item.course_name || "Geen vak";
    if (!groupedByCourse[courseKey]) {
      groupedByCourse[courseKey] = [];
    }
    groupedByCourse[courseKey].push(item);
  });

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">Projectbeoordeling</h1>
            <p className="text-gray-600 mt-1 text-sm">
              Beheer projectbeoordelingen per team met vaste criteria.
            </p>
          </div>
          <Link
            href="/teacher/project-assessments/create"
            className="mt-4 md:mt-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + Nieuwe projectbeoordeling
          </Link>
        </header>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Filters */}
        <div className="flex items-center gap-6 bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Vak/Cluster:</label>
          <select
            className="border rounded-lg px-3 py-2"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
          >
            <option value="all">Alle vakken</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Status:</label>
          <select
            className="border rounded-lg px-3 py-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Alle</option>
            <option value="draft">Concept</option>
            <option value="published">Gepubliceerd</option>
          </select>
        </div>
        </div>

        {loading && (
        <div className="p-6">
          <Loading />
        </div>
      )}
      {error && !loading && (
        <div className="p-6">
          <ErrorMessage message={`Fout: ${error}`} />
        </div>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 text-gray-500">
            Geen projectbeoordelingen gevonden.
          </div>
        )}
      {!loading &&
        !error &&
        Object.keys(groupedByCourse).map((courseName) => (
          <section key={courseName} className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-700 px-2">
              {courseName}
            </h2>
            <div className="bg-white border rounded-2xl overflow-hidden">
              {groupedByCourse[courseName].map((item) => (
                <div
                  key={item.id}
                  className="border-b last:border-b-0 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/teacher/project-assessments/${item.id}/overview`}
                          className="text-lg font-medium hover:text-blue-600"
                        >
                          {item.title}
                        </Link>
                        {item.status === "published" ? (
                          <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs">
                            ✅ Gepubliceerd
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                            ⚠️ Concept
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-6 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Team:</span>{" "}
                          {item.group_name || "-"}
                        </div>
                        {item.version && (
                          <div>
                            <span className="font-medium">Versie:</span>{" "}
                            {item.version}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Rubric ingevuld:</span>{" "}
                          {item.scores_count}/{item.total_criteria} criteria
                        </div>
                        {item.updated_at && (
                          <div>
                            <span className="font-medium">Laatst bijgewerkt:</span>{" "}
                            {new Date(item.updated_at).toLocaleDateString("nl-NL")}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/teacher/project-assessments/${item.id}/overview`}
                        className="px-3 py-2 rounded-lg border hover:bg-gray-100 text-sm"
                      >
                        Overzicht
                      </Link>
                      <Link
                        href={`/teacher/project-assessments/${item.id}/edit`}
                        className="px-3 py-2 rounded-lg border hover:bg-gray-100 text-sm"
                      >
                        Rubric invullen
                      </Link>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="px-3 py-2 rounded-lg border hover:bg-red-50 hover:border-red-300 text-red-600 text-sm"
                      >
                        Verwijder
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
