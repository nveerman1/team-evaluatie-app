"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Subject } from "@/dtos/subject.dto";
import { subjectService } from "@/services/subject.service";

export default function SectionsManagement() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseCounts, setCourseCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await subjectService.listSubjects({
        per_page: 100,
        is_active: undefined, // Show all subjects
      });
      setSubjects(response.subjects);

      // Load course counts for each subject
      const counts: Record<number, number> = {};
      await Promise.all(
        response.subjects.map(async (subject) => {
          try {
            const courses = await subjectService.getSubjectCourses(subject.id);
            counts[subject.id] = courses.length;
          } catch (err) {
            console.error(`Failed to load courses for subject ${subject.id}:`, err);
            counts[subject.id] = 0;
          }
        })
      );
      setCourseCounts(counts);
    } catch (err) {
      console.error("Failed to load subjects:", err);
      setError("Kon secties niet laden");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
          <div className="rounded-lg bg-red-50 p-4 text-red-800">
            <p className="font-medium">Fout bij laden</p>
            <p className="text-sm">{error}</p>
            <button
              onClick={loadSubjects}
              className="mt-2 rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
            >
              Opnieuw proberen
            </button>
          </div>
        </div>
      )}

      {/* Subjects table */}
      {!loading && !error && (
        <>
          <div className="text-sm text-gray-600">
            {subjects.length} {subjects.length === 1 ? "sectie" : "secties"} gevonden
          </div>

          {subjects.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-8">
              <div className="rounded-lg bg-yellow-50 p-8 text-center">
                <p className="text-lg font-medium text-yellow-900">
                  Geen secties gevonden
                </p>
                <p className="mt-1 text-yellow-700">
                  Er zijn nog geen secties aangemaakt
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Naam
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
                        Kleur
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        # Courses
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
                    {subjects.map((subject) => (
                      <tr key={subject.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {subject.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                            {subject.code}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {subject.color ? (
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded border border-gray-300 shadow-sm"
                                style={{ backgroundColor: subject.color }}
                                title={subject.color}
                              />
                              <span className="text-xs text-gray-500">
                                {subject.color}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {courseCounts[subject.id] ?? (
                              <span className="text-gray-400">...</span>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {subject.is_active ? (
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
                            href={`/teacher/admin/subjects/${subject.id}`}
                            className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
