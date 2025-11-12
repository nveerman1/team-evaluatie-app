"use client";

import { useState, useEffect } from "react";
import { Course, CourseCreate } from "@/dtos/course.dto";
import { courseService } from "@/services/course.service";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevel, setFilterLevel] = useState<string>("");
  const [filterYear, setFilterYear] = useState<number | undefined>();

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCourses, setTotalCourses] = useState(0);

  useEffect(() => {
    loadCourses();
  }, [currentPage, searchTerm, filterLevel, filterYear]);

  const loadCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await courseService.listCourses({
        page: currentPage,
        per_page: 20,
        search: searchTerm || undefined,
        level: filterLevel || undefined,
        year: filterYear,
        is_active: true,
      });
      setCourses(response.courses);
      setTotalCourses(response.total);
      setTotalPages(Math.ceil(response.total / response.per_page));
    } catch (err) {
      console.error("Failed to load courses:", err);
      setError("Kon vakken niet laden");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = () => {
    setShowCreateForm(true);
  };

  const handleDeleteCourse = async (courseId: number) => {
    if (
      !confirm(
        "Weet je zeker dat je dit vak wilt verwijderen? Dit is een soft delete en kan ongedaan gemaakt worden."
      )
    ) {
      return;
    }

    try {
      await courseService.deleteCourse(courseId);
      await loadCourses();
    } catch (err) {
      console.error("Failed to delete course:", err);
      alert("Kon vak niet verwijderen");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Vakken beheren</h1>
            <p className="mt-1 text-gray-600">
              Beheer alle vakken en docenten voor jouw school
            </p>
          </div>
          <button
            onClick={handleCreateCourse}
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            + Nieuw vak
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-lg bg-white p-4 shadow">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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
                placeholder="Zoek op naam, code..."
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="level"
                className="block text-sm font-medium text-gray-700"
              >
                Niveau
              </label>
              <select
                id="level"
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Alle niveaus</option>
                <option value="onderbouw">Onderbouw</option>
                <option value="bovenbouw">Bovenbouw</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="year"
                className="block text-sm font-medium text-gray-700"
              >
                Jaar
              </label>
              <input
                id="year"
                type="number"
                value={filterYear || ""}
                onChange={(e) =>
                  setFilterYear(e.target.value ? parseInt(e.target.value) : undefined)
                }
                placeholder="2024"
                min="2020"
                max="2100"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilterLevel("");
                  setFilterYear(undefined);
                  setCurrentPage(1);
                }}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Reset filters
              </button>
            </div>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          </div>
        )}

        {/* Error state */}
        {error && (
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
        )}

        {/* Courses list */}
        {!loading && !error && (
          <>
            <div className="mb-4 text-sm text-gray-600">
              {totalCourses} {totalCourses === 1 ? "vak" : "vakken"} gevonden
            </div>

            {courses.length === 0 ? (
              <div className="rounded-lg bg-yellow-50 p-8 text-center">
                <p className="text-lg font-medium text-yellow-900">
                  Geen vakken gevonden
                </p>
                <p className="mt-1 text-yellow-700">
                  {searchTerm || filterLevel || filterYear
                    ? "Probeer andere filters"
                    : "Maak je eerste vak aan om te beginnen"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {courses.map((course) => (
                  <div
                    key={course.id}
                    className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-semibold text-gray-900">
                            {course.name}
                          </h3>
                          {course.code && (
                            <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                              {course.code}
                            </span>
                          )}
                          {course.level && (
                            <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                              {course.level}
                            </span>
                          )}
                        </div>

                        {course.description && (
                          <p className="mt-2 text-gray-600">
                            {course.description}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500">
                          {course.period && (
                            <span>📅 Periode: {course.period}</span>
                          )}
                          {course.year && <span>📚 Jaar: {course.year}</span>}
                          <span>
                            🆔 ID: {course.id}
                          </span>
                        </div>
                      </div>

                      <div className="ml-4 flex gap-2">
                        <a
                          href={`/teacher/admin/courses/${course.id}/teams`}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                          Beheren
                        </a>
                        <a
                          href={`/teacher/courses/${course.id}`}
                          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          Bekijken
                        </a>
                        <button
                          onClick={() => handleDeleteCourse(course.id)}
                          className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                        >
                          Verwijderen
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Vorige
                </button>

                <span className="text-sm text-gray-700">
                  Pagina {currentPage} van {totalPages}
                </span>

                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Volgende
                </button>
              </div>
            )}
          </>
        )}

        {/* Create form modal */}
        {showCreateForm && (
          <CreateCourseModal
            onClose={() => setShowCreateForm(false)}
            onSuccess={() => {
              setShowCreateForm(false);
              loadCourses();
            }}
          />
        )}
      </div>
    </div>
  );
}

// Create Course Modal Component
function CreateCourseModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState<CourseCreate>({
    name: "",
    code: "",
    period: "",
    level: "",
    year: new Date().getFullYear(),
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await courseService.createCourse({
        ...formData,
        code: formData.code || undefined,
        period: formData.period || undefined,
        level: formData.level || undefined,
        description: formData.description || undefined,
      });
      onSuccess();
    } catch (err: any) {
      console.error("Failed to create course:", err);
      setError(
        err?.response?.data?.detail ||
          "Kon vak niet aanmaken. Probeer het opnieuw."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-2xl font-bold text-gray-900">
          Nieuw vak aanmaken
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Naam van het vak *
            </label>
            <input
              id="name"
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="bijv. Onderzoek & Ontwerpen"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="code"
                className="block text-sm font-medium text-gray-700"
              >
                Vakcode
              </label>
              <input
                id="code"
                type="text"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="bijv. O&O"
              />
            </div>

            <div>
              <label
                htmlFor="period"
                className="block text-sm font-medium text-gray-700"
              >
                Periode
              </label>
              <input
                id="period"
                type="text"
                value={formData.period}
                onChange={(e) =>
                  setFormData({ ...formData, period: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="bijv. Q1, Semester 1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="level"
                className="block text-sm font-medium text-gray-700"
              >
                Niveau
              </label>
              <select
                id="level"
                value={formData.level}
                onChange={(e) =>
                  setFormData({ ...formData, level: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Selecteer niveau --</option>
                <option value="onderbouw">Onderbouw</option>
                <option value="bovenbouw">Bovenbouw</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="year"
                className="block text-sm font-medium text-gray-700"
              >
                Jaar
              </label>
              <input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    year: parseInt(e.target.value) || undefined,
                  })
                }
                min="2020"
                max="2100"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700"
            >
              Beschrijving
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Korte beschrijving van het vak"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
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
              disabled={submitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Aanmaken..." : "Vak aanmaken"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
