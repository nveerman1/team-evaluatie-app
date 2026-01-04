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
import BulkLinkStudentsToCourseModal from "@/components/admin/BulkLinkStudentsToCourseModal";
import StudentCSVImportModal from "@/components/admin/StudentCSVImportModal";
import { Link2, Power, PowerOff } from "lucide-react";

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
  
  // Bulk selection states
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());
  const [showBulkLinkModal, setShowBulkLinkModal] = useState(false);

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
      
      console.log('Loading students with params:', params);
      const response = await adminStudentService.listStudents(params);
      console.log('Received', response.students.length, 'students from API');
      
      let filteredStudents = response.students;
      
      // Apply "only unlinked" filter on frontend if needed
      if (onlyUnlinked) {
        filteredStudents = filteredStudents.filter(s => 
          !s.course_name && (!s.course_enrollments || s.course_enrollments.length === 0)
        );
        console.log('After onlyUnlinked filter:', filteredStudents.length, 'students');
      }
      
      // Log first few students for debugging
      if (filteredStudents.length > 0) {
        console.log('Sample student data:', filteredStudents.slice(0, 2).map(s => ({
          id: s.id,
          name: s.name,
          course_name: s.course_name,
          course_enrollments: s.course_enrollments
        })));
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
      const updatedStudent = await adminStudentService.updateStudent(selectedStudent.id, {
        course_name: courseName,
      });
      
      // Update the selected student with the fresh data from the server
      setSelectedStudent(updatedStudent);
      
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

  // Bulk selection handlers
  const handleToggleSelectAll = () => {
    if (selectedStudentIds.size === students.length && students.length > 0) {
      // Deselect all
      setSelectedStudentIds(new Set());
    } else {
      // Select all on current page
      setSelectedStudentIds(new Set(students.map(s => s.id)));
    }
  };

  const handleToggleSelectStudent = (studentId: number) => {
    const newSelected = new Set(selectedStudentIds);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudentIds(newSelected);
  };

  const handleBulkLink = () => {
    if (selectedStudentIds.size === 0) return;
    setShowBulkLinkModal(true);
  };

  const handleBulkLinkToCourse = async (courseName: string) => {
    const idsToLink = Array.from(selectedStudentIds);
    
    console.log('Starting bulk link for', idsToLink.length, 'students to course:', courseName);
    
    // Link all students concurrently for better performance
    const results = await Promise.allSettled(
      idsToLink.map(id =>
        adminStudentService.updateStudent(id, {
          course_name: courseName,
        })
      )
    );
    
    // Count successes and failures
    const failures = results.filter(r => r.status === 'rejected');
    const successes = results.filter(r => r.status === 'fulfilled');
    
    console.log('Bulk link completed:', successes.length, 'successes,', failures.length, 'failures');
    
    // Wait a bit to ensure backend DB changes are committed
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Clear selection and reload
    setSelectedStudentIds(new Set());
    console.log('Reloading students data...');
    await Promise.all([loadStudents(), loadKPIData()]);
    console.log('Students data reloaded');
    
    if (failures.length > 0) {
      throw new Error(`Kon ${failures.length} van ${idsToLink.length} student(en) niet koppelen`);
    }
  };

  // Clear selection when page changes
  useEffect(() => {
    setSelectedStudentIds(new Set());
  }, [currentPage, debouncedSearch, statusFilter, courseFilter, onlyUnlinked]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    handleExportCSV: handleExportCSV,
    handleImportCSV: () => setShowImportModal(true),
  }));

  // Calculate KPIs from all students data
  const totalCount = totalStudents;
  const unlinkedCount = allStudentsForKPIs.filter(s => 
    s.has_logged_in && !s.course_name && (!s.course_enrollments || s.course_enrollments.length === 0)
  ).length;
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
    if (!student.course_name && (!student.course_enrollments || student.course_enrollments.length === 0)) {
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
            {/* Bulk actions bar */}
            {selectedStudentIds.size > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-blue-900">
                      {selectedStudentIds.size} {selectedStudentIds.size === 1 ? "leerling" : "leerlingen"} geselecteerd
                    </span>
                    <button
                      onClick={() => setSelectedStudentIds(new Set())}
                      className="text-sm text-blue-700 hover:text-blue-900 underline"
                    >
                      Deselecteren
                    </button>
                  </div>
                  <button
                    onClick={handleBulkLink}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                  >
                    Koppel geselecteerde leerlingen
                  </button>
                </div>
              </div>
            )}

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
                        <th className="w-10 px-3 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={selectedStudentIds.size === students.length && students.length > 0}
                            ref={(el) => {
                              if (el) {
                                el.indeterminate = selectedStudentIds.size > 0 && selectedStudentIds.size < students.length;
                              }
                            }}
                            onChange={handleToggleSelectAll}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Naam
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Klas
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Koppelingen
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="w-20 px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acties
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {students.map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50">
                          <td className="w-10 px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selectedStudentIds.has(student.id)}
                              onChange={() => handleToggleSelectStudent(student.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]" title={student.name}>
                              {student.name}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="text-sm text-gray-900 truncate max-w-[180px]" title={student.email}>
                              {student.email}
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {student.class_info || student.class_name || "—"}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {student.course_enrollments && student.course_enrollments.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {student.course_enrollments.map((enrollment: any, idx: number) => (
                                  <span 
                                    key={idx}
                                    className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700"
                                  >
                                    {enrollment.subject_code ? `${enrollment.subject_code} · ` : ''}{enrollment.course_name}
                                  </span>
                                ))}
                              </div>
                            ) : student.course_name ? (
                              <div className="flex flex-wrap gap-1">
                                <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                                  {student.course_name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            {getStatusBadge(student)}
                          </td>
                          <td className="w-20 px-3 py-3">
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => handleLinkStudent(student)}
                                className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
                                title="Koppelen"
                              >
                                <Link2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleToggleStatus(student)}
                                className={`p-1.5 rounded transition-colors ${
                                  student.status === "active" 
                                    ? "text-gray-600 hover:text-gray-900 hover:bg-gray-100" 
                                    : "text-green-600 hover:text-green-900 hover:bg-green-50"
                                }`}
                                title={student.status === "active" ? "Deactiveren" : "Activeren"}
                              >
                                {student.status === "active" ? (
                                  <PowerOff className="h-4 w-4" />
                                ) : (
                                  <Power className="h-4 w-4" />
                                )}
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

      {/* Bulk link modal */}
      <BulkLinkStudentsToCourseModal
        isOpen={showBulkLinkModal}
        onClose={() => setShowBulkLinkModal(false)}
        studentCount={selectedStudentIds.size}
        onLink={handleBulkLinkToCourse}
      />

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
