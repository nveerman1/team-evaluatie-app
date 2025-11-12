"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import { Course, TeacherCourse, TeacherCourseCreate, CourseUpdate } from "@/dtos/course.dto";
import { courseService } from "@/services/course.service";

export default function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const resolvedParams = use(params);
  const courseId = parseInt(resolvedParams.courseId);

  const [course, setCourse] = useState<Course | null>(null);
  const [teachers, setTeachers] = useState<TeacherCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "teachers">("details");

  useEffect(() => {
    loadCourse();
    loadTeachers();
  }, [courseId]);

  const loadCourse = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await courseService.getCourse(courseId);
      setCourse(data);
    } catch (err) {
      console.error("Failed to load course:", err);
      setError("Kon vak niet laden");
    } finally {
      setLoading(false);
    }
  };

  const loadTeachers = async () => {
    try {
      const data = await courseService.getCourseTeachers(courseId);
      setTeachers(data);
    } catch (err) {
      console.error("Failed to load teachers:", err);
    }
  };

  const handleRemoveTeacher = async (teacherId: number) => {
    if (!confirm("Weet je zeker dat je deze docent wilt verwijderen van dit vak?")) {
      return;
    }

    try {
      await courseService.removeTeacher(courseId, teacherId);
      await loadTeachers();
    } catch (err) {
      console.error("Failed to remove teacher:", err);
      alert("Kon docent niet verwijderen");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-lg bg-red-50 p-4 text-red-800">
            <p className="font-medium">Fout bij laden</p>
            <p className="text-sm">{error || "Vak niet gevonden"}</p>
            <a
              href="/teacher/courses"
              className="mt-2 inline-block rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
            >
              Terug naar overzicht
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <div className="mb-2">
            <a
              href="/teacher/courses"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              ← Terug naar overzicht
            </a>
          </div>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">
                  {course.name}
                </h1>
                {course.code && (
                  <span className="rounded bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                    {course.code}
                  </span>
                )}
                {course.level && (
                  <span className="rounded bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                    {course.level}
                  </span>
                )}
              </div>
              {course.description && (
                <p className="mt-2 text-gray-600">{course.description}</p>
              )}
              <div className="mt-2 flex gap-4 text-sm text-gray-500">
                {course.period && <span>📅 {course.period}</span>}
                {course.year && <span>📚 {course.year}</span>}
              </div>
            </div>
            <button
              onClick={() => setShowEditForm(true)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Bewerken
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("details")}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
                activeTab === "details"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab("teachers")}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
                activeTab === "teachers"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Docenten ({teachers.length})
            </button>
          </nav>
        </div>

        {/* Tab content */}
        {activeTab === "details" && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Vak informatie
            </h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Naam</dt>
                <dd className="mt-1 text-sm text-gray-900">{course.name}</dd>
              </div>
              {course.code && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Code</dt>
                  <dd className="mt-1 text-sm text-gray-900">{course.code}</dd>
                </div>
              )}
              {course.period && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Periode</dt>
                  <dd className="mt-1 text-sm text-gray-900">{course.period}</dd>
                </div>
              )}
              {course.level && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Niveau</dt>
                  <dd className="mt-1 text-sm text-gray-900">{course.level}</dd>
                </div>
              )}
              {course.year && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Jaar</dt>
                  <dd className="mt-1 text-sm text-gray-900">{course.year}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {course.is_active ? (
                    <span className="text-green-600">✓ Actief</span>
                  ) : (
                    <span className="text-red-600">✗ Inactief</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Aangemaakt</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(course.created_at).toLocaleDateString("nl-NL")}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Laatst bijgewerkt
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(course.updated_at).toLocaleDateString("nl-NL")}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {activeTab === "teachers" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Toegewezen docenten
              </h2>
              <button
                onClick={() => {
                  /* TODO: Open assign teacher modal */
                  alert("Docent toewijzen - nog niet geïmplementeerd");
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Docent toewijzen
              </button>
            </div>

            {teachers.length === 0 ? (
              <div className="rounded-lg bg-yellow-50 p-6 text-center">
                <p className="text-lg font-medium text-yellow-900">
                  Geen docenten toegewezen
                </p>
                <p className="mt-1 text-yellow-700">
                  Wijs docenten toe aan dit vak om te beginnen
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {teachers.map((teacherCourse) => (
                  <div
                    key={teacherCourse.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">
                          {teacherCourse.teacher_name || `Teacher ${teacherCourse.teacher_id}`}
                        </h3>
                        <span
                          className={`rounded px-2 py-1 text-xs font-medium ${
                            teacherCourse.role === "coordinator"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {teacherCourse.role === "coordinator"
                            ? "Coördinator"
                            : "Docent"}
                        </span>
                        {!teacherCourse.is_active && (
                          <span className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                            Inactief
                          </span>
                        )}
                      </div>
                      {teacherCourse.teacher_email && (
                        <p className="mt-1 text-sm text-gray-500">
                          {teacherCourse.teacher_email}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveTeacher(teacherCourse.teacher_id)}
                      className="rounded-lg border border-red-300 bg-white px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Verwijderen
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Edit form modal */}
        {showEditForm && (
          <EditCourseModal
            course={course}
            onClose={() => setShowEditForm(false)}
            onSuccess={() => {
              setShowEditForm(false);
              loadCourse();
            }}
          />
        )}
      </div>
    </div>
  );
}

// Edit Course Modal Component
function EditCourseModal({
  course,
  onClose,
  onSuccess,
}: {
  course: Course;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState<CourseUpdate>({
    name: course.name,
    code: course.code || "",
    period: course.period || "",
    level: course.level || "",
    year: course.year,
    description: course.description || "",
    is_active: course.is_active,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await courseService.updateCourse(course.id, {
        ...formData,
        code: formData.code || undefined,
        period: formData.period || undefined,
        level: formData.level || undefined,
        description: formData.description || undefined,
      });
      onSuccess();
    } catch (err: any) {
      console.error("Failed to update course:", err);
      setError(
        err?.response?.data?.detail ||
          "Kon vak niet bijwerken. Probeer het opnieuw."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-2xl font-bold text-gray-900">Vak bewerken</h2>

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
                value={formData.year || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    year: e.target.value ? parseInt(e.target.value) : undefined,
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
            />
          </div>

          <div className="flex items-center">
            <input
              id="is_active"
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) =>
                setFormData({ ...formData, is_active: e.target.checked })
              }
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label
              htmlFor="is_active"
              className="ml-2 block text-sm text-gray-900"
            >
              Vak is actief
            </label>
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
              {submitting ? "Opslaan..." : "Opslaan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
