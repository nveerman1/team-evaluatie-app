"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import {
  teacherService,
  Teacher,
  TeacherCreate,
  TeacherUpdate,
} from "@/services/teacher.service";
import TeacherFormModal from "@/components/teacher/TeacherFormModal";
import SubjectAssignmentModal from "@/components/teacher/SubjectAssignmentModal";
import CSVImportModal from "@/components/teacher/CSVImportModal";

const TeachersManagement = forwardRef((props, ref) => {
  // State
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTeachers, setTotalTeachers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [teacherToEdit, setTeacherToEdit] = useState<Teacher | null>(null);

  // Debounce search to avoid too many API calls
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Load teachers
  useEffect(() => {
    loadTeachers();
  }, [debouncedSearch, roleFilter, statusFilter, currentPage]);

  const loadTeachers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await teacherService.listTeachers({
        page: currentPage,
        per_page: 20,
        search: debouncedSearch || undefined,
        role: roleFilter ? (roleFilter as "teacher" | "admin") : undefined,
        status: statusFilter
          ? (statusFilter as "active" | "inactive")
          : undefined,
        sort: "name",
        direction: "asc",
      });
      setTeachers(response.teachers);
      setTotalTeachers(response.total);

      // Auto-select first teacher if none selected
      if (!selectedId && response.teachers.length > 0) {
        setSelectedId(response.teachers[0].id);
      }
    } catch (err) {
      setError("Kon docenten niet laden");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedTeacher = teachers.find((t) => t.id === selectedId);

  // Stats
  const activeTeachers = teachers.filter((t) => !t.archived).length;
  const adminTeachers = teachers.filter((t) => t.role === "admin").length;

  // Handlers
  const handleCreateTeacher = async (data: TeacherCreate | TeacherUpdate) => {
    await teacherService.createTeacher(data as TeacherCreate);
    await loadTeachers();
    setShowCreateModal(false);
  };

  const handleUpdateTeacher = async (data: TeacherUpdate) => {
    if (teacherToEdit) {
      await teacherService.updateTeacher(teacherToEdit.id, data);
      await loadTeachers();
      setShowEditModal(false);
      setTeacherToEdit(null);
    }
  };

  const handleToggleStatus = async (teacher: Teacher) => {
    try {
      await teacherService.toggleTeacherStatus(teacher.id, !teacher.archived);
      await loadTeachers();
    } catch (err) {
      console.error("Failed to toggle status", err);
    }
  };

  const handleOpenEdit = (teacher: Teacher) => {
    setTeacherToEdit(teacher);
    setShowEditModal(true);
  };

  const handleOpenSubjects = (teacher: Teacher) => {
    setSelectedId(teacher.id);
    setShowSubjectModal(true);
  };

  const handleAssignCourse = async (courseId: number) => {
    if (selectedTeacher) {
      await teacherService.assignCourse(selectedTeacher.id, {
        course_id: courseId,
      });
      await loadTeachers();
    }
  };

  const handleRemoveCourse = async (courseId: number) => {
    if (selectedTeacher) {
      await teacherService.removeCourse(selectedTeacher.id, courseId);
      await loadTeachers();
    }
  };

  const handleImportCSV = async (file: File) => {
    return await teacherService.importCSV(file);
  };

  const handleExportCSV = async () => {
    try {
      const blob = await teacherService.exportCSV({
        status: statusFilter
          ? (statusFilter as "active" | "inactive")
          : undefined,
      });
      teacherService.downloadCSV(blob);
    } catch (err) {
      console.error("Failed to export CSV", err);
    }
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    handleCreate: () => setShowCreateModal(true),
    handleExportCSV: handleExportCSV,
    handleImportCSV: () => setShowImportModal(true),
  }));

  const totalPages = Math.ceil(totalTeachers / 20);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      {/* Modals */}
      <TeacherFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateTeacher}
        mode="create"
      />
      <TeacherFormModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setTeacherToEdit(null);
        }}
        onSubmit={handleUpdateTeacher}
        teacher={teacherToEdit}
        mode="edit"
      />
      <SubjectAssignmentModal
        isOpen={showSubjectModal}
        onClose={() => setShowSubjectModal(false)}
        teacher={selectedTeacher || null}
        onAssign={handleAssignCourse}
        onRemove={handleRemoveCourse}
      />
      <CSVImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportCSV}
        onSuccess={loadTeachers}
      />

      <div className="space-y-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Left Column */}
          <div className="flex-1 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
                <p className="text-sm font-medium text-gray-600">
                  Totaal docenten
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {totalTeachers}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
                <p className="text-sm font-medium text-gray-600">Actief</p>
                <p className="mt-1 text-2xl font-bold text-green-600">
                  {activeTeachers}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
                <p className="text-sm font-medium text-gray-600">Admins</p>
                <p className="mt-1 text-2xl font-bold text-purple-600">
                  {adminTeachers}
                </p>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-gray-400">🔍</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Zoek op naam of e-mail…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Alle rollen</option>
                  <option value="teacher">Docent</option>
                  <option value="admin">Admin</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Alle statussen</option>
                  <option value="active">Actief</option>
                  <option value="inactive">Inactief</option>
                </select>
              </div>
            </div>

            {/* Teacher List */}
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm">
              <div className="border-b border-gray-200 px-4 py-3">
                <p className="text-sm font-medium text-gray-700">
                  {totalTeachers} docenten gevonden
                </p>
              </div>
              <ul className="divide-y divide-gray-200">
                {error ? (
                  <li className="px-4 py-8 text-center text-sm text-red-600">
                    {error}
                  </li>
                ) : teachers.length === 0 ? (
                  <li className="px-4 py-8 text-center text-sm text-gray-500">
                    Geen docenten gevonden met de huidige filters.
                  </li>
                ) : (
                  teachers.map((teacher) => (
                    <li
                      key={teacher.id}
                      onClick={() => setSelectedId(teacher.id)}
                      className={`cursor-pointer px-4 py-4 transition-colors ${
                        selectedId === teacher.id
                          ? "bg-blue-50"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">
                            {teacher.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {teacher.email}
                          </p>
                        </div>
                        <div className="ml-4 flex items-center gap-2">
                          {teacher.role === "admin" ? (
                            <span className="inline-flex rounded-full border border-purple-100 bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                              Admin
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                              Docent
                            </span>
                          )}
                          {!teacher.archived ? (
                            <span className="inline-flex rounded-full border border-green-100 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                              Actief
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                              Inactief
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(teacher);
                            }}
                            className="ml-2 rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Bewerken
                          </button>
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Volgende
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Detail Sidebar */}
          <div className="lg:w-80">
            <div className="sticky top-6 bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Docentdetails
              </h2>

              {selectedTeacher ? (
                <div className="space-y-6">
                  {/* Teacher Info */}
                  <div>
                    <p className="text-base font-semibold text-gray-900">
                      {selectedTeacher.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {selectedTeacher.email}
                    </p>
                    <div className="mt-2 flex gap-2">
                      {selectedTeacher.role === "admin" ? (
                        <span className="inline-flex rounded-full border border-purple-100 bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                          Admin
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          Docent
                        </span>
                      )}
                      {!selectedTeacher.archived ? (
                        <span className="inline-flex rounded-full border border-green-100 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          Actief
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                          Inactief
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <dl className="space-y-3 border-t border-gray-200 pt-4">
                    {selectedTeacher.created_at && (
                      <div>
                        <dt className="text-xs font-medium text-gray-500">
                          Aangemaakt
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {new Date(
                            selectedTeacher.created_at
                          ).toLocaleDateString("nl-NL")}
                        </dd>
                      </div>
                    )}
                    {selectedTeacher.last_login && (
                      <div>
                        <dt className="text-xs font-medium text-gray-500">
                          Laatst ingelogd
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {new Date(
                            selectedTeacher.last_login
                          ).toLocaleDateString("nl-NL")}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-xs font-medium text-gray-500">
                        Vak-koppelingen
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {selectedTeacher.courses.length}
                      </dd>
                    </div>
                  </dl>

                  {/* Subjects Section */}
                  <div className="border-t border-gray-200 pt-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">
                        Gekoppelde vakken
                      </h3>
                      <button
                        onClick={() => handleOpenSubjects(selectedTeacher)}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        Beheer koppelingen
                      </button>
                    </div>

                    {selectedTeacher.courses.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        Nog geen vakken gekoppeld. Gebruik &apos;Beheer
                        koppelingen&apos; om vakken toe te wijzen.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedTeacher.courses.map((course) => (
                          <div
                            key={course.id}
                            className="rounded-md border border-gray-200 bg-gray-50 p-3"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {course.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {course.code && `${course.code} · `}
                                  {course.year && `${course.year} · `}
                                  {course.level}
                                </p>
                              </div>
                              <button
                                onClick={async () => {
                                  if (
                                    confirm(
                                      `Vak "${course.name}" verwijderen van ${selectedTeacher.name}?`
                                    )
                                  ) {
                                    await handleRemoveCourse(course.id);
                                  }
                                }}
                                className="ml-2 text-xs font-medium text-red-600 hover:text-red-700"
                              >
                                Verwijder
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 border-t border-gray-200 pt-4">
                    <button
                      onClick={() => handleOpenEdit(selectedTeacher)}
                      className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Bewerk docent
                    </button>
                    <button
                      onClick={() => handleToggleStatus(selectedTeacher)}
                      className="w-full rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      {!selectedTeacher.archived ? "Deactiveer" : "Activeer"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Kies een docent in de lijst om details te bekijken.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

TeachersManagement.displayName = "TeachersManagement";

export default TeachersManagement;
