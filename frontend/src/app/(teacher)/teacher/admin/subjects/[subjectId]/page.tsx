"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Subject } from "@/dtos/subject.dto";
import { Course } from "@/dtos/course.dto";
import { subjectService } from "@/services/subject.service";

export default function SubjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const subjectId = parseInt(params.subjectId as string);

  const [subject, setSubject] = useState<Subject | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (subjectId) {
      loadSubjectData();
    }
  }, [subjectId]);

  const loadSubjectData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load subject and courses in parallel
      const [subjectData, coursesData] = await Promise.all([
        subjectService.getSubject(subjectId),
        subjectService.getSubjectCourses(subjectId, undefined),
      ]);

      setSubject(subjectData);
      setCourses(coursesData);
    } catch (err) {
      console.error("Failed to load subject data:", err);
      setError("Kon sectie gegevens niet laden");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
      </div>
    );
  }

  if (error || !subject) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
          <div className="rounded-lg bg-red-50 p-4 text-red-800">
            <p className="font-medium">Fout bij laden</p>
            <p className="text-sm">{error || "Sectie niet gevonden"}</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={loadSubjectData}
                className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
              >
                Opnieuw proberen
              </button>
              <Link
                href="/teacher/admin/subjects"
                className="rounded bg-gray-600 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
              >
                Terug naar overzicht
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Link
              href="/teacher/admin/subjects"
              className="hover:text-blue-600 transition-colors"
            >
              Secties
            </Link>
            <span>/</span>
            <span className="text-gray-900">{subject.name}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
            {subject.name}
          </h1>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Subject Info Card */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Sectie Informatie
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Naam
              </label>
              <p className="text-gray-900">{subject.name}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code
              </label>
              <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                {subject.code}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kleur
              </label>
              {subject.color ? (
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg border border-gray-300 shadow-sm"
                    style={{ backgroundColor: subject.color }}
                  />
                  <span className="text-sm text-gray-600 font-mono">
                    {subject.color}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-gray-500">Geen kleur ingesteld</span>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Icoon
              </label>
              <p className="text-gray-900">
                {subject.icon || (
                  <span className="text-gray-500">Geen icoon ingesteld</span>
                )}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              {subject.is_active ? (
                <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                  Actief
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800">
                  Inactief
                </span>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Aantal courses
              </label>
              <p className="text-gray-900 text-lg font-semibold">
                {courses.length}
              </p>
            </div>
          </div>
        </div>

        {/* Courses Table */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Gekoppelde Courses
            </h2>
          </div>

          {courses.length === 0 ? (
            <div className="p-8">
              <div className="rounded-lg bg-yellow-50 p-6 text-center">
                <p className="text-lg font-medium text-yellow-900">
                  Geen courses gekoppeld
                </p>
                <p className="mt-1 text-yellow-700 text-sm">
                  Er zijn nog geen courses gekoppeld aan deze sectie
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Course naam
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Code
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Niveau
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Jaar
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Acties
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {courses.map((course) => (
                    <tr key={course.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {course.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {course.code ? (
                          <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                            {course.code}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {course.level ? (
                          <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                            {course.level}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {course.year || <span className="text-gray-400">-</span>}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {course.is_active ? (
                          <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                            Actief
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                            Inactief
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/teacher/courses/${course.id}`}
                          className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Bekijken
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
