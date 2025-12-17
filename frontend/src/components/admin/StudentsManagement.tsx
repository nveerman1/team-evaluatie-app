"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import {
  adminStudentService,
  AdminStudent,
} from "@/services/admin-students.service";
import { Course } from "@/dtos/course.dto";
import { courseService } from "@/services/course.service";
import LinkStudentToCourseModal from "@/components/admin/LinkStudentToCourseModal";
import StudentCSVImportModal from "@/components/admin/StudentCSVImportModal";

const StudentsManagement = forwardRef((props, ref) => {
  // State
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [allStudentsForKPIs, setAllStudentsForKPIs] = useState<AdminStudent[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [courseFilter, setCourseFilter] = useState<string>("");
  const [onlyUnlinked, setOnlyUnlinked] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<AdminStudent | null>(null);

  // Debounce search to avoid too many API calls
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Load courses for filter dropdown
  useEffect(() => {
    loadCourses();
  }, []);

  // Load students when filters change
  useEffect(() => {
    loadStudents();
    loadKPIData();
  }, [debouncedSearch, statusFilter, courseFilter, onlyUnlinked, currentPage]);

  const loadCourses = async () => {
    try {
      const response = await courseService.listCourses({
        page: 1,
        per_page: 100,
        is_active: true,
      });
      setCourses(response.courses);
    } catch (err) {
      console.error("Failed to load courses:", err);
    }
  };

  const loadKPIData = async () => {
    // Load all students (not just active) for KPI calculation
    // Note: backend limit is max 200, so we need to fetch in batches or increase limit
    try {
      const response = await adminStudentService.listStudents({
        page: 1,
        limit: 200, // Backend max is 200
      });
      setAllStudentsForKPIs(response.students);
    } catch (err) {
      console.error("Failed to load KPI data:", err);
    }
  };

  const loadStudents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Build filter params - only include defined values
      const params: any = {
        page: currentPage,
        limit: 25,
        sort: "name",
        dir: "asc",
      };
      
      // Only add optional filters if they have values
      if (debouncedSearch) {
        params.q = debouncedSearch;
      }
      
      if (statusFilter && statusFilter !== "all") {
        params.status_filter = statusFilter;
      }
      
      // If "only unlinked" is checked, we filter on frontend
      // Otherwise, add course filter if specified
      if (!onlyUnlinked && courseFilter) {
        params.course = courseFilter;
      }
      
      const response = await adminStudentService.listStudents(params);
      
      let filteredStudents = response.students;
      
      // Apply "only unlinked" filter on frontend if needed
      if (onlyUnlinked) {
        filteredStudents = filteredStudents.filter(s => !s.course_name);
      }
      
      setStudents(filteredStudents);
      setTotalStudents(response.total);
    } catch (err) {
      setError("Kon leerlingen niet laden");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkStudent = (student: AdminStudent) => {
    setSelectedStudent(student);
    setShowLinkModal(true);
  };

  const handleLinkToCourse = async (courseName: string) => {
    if (!selectedStudent) return;
    
    try {
      await adminStudentService.updateStudent(selectedStudent.id, {
        course_name: courseName,
      });
      
      // Reload both students and KPI data
      await Promise.all([loadStudents(), loadKPIData()]);
    } catch (err) {
      console.error("Failed to link student to course:", err);
      throw err; // Re-throw so modal can handle it
    }
  };

  const handleToggleStatus = async (student: AdminStudent) => {
    try {
      const newStatus = student.status === "active" ? "inactive" : "active";
      await adminStudentService.updateStudent(student.id, {
        status: newStatus,
      });
      await loadStudents();
    } catch (err) {
      console.error("Failed to toggle status:", err);
    }
  };

  const handleExportCSV = async () => {
    try {
      const params: any = {};
      
      if (debouncedSearch) {
        params.q = debouncedSearch;
      }
      
      if (statusFilter && statusFilter !== "all") {
        params.status_filter = statusFilter;
      }
      
      if (courseFilter) {
        params.course = courseFilter;
      }
      
      const blob = await adminStudentService.exportCSV(params);
      adminStudentService.downloadCSV(blob);
    } catch (err) {
      console.error("Failed to export CSV:", err);
    }
  };

  const handleImportCSV = async (file: File) => {
    return await adminStudentService.importCSV(file);
  };

  const handleImportSuccess = async () => {
    await loadStudents();
    await loadKPIData();
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    handleExportCSV: handleExportCSV,
    handleImportCSV: () => setShowImportModal(true),
  }));

  // Calculate KPIs from all students data
  const totalCount = totalStudents;
  const unlinkedCount = allStudentsForKPIs.filter(s => s.has_logged_in && !s.course_name).length;
  const notLoggedInCount = allStudentsForKPIs.filter(s => !s.has_logged_in).length;

  const totalPages = Math.ceil(totalStudents / 25);

  // Helper function to get status badge
  const getStatusBadge = (student: AdminStudent) => {
    // 🔴 Inactief - manually deactivated
    if (student.status === "inactive") {
      return (
        <span className="inline-flex rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
          Inactief
        </span>
      );
    }
    
    // ⚪ Nog niet ingelogd - imported but not logged in yet
    if (!student.has_logged_in) {
      return (
        <span className="inline-flex rounded-full border border-blue-200 bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          Nog niet ingelogd
        </span>
      );
    }
    
    // 🟠 Ongekoppeld - logged in but no course
    if (!student.course_name) {
      return (
        <span className="inline-flex rounded-full border border-yellow-200 bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
          Ongekoppeld
        </span>
      );
    }
    
    // 🟢 Actief - logged in and has course
    return (
      <span className="inline-flex rounded-full border border-green-100 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
        Actief
      </span>
    );
  };

  return (
    <>
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
            <p className="text-sm font-medium text-gray-600">
              Totaal leerlingen
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {totalCount}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
            <p className="text-sm font-medium text-gray-600">Ongekoppeld</p>
            <p className="mt-1 text-2xl font-bold text-yellow-600">
              {unlinkedCount}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
            <p className="text-sm font-medium text-gray-600">Nog niet ingelogd</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">
              {notLoggedInCount}
            </p>
          </div>
        </div>

        {/* Banner for unlinked students */}
        {unlinkedCount > 0 && !onlyUnlinked && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-sm font-medium text-yellow-900">
                    {unlinkedCount} {unlinkedCount === 1 ? "leerling is" : "leerlingen zijn"} ingelogd maar nog niet gekoppeld aan een vak/klas.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOnlyUnlinked(true)}
                className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yellow-700"
              >
                Toon ongekoppeld
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700">
                Zoeken
              </label>
              <input
                id="search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Naam, email..."
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                id="status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">Alle statussen</option>
                <option value="active">Actief</option>
                <option value="inactive">Inactief</option>
              </select>
            </div>

            <div>
              <label htmlFor="course" className="block text-sm font-medium text-gray-700">
                Vak
              </label>
              <select
                id="course"
                value={courseFilter}
                onChange={(e) => {
                  setCourseFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Alle vakken</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.name}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyUnlinked}
                  onChange={(e) => {
                    setOnlyUnlinked(e.target.checked);
                    setCurrentPage(1);
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Alleen ongekoppeld
                </span>
              </label>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("active");
                  setCourseFilter("");
                  setOnlyUnlinked(false);
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
        {isLoading && (
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
                onClick={loadStudents}
                className="mt-2 rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
              >
                Opnieuw proberen
              </button>
            </div>
          </div>
        )}

        {/* Students table */}
        {!isLoading && !error && (
          <>
            <div className="text-sm text-gray-600">
              {totalStudents} {totalStudents === 1 ? "leerling" : "leerlingen"} gevonden
            </div>

            {students.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-8">
                <div className="rounded-lg bg-yellow-50 p-8 text-center">
                  <p className="text-lg font-medium text-yellow-900">
                    Geen leerlingen gevonden
                  </p>
                  <p className="mt-1 text-yellow-700">
                    Probeer andere filters
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Naam
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Klas
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Koppelingen
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Laatste login
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acties
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {students.map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {student.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{student.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {student.class_name || "—"}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {student.course_name ? (
                              <div className="flex flex-wrap gap-1">
                                <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                                  {student.course_name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(student)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">—</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handleLinkStudent(student)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                Koppelen
                              </button>
                              <button
                                onClick={() => handleToggleStatus(student)}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                {student.status === "active" ? "Deactiveren" : "Activeren"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Volgende
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Link modal */}
      {selectedStudent && (
        <LinkStudentToCourseModal
          isOpen={showLinkModal}
          onClose={() => {
            setShowLinkModal(false);
            setSelectedStudent(null);
          }}
          studentName={selectedStudent.name}
          currentCourseName={selectedStudent.course_name}
          onLink={handleLinkToCourse}
        />
      )}

      {/* Import CSV modal */}
      <StudentCSVImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportCSV}
        onSuccess={handleImportSuccess}
      />
    </>
  );
});

StudentsManagement.displayName = "StudentsManagement";

export default StudentsManagement;
