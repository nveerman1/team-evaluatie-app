"use client";

import { useState, useEffect } from "react";
import { GroupWithMembers, GroupCreate } from "@/dtos/group.dto";
import { groupService } from "@/services/group.service";
import { Course } from "@/dtos/course.dto";
import { courseService } from "@/services/course.service";
import CourseSelector from "@/components/CourseSelector";

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalGroups, setTotalGroups] = useState(0);

  useEffect(() => {
    if (selectedCourse) {
      loadGroups();
    }
  }, [currentPage, selectedCourse]);

  const loadGroups = async () => {
    if (!selectedCourse) return;

    try {
      setLoading(true);
      setError(null);
      const response = await groupService.listGroups({
        page: currentPage,
        per_page: 20,
        course_id: selectedCourse.id,
      });
      setGroups(response.groups);
      setTotalGroups(response.total);
      setTotalPages(Math.ceil(response.total / response.per_page));
    } catch (err) {
      console.error("Failed to load groups:", err);
      setError("Kon klassengroepen niet laden");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm("Weet je zeker dat je deze klassengroep wilt verwijderen?")) {
      return;
    }

    try {
      await groupService.deleteGroup(groupId);
      await loadGroups();
    } catch (err) {
      console.error("Failed to delete group:", err);
      alert("Kon klassengroep niet verwijderen");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Klassengroepen beheren
          </h1>
          <p className="mt-1 text-gray-600">
            Beheer teams en klassengroepen per vak
          </p>
        </div>

        {/* Course selector */}
        <div className="mb-6">
          <CourseSelector
            selectedCourseId={selectedCourse?.id}
            onCourseChange={setSelectedCourse}
          />
        </div>

        {!selectedCourse ? (
          <div className="rounded-lg bg-yellow-50 p-6 text-center">
            <p className="text-lg font-medium text-yellow-900">
              Selecteer een vak
            </p>
            <p className="mt-1 text-yellow-700">
              Kies eerst een vak om de klassengroepen te bekijken
            </p>
          </div>
        ) : (
          <>
            {/* Action buttons */}
            <div className="mb-6 flex justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  Vak: <span className="font-semibold">{selectedCourse.name}</span>
                </p>
              </div>
              <button
                onClick={() => setShowCreateForm(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
              >
                + Nieuwe klassengroep
              </button>
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
                  onClick={loadGroups}
                  className="mt-2 rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                >
                  Opnieuw proberen
                </button>
              </div>
            )}

            {/* Groups list */}
            {!loading && !error && (
              <>
                <div className="mb-4 text-sm text-gray-600">
                  {totalGroups} {totalGroups === 1 ? "groep" : "groepen"}{" "}
                  gevonden
                </div>

                {groups.length === 0 ? (
                  <div className="rounded-lg bg-yellow-50 p-8 text-center">
                    <p className="text-lg font-medium text-yellow-900">
                      Geen klassengroepen gevonden
                    </p>
                    <p className="mt-1 text-yellow-700">
                      Maak je eerste klassengroep aan om te beginnen
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {groups.map((group) => (
                      <div
                        key={group.id}
                        className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold text-gray-900">
                                {group.name}
                              </h3>
                              {group.team_number && (
                                <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                                  Team {group.team_number}
                                </span>
                              )}
                            </div>

                            <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                                  />
                                </svg>
                                {group.member_count || 0} leden
                              </span>
                              <span>ID: {group.id}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                          <a
                            href={`/teacher/groups/${group.id}`}
                            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Beheren
                          </a>
                          <button
                            onClick={() => handleDeleteGroup(group.id)}
                            className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            Verwijderen
                          </button>
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
            {showCreateForm && selectedCourse && (
              <CreateGroupModal
                courseId={selectedCourse.id}
                courseName={selectedCourse.name}
                onClose={() => setShowCreateForm(false)}
                onSuccess={() => {
                  setShowCreateForm(false);
                  loadGroups();
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Create Group Modal Component
function CreateGroupModal({
  courseId,
  courseName,
  onClose,
  onSuccess,
}: {
  courseId: number;
  courseName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState<GroupCreate>({
    course_id: courseId,
    name: "",
    team_number: undefined,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await groupService.createGroup(formData);
      onSuccess();
    } catch (err: any) {
      console.error("Failed to create group:", err);
      setError(
        err?.response?.data?.detail ||
          "Kon klassengroep niet aanmaken. Probeer het opnieuw."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-2xl font-bold text-gray-900">
          Nieuwe klassengroep
        </h2>

        <p className="mb-4 text-sm text-gray-600">
          Voor vak: <span className="font-semibold">{courseName}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Naam van de groep *
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
              placeholder="bijv. Team A, Klas 4A, Groep 1"
            />
          </div>

          <div>
            <label
              htmlFor="team_number"
              className="block text-sm font-medium text-gray-700"
            >
              Teamnummer (optioneel)
            </label>
            <input
              id="team_number"
              type="number"
              value={formData.team_number || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  team_number: e.target.value
                    ? parseInt(e.target.value)
                    : undefined,
                })
              }
              min="1"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="1, 2, 3..."
            />
            <p className="mt-1 text-xs text-gray-500">
              Gebruikt voor peer review allocaties
            </p>
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
              {submitting ? "Aanmaken..." : "Groep aanmaken"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
