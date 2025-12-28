"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { courseService } from "@/services/course.service";
import type { CourseLite, CourseStudent } from "@/dtos/course.dto";
import { ProjectResultsSection } from "./student-overview/ProjectResultsSection";
import { EvaluationHeatmapSection } from "./student-overview/OmzaHeatmapSection";
import { CompetencyProfileSection } from "./student-overview/CompetencyProfileSection";
import { LearningObjectivesSection } from "./student-overview/LearningObjectivesSection";
import { ReflectionsSection } from "./student-overview/ReflectionsSection";
import { FeedbackSidePanel } from "./student-overview/FeedbackSidePanel";

/* =========================================
   TYPES
   ========================================= */

interface StudentOverviewFilters {
  selectedCourseId: number | null;
  selectedStudentId: number | null;
}

/* =========================================
   MAIN COMPONENT
   ========================================= */

export default function StudentOverviewTab() {
  const [filters, setFilters] = useState<StudentOverviewFilters>({
    selectedCourseId: null,
    selectedStudentId: null,
  });
  
  const [courses, setCourses] = useState<CourseLite[]>([]);
  const [students, setStudents] = useState<CourseStudent[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedbackPanelOpen, setFeedbackPanelOpen] = useState(false);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<number | null>(null);

  // Fetch courses on mount
  useEffect(() => {
    async function fetchCourses() {
      try {
        setLoadingCourses(true);
        const coursesData = await courseService.getCourses();
        setCourses(coursesData);
      } catch (error) {
        console.error("Error fetching courses:", error);
      } finally {
        setLoadingCourses(false);
      }
    }
    fetchCourses();
  }, []);

  // Fetch students when course changes
  useEffect(() => {
    async function fetchStudents() {
      if (!filters.selectedCourseId) {
        setStudents([]);
        return;
      }

      try {
        setLoadingStudents(true);
        const studentsData = await courseService.getCourseStudents(filters.selectedCourseId);
        setStudents(studentsData);
      } catch (error) {
        console.error("Error fetching students:", error);
        setStudents([]);
      } finally {
        setLoadingStudents(false);
      }
    }
    fetchStudents();
  }, [filters.selectedCourseId]);

  // Reset student when course changes
  useEffect(() => {
    setFilters(prev => ({ ...prev, selectedStudentId: null }));
    setSearchQuery("");
  }, [filters.selectedCourseId]);

  // Filtered students based on search
  const filteredStudents = useMemo(() => {
    if (!searchQuery) return students;
    const query = searchQuery.toLowerCase();
    return students.filter(s => 
      s.name.toLowerCase().includes(query) || 
      (s.class_name && s.class_name.toLowerCase().includes(query))
    );
  }, [students, searchQuery]);

  // Current student index for navigation
  const currentStudentIndex = useMemo(() => {
    if (!filters.selectedStudentId || filteredStudents.length === 0) return -1;
    return filteredStudents.findIndex(s => s.id === filters.selectedStudentId);
  }, [filters.selectedStudentId, filteredStudents]);

  // Navigation handlers
  const handlePreviousStudent = useCallback(() => {
    if (currentStudentIndex > 0) {
      setFilters(prev => ({
        ...prev,
        selectedStudentId: filteredStudents[currentStudentIndex - 1].id,
      }));
    }
  }, [currentStudentIndex, filteredStudents]);

  const handleNextStudent = useCallback(() => {
    if (currentStudentIndex < filteredStudents.length - 1) {
      setFilters(prev => ({
        ...prev,
        selectedStudentId: filteredStudents[currentStudentIndex + 1].id,
      }));
    }
  }, [currentStudentIndex, filteredStudents]);

  const handleClearCourse = useCallback(() => {
    setFilters({ selectedCourseId: null, selectedStudentId: null });
    setSearchQuery("");
  }, []);

  const handleEvaluationClick = useCallback((evaluationId: number) => {
    setSelectedEvaluationId(evaluationId);
    setFeedbackPanelOpen(true);
  }, []);

  // Find selected student
  const selectedStudent = useMemo(() => {
    if (!filters.selectedStudentId) return null;
    return students.find(s => s.id === filters.selectedStudentId) || null;
  }, [filters.selectedStudentId, students]);

  /* =========================================
     STATE 0: No course selected
     ========================================= */
  if (!filters.selectedCourseId) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Leerlingoverzicht</h2>
          <p className="text-sm text-slate-600 mt-1">
            Totaaloverzicht van één leerling: projecten, peerevaluaties, competenties en leerdoelen
          </p>
        </div>

        {/* Filters */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Selecteer vak</label>
              <select
                value={filters.selectedCourseId || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, selectedCourseId: e.target.value ? Number(e.target.value) : null }))}
                className="px-3 py-2 text-sm border rounded-lg min-w-[200px]"
                disabled={loadingCourses}
              >
                <option value="">Kies een vak...</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================
     STATE 1: Course selected, no student
     ========================================= */
  if (!filters.selectedStudentId) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Leerlingoverzicht</h2>
          <p className="text-sm text-slate-600 mt-1">
            Selecteer een leerling om het overzicht te bekijken
          </p>
        </div>

        {/* Filters */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Selecteer vak</label>
              <div className="flex gap-2 items-center">
                <select
                  value={filters.selectedCourseId || ""}
                  onChange={(e) => setFilters(prev => ({ ...prev, selectedCourseId: e.target.value ? Number(e.target.value) : null }))}
                  className="px-3 py-2 text-sm border rounded-lg min-w-[200px]"
                >
                  <option value="">Kies een vak...</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleClearCourse}
                  className="p-2 text-gray-500 hover:text-gray-700"
                  title="Wis selectie"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Zoek leerling</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoek op naam of klas..."
                className="px-3 py-2 text-sm border rounded-lg min-w-[200px]"
              />
            </div>
          </div>
        </div>

        {/* Student List Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loadingStudents ? (
            <div className="p-8 text-center text-gray-500">Laden...</div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchQuery ? "Geen leerlingen gevonden voor deze zoekopdracht" : "Geen leerlingen gevonden in dit vak"}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Naam
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Klas
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredStudents.map((student) => (
                  <tr
                    key={student.id}
                    onClick={() => setFilters(prev => ({ ...prev, selectedStudentId: student.id }))}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {student.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {student.class_name || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  /* =========================================
     STATE 2: Both course and student selected
     ========================================= */
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Leerlingoverzicht: {selectedStudent?.name || "Laden..."}
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          {selectedStudent?.class_name && `Klas: ${selectedStudent.class_name}`}
        </p>
      </div>

      {/* Filters with navigation */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4 items-center">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Selecteer vak</label>
              <div className="flex gap-2 items-center">
                <select
                  value={filters.selectedCourseId || ""}
                  onChange={(e) => setFilters(prev => ({ ...prev, selectedCourseId: e.target.value ? Number(e.target.value) : null }))}
                  className="px-3 py-2 text-sm border rounded-lg min-w-[200px]"
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Zoek leerling</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoek op naam of klas..."
                className="px-3 py-2 text-sm border rounded-lg min-w-[200px]"
              />
            </div>
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-2">
            <button
              onClick={handlePreviousStudent}
              disabled={currentStudentIndex <= 0}
              className="px-3 py-2 text-sm border rounded-lg flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              <ChevronLeft className="w-4 h-4" />
              Vorige
            </button>
            <button
              onClick={handleNextStudent}
              disabled={currentStudentIndex >= filteredStudents.length - 1}
              className="px-3 py-2 text-sm border rounded-lg flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              Volgende
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* A) Project Results */}
      <ProjectResultsSection 
        studentId={filters.selectedStudentId} 
        courseId={filters.selectedCourseId} 
      />

      {/* B) OMZA Trend (left) + Heatmap (middle) + Competency Profile (right) - three columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <EvaluationHeatmapSection 
          studentId={filters.selectedStudentId} 
          courseId={filters.selectedCourseId}
          onEvaluationClick={handleEvaluationClick}
        />
        
        <CompetencyProfileSection 
          studentId={filters.selectedStudentId} 
          courseId={filters.selectedCourseId} 
        />
      </div>

      {/* E) Learning Objectives */}
      <LearningObjectivesSection 
        studentId={filters.selectedStudentId} 
        courseId={filters.selectedCourseId} 
      />

      {/* F) Reflections */}
      <ReflectionsSection 
        studentId={filters.selectedStudentId} 
        courseId={filters.selectedCourseId} 
      />

      {/* Feedback Side Panel */}
      <FeedbackSidePanel
        isOpen={feedbackPanelOpen}
        onClose={() => setFeedbackPanelOpen(false)}
        studentId={filters.selectedStudentId}
        courseId={filters.selectedCourseId}
        initialEvaluationId={selectedEvaluationId}
      />
    </div>
  );
}
