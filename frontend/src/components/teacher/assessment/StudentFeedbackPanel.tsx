"use client";

import { useState, useEffect, useCallback } from "react";
import { courseService } from "@/services/course.service";
import { CourseStudent } from "@/dtos/course.dto";
import { useAggregatedFeedback } from "@/hooks/useAggregatedFeedback";

type FocusView = "notes" | "feedback";

interface StudentFeedbackPanelProps {
  evalId: number;
  courseId: number | null;
  onClose: () => void;
  width?: number;
  maxWidth?: number;
  onWidthChange?: (width: number) => void;
  focusView?: FocusView;
  onFocusViewChange?: (view: FocusView) => void;
  hasNotes?: boolean;
}

type FeedbackTypeFilter = "all" | "self" | "peer";

export function StudentFeedbackPanel({
  evalId,
  courseId,
  onClose,
  width = 400,
  maxWidth = 600,
  onWidthChange,
  focusView = "feedback",
  onFocusViewChange,
  hasNotes = false,
}: StudentFeedbackPanelProps) {
  const [students, setStudents] = useState<CourseStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<FeedbackTypeFilter>("all");

  // Load students from course; reset selection when course changes
  useEffect(() => {
    setSelectedStudentId(null);
    if (!courseId) {
      setStudents([]);
      return;
    }
    let mounted = true;
    setStudentsLoading(true);
    setStudentsError(null);
    courseService
      .getCourseStudents(courseId)
      .then((data) => { if (mounted) setStudents(data); })
      .catch((err) => { if (mounted) setStudentsError(err?.message || "Laden mislukt"); })
      .finally(() => { if (mounted) setStudentsLoading(false); });
    return () => { mounted = false; };
  }, [courseId]);

  // Load aggregated feedback for this evaluation
  const { data: feedbackData, loading: feedbackLoading } = useAggregatedFeedback({
    evaluationId: evalId,
  });

  // Index of selected student in list (for prev/next)
  const selectedIndex =
    selectedStudentId != null
      ? students.findIndex((s) => s.id === selectedStudentId)
      : -1;

  const goPrev = useCallback(() => {
    if (selectedIndex > 0) setSelectedStudentId(students[selectedIndex - 1].id);
  }, [selectedIndex, students]);

  const goNext = useCallback(() => {
    if (selectedIndex < students.length - 1)
      setSelectedStudentId(students[selectedIndex + 1].id);
  }, [selectedIndex, students]);

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
        <div className="rounded-t-2xl border-t border-x border-slate-200 bg-white px-3 py-2 flex items-center justify-between shrink-0">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => onFocusViewChange?.("notes")}
              disabled={!hasNotes}
              title={hasNotes ? undefined : "Geen project gekoppeld aan deze evaluatie"}
              className={`rounded-md px-2 py-1 text-xs font-medium transition ${focusView === "notes" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"}`}
            >
              📋 Aantekeningen
            </button>
            <button
              type="button"
              onClick={() => onFocusViewChange?.("feedback")}
              className={`rounded-md px-2 py-1 text-xs font-medium transition ${focusView === "feedback" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:bg-white"}`}
            >
              💬 Feedback
            </button>
          </div>
          <button
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Sluiten
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
                  {students.map((s) => (
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
                {selectedIndex >= 0 && (
                  <span className="px-1.5 py-1 text-xs text-slate-500 tabular-nums whitespace-nowrap self-center">
                    {selectedIndex + 1} / {students.length}
                  </span>
                )}
                <button
                  type="button"
                  onClick={goNext}
                  disabled={selectedIndex < 0 || selectedIndex >= students.length - 1}
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
