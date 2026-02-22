"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { courseService } from "@/services/course.service";
import { CourseStudent } from "@/dtos/course.dto";
import { useAggregatedFeedback } from "@/hooks/useAggregatedFeedback";

interface StudentFeedbackPanelProps {
  evalId: number;
  courseId: number | null;
  onClose: () => void;
  width?: number;
  maxWidth?: number;
  onWidthChange?: (width: number) => void;
}

type FeedbackTypeFilter = "all" | "self" | "peer";

export function StudentFeedbackPanel({
  evalId,
  courseId,
  onClose,
  width = 400,
  maxWidth = 600,
  onWidthChange,
}: StudentFeedbackPanelProps) {
  const [students, setStudents] = useState<CourseStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<FeedbackTypeFilter>("all");

  // Load students from course
  useEffect(() => {
    if (!courseId) {
      setStudents([]);
      return;
    }
    setStudentsLoading(true);
    setStudentsError(null);
    courseService
      .getCourseStudents(courseId)
      .then((data) => setStudents(data))
      .catch((err) => setStudentsError(err?.message || "Laden mislukt"))
      .finally(() => setStudentsLoading(false));
  }, [courseId]);

  // Load aggregated feedback for this evaluation
  const { data: feedbackData, loading: feedbackLoading } = useAggregatedFeedback({
    evaluationId: evalId,
  });

  // Filtered student list based on search query
  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.class_name ?? "").toLowerCase().includes(q),
    );
  }, [students, search]);

  // Index of selected student in filtered list (for prev/next)
  const selectedIndex =
    selectedStudentId != null
      ? filteredStudents.findIndex((s) => s.id === selectedStudentId)
      : -1;

  const goPrev = useCallback(() => {
    if (selectedIndex > 0) setSelectedStudentId(filteredStudents[selectedIndex - 1].id);
  }, [selectedIndex, filteredStudents]);

  const goNext = useCallback(() => {
    if (selectedIndex < filteredStudents.length - 1)
      setSelectedStudentId(filteredStudents[selectedIndex + 1].id);
  }, [selectedIndex, filteredStudents]);

  // When search changes, deselect student if not in filtered list
  useEffect(() => {
    if (
      selectedStudentId != null &&
      !filteredStudents.some((s) => s.id === selectedStudentId)
    ) {
      setSelectedStudentId(null);
    }
  }, [filteredStudents, selectedStudentId]);

  // Feedback received by the selected student, filtered by type
  const studentFeedback =
    feedbackData?.feedbackItems?.filter((item) => {
      if (item.student_id !== selectedStudentId) return false;
      if (typeFilter === "self") return item.feedback_type === "self";
      if (typeFilter === "peer") return item.feedback_type === "peer";
      return true;
    }) ?? [];

  // Resize handle (same pattern as ProjectNotesPanel)
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(280, Math.min(maxWidth, startWidth + (e.clientX - startX)));
      onWidthChange?.(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  return (
    <div className="flex h-full">
      <div
        className="flex flex-col flex-1 bg-slate-50 border-r border-slate-200 overflow-hidden"
        style={{ width }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
          <h3 className="text-sm font-semibold text-slate-700">Peerreview feedback ontvangen</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            title="Sluiten"
          >
            ✕
          </button>
        </div>

        {/* Student selector */}
        <div className="px-4 py-3 border-b border-slate-200 bg-white space-y-2">
          {!courseId ? (
            <p className="text-sm text-slate-500">
              Geen klas gekoppeld aan deze evaluatie.
            </p>
          ) : (
            <>
              <input
                type="text"
                placeholder="Zoek leerling (naam/klas)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <div className="flex gap-1">
                <select
                  value={selectedStudentId ?? ""}
                  onChange={(e) =>
                    setSelectedStudentId(e.target.value ? Number(e.target.value) : null)
                  }
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={studentsLoading}
                >
                  <option value="">— Kies leerling —</option>
                  {filteredStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.class_name ? ` (${s.class_name})` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={selectedIndex <= 0}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-sm disabled:opacity-40 hover:bg-slate-50"
                  title="Vorige leerling"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={selectedIndex < 0 || selectedIndex >= filteredStudents.length - 1}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-sm disabled:opacity-40 hover:bg-slate-50"
                  title="Volgende leerling"
                >
                  ›
                </button>
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as FeedbackTypeFilter)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">Alle (self + peer)</option>
                <option value="self">Alleen self</option>
                <option value="peer">Alleen peer</option>
              </select>
            </>
          )}
        </div>

        {/* Feedback content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {studentsLoading && (
            <p className="text-sm text-slate-500 text-center py-4">Leerlingen laden...</p>
          )}
          {studentsError && (
            <p className="text-sm text-red-500 text-center py-4">{studentsError}</p>
          )}
          {!studentsLoading && !studentsError && courseId && !selectedStudentId && (
            <p className="text-sm text-slate-500 text-center py-4">
              Selecteer een leerling om feedback te bekijken.
            </p>
          )}
          {selectedStudentId && feedbackLoading && (
            <p className="text-sm text-slate-500 text-center py-4">Feedback laden...</p>
          )}
          {selectedStudentId && !feedbackLoading && studentFeedback.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">
              Geen feedback gevonden voor deze leerling.
            </p>
          )}
          {selectedStudentId &&
            !feedbackLoading &&
            studentFeedback.map((item) => (
              <div
                key={item.allocation_id}
                className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-700">
                    {item.feedback_type === "self"
                      ? "Zelf"
                      : item.from_student_name || "Onbekend"}
                  </span>
                  {typeFilter === "all" && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                        item.feedback_type === "self"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {item.feedback_type}
                    </span>
                  )}
                </div>
                {item.criteria_details.length > 0 ? (
                  <ul className="space-y-2">
                    {item.criteria_details.map((c, i) => (
                      <li
                        key={c.criterion_id ?? `${c.criterion_name}-${i}`}
                        className="border-t first:border-t-0 border-slate-100 pt-2 first:pt-0"
                      >
                        <div className="flex flex-wrap items-start gap-2 mb-1">
                          {c.criterion_name && (
                            <span className="inline-block text-xs px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600">
                              {c.criterion_name}
                            </span>
                          )}
                          {c.score != null && (
                            <span className="inline-block text-xs px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-600 tabular-nums">
                              Score: {c.score}
                            </span>
                          )}
                        </div>
                        {c.feedback && (
                          <p className="text-sm text-slate-700 leading-5">{c.feedback}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : item.combined_feedback ? (
                  <p className="text-sm text-slate-700 leading-5">{item.combined_feedback}</p>
                ) : (
                  <p className="text-xs text-slate-400 italic">Geen inhoud</p>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* Resize handle */}
      <div
        className="w-1 bg-slate-200 hover:bg-indigo-400 cursor-col-resize transition-colors"
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Versleep om paneel grootte aan te passen"
        tabIndex={0}
      />
    </div>
  );
}
