"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useNumericEvalId } from "@/lib/id";
import { omzaService } from "@/services/omza.service";
import { gradesService } from "@/services/grades.service";
import { evaluationService } from "@/services";
import { StandardComment } from "@/dtos/omza.dto";
import { GradePreviewItem } from "@/dtos/grades.dto";
import {
  mapPeerScoreToIconLevel,
  ICON_LABELS,
  ICON_DESCRIPTIONS,
} from "@/utils/omza.utils";
import { ProjectNotesPanel } from "@/components/teacher/omza/ProjectNotesPanel";
import { useTeacherLayout } from "@/app/(teacher)/layout";
import { useEvaluationFocusMode } from "../layout";
import { Loading, ErrorMessage } from "@/components";

// ── helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  O: "Organiseren",
  M: "Meedoen",
  Z: "Zelfvertrouwen",
  A: "Autonomie",
};

const round1 = (n: number) => Math.round(n * 10) / 10;

function finalGrade(r: Row): number {
  if (r.override != null) return round1(r.override);
  if (r.rowGroupGrade != null) return round1(r.rowGroupGrade * r.gcf);
  return round1(r.serverSuggested ?? 0);
}

// ── sub-components ────────────────────────────────────────────────────────────

function LevelSelector({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {ICON_LABELS.map((label, index) => {
        const level = index + 1;
        const isActive = value === level;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(level)}
            className={
              "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-medium transition " +
              (isActive
                ? label === "!!"
                  ? "border-rose-500 bg-rose-100 text-rose-700 shadow-sm"
                  : label === "!"
                  ? "border-amber-400 bg-amber-100 text-amber-700 shadow-sm"
                  : "border-green-500 bg-green-100 text-green-700 shadow-sm"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700")
            }
            aria-label={ICON_DESCRIPTIONS[index]}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function OmzaQuickCommentsGrid({
  categories,
  standardComments,
  studentId,
  appendStandardComment,
  addStandardComment,
  deleteStandardComment,
}: {
  categories: string[];
  standardComments: Record<string, StandardComment[]>;
  studentId: number;
  appendStandardComment: (studentId: number, text: string) => void;
  addStandardComment: (category: string, text: string) => void;
  deleteStandardComment: (commentId: string) => void;
}) {
  const [newCommentTexts, setNewCommentTexts] = useState<Record<string, string>>({});

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {categories.map((cat) => {
        const comments = standardComments[cat] || [];
        const newCommentText = newCommentTexts[cat] || "";
        return (
          <div
            key={cat}
            className="rounded-xl border border-indigo-100 bg-white/70 p-3 shadow-sm"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-gray-800">
                {CATEGORY_LABELS[cat] || cat}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {comments.map((comment) => {
                const isTemplateComment = comment.id.startsWith("template_");
                return (
                  <div key={comment.id} className="group relative inline-flex">
                    <button
                      type="button"
                      className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700"
                      onClick={() => appendStandardComment(studentId, comment.text)}
                    >
                      {comment.text}
                    </button>
                    {!isTemplateComment && (
                      <button
                        type="button"
                        className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center hover:bg-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteStandardComment(comment.id);
                        }}
                        title="Verwijder opmerking"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1">
              <input
                className="flex-1 h-7 rounded-md border border-gray-300 bg-white px-2 text-[11px] shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Nieuwe opmerking..."
                value={newCommentText}
                onChange={(e) =>
                  setNewCommentTexts((prev) => ({ ...prev, [cat]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCommentText.trim()) {
                    addStandardComment(cat, newCommentText);
                    setNewCommentTexts((prev) => ({ ...prev, [cat]: "" }));
                  }
                }}
              />
              <button
                type="button"
                className="h-7 px-2 text-[10px] rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                onClick={() => {
                  if (newCommentText.trim()) {
                    addStandardComment(cat, newCommentText);
                    setNewCommentTexts((prev) => ({ ...prev, [cat]: "" }));
                  }
                }}
              >
                +
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── types ─────────────────────────────────────────────────────────────────────

type Row = {
  user_id: number;
  name: string;
  teamNumber: number | null;
  className: string | null;
  // OMZA
  categoryScores: Record<string, { peer_avg: number | null; self_avg: number | null }>;
  teacherComment: string | null;
  // Grades
  gcf: number;
  serverSuggested: number;
  rowGroupGrade: number | null;
  override: number | null;
};

type SortKey = "team" | "name" | "class" | "final";

// ── main component ────────────────────────────────────────────────────────────

export default function CombinedAssessmentInner() {
  const evalIdNum = useNumericEvalId();
  const evalIdStr = evalIdNum != null ? String(evalIdNum) : "—";

  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);

  const [teacherScores, setTeacherScores] = useState<Record<string, number | null>>({});
  const [teacherComments, setTeacherComments] = useState<Record<string, string>>({});
  const [standardComments, setStandardComments] = useState<Record<string, StandardComment[]>>({});
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Filters
  const [searchName, setSearchName] = useState("");
  const [filterTeam, setFilterTeam] = useState("all");
  const [filterClass, setFilterClass] = useState("all");

  // Sort
  const [sortBy, setSortBy] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Auto-save state
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("saved");

  // Focus mode
  const { focusMode, setFocusMode } = useEvaluationFocusMode();
  const [notesWidth, setNotesWidth] = useState(0);
  const { setSidebarCollapsed } = useTeacherLayout();
  const maxNotesWidth = focusMode ? 1500 : 600;

  // Saving indicators
  const [savingComments, setSavingComments] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);

  // Debounce refs
  const scoreTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const commentTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── data loading ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (evalIdNum == null) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Promise.all([
      omzaService.getOmzaData(evalIdNum, controller.signal),
      gradesService.previewGrades(evalIdNum),
      gradesService.listGrades(evalIdNum),
      evaluationService.getEvaluation(evalIdNum),
      omzaService.getStandardComments(evalIdNum, controller.signal),
    ])
      .then(([omzaData, preview, existingGrades, evaluation, stdComments]) => {
        setProjectId(evaluation.project_id ?? null);
        setCategories(omzaData.categories);

        // Build standard comments map by category
        const byCategory: Record<string, StandardComment[]> = {};
        stdComments.forEach((c) => {
          if (!byCategory[c.category]) byCategory[c.category] = [];
          byCategory[c.category].push(c);
        });
        setStandardComments(byCategory);

        // Build grades map
        const items: GradePreviewItem[] = preview?.items ?? [];
        const existingMap = new Map(
          existingGrades.map((g) => [
            g.user_id,
            {
              override: g.grade ?? null,
              rowGroupGrade: g.meta?.group_grade ?? null,
            },
          ]),
        );

        // Merge OMZA + grades by student_id
        const omzaMap = new Map(omzaData.students.map((s) => [s.student_id, s]));
        const gradesMap = new Map(items.map((i) => [i.user_id, i]));

        // Collect all user IDs from both sources
        const allIds = new Set([...omzaMap.keys(), ...gradesMap.keys()]);

        const merged: Row[] = [];
        allIds.forEach((uid) => {
          const omzaStudent = omzaMap.get(uid);
          const gradeItem = gradesMap.get(uid);
          const saved = existingMap.get(uid);

          merged.push({
            user_id: uid,
            name: omzaStudent?.student_name ?? gradeItem?.user_name ?? String(uid),
            teamNumber:
              omzaStudent?.team_number ?? gradeItem?.team_number ?? null,
            className:
              omzaStudent?.class_name ?? gradeItem?.class_name ?? null,
            categoryScores: omzaData.categories.reduce<
              Record<string, { peer_avg: number | null; self_avg: number | null }>
            >((acc, cat) => {
              const cs = omzaStudent?.category_scores[cat];
              acc[cat] = {
                peer_avg: cs?.peer_avg ?? null,
                self_avg: cs?.self_avg ?? null,
              };
              return acc;
            }, {}),
            teacherComment: omzaStudent?.teacher_comment ?? null,
            gcf: gradeItem?.gcf ?? 1,
            serverSuggested: gradeItem?.suggested_grade ?? 0,
            override: saved?.override ?? null,
            rowGroupGrade: saved?.rowGroupGrade ?? null,
          });
        });

        // Initialize teacher scores/comments state from OMZA data
        const scores: Record<string, number | null> = {};
        const comments: Record<string, string> = {};
        omzaData.students.forEach((student) => {
          omzaData.categories.forEach((cat) => {
            const cs = student.category_scores[cat];
            if (cs?.teacher_score != null) {
              scores[`${student.student_id}-${cat}`] = cs.teacher_score;
            }
          });
          if (student.teacher_comment) {
            comments[student.student_id] = student.teacher_comment;
          }
        });
        setTeacherScores(scores);
        setTeacherComments(comments);
        setRows(merged);
      })
      .catch((err) => {
        if (
          err.name !== "AbortError" &&
          err.name !== "CanceledError" &&
          err.message !== "canceled"
        ) {
          setError(err?.response?.data?.detail ?? err?.message ?? "Laden mislukt");
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [evalIdNum]);

  // ── focus mode side effects ───────────────────────────────────────────────

  useEffect(() => {
    if (focusMode && notesWidth === 0 && typeof window !== "undefined") {
      setNotesWidth(Math.floor(window.innerWidth * 0.4));
    }
  }, [focusMode, notesWidth]);

  useEffect(() => {
    if (focusMode) {
      setSidebarCollapsed(true);
    }
    return () => {
      if (focusMode) setSidebarCollapsed(false);
    };
  }, [focusMode, setSidebarCollapsed]);

  // ── auto-save grades every 30s ────────────────────────────────────────────

  const handleDraftSave = useCallback(async () => {
    if (evalIdNum == null || rows.length === 0) return;
    const overrides = Object.fromEntries(
      rows.map((r) => [
        r.user_id,
        { grade: r.override ?? null, reason: null, rowGroupGrade: r.rowGroupGrade ?? null },
      ]),
    );
    try {
      await gradesService.saveDraft({
        evaluation_id: evalIdNum,
        group_grade: null,
        overrides,
      });
      setAutoSaveState("saved");
    } catch {
      setAutoSaveState("error");
    }
  }, [evalIdNum, rows]);

  useEffect(() => {
    if (evalIdNum == null) return;
    const timer = setInterval(() => {
      setAutoSaveState("saving");
      handleDraftSave();
    }, 30000);
    return () => clearInterval(timer);
  }, [rows, evalIdNum, handleDraftSave]);

  // ── toast helper ──────────────────────────────────────────────────────────

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Clear toast timeout on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // ── OMZA score change ─────────────────────────────────────────────────────

  const handleScoreChange = useCallback(
    (studentId: number, category: string, level: number) => {
      const key = `${studentId}-${category}`;
      setTeacherScores((prev) => ({ ...prev, [key]: level }));

      if (scoreTimeouts.current[key]) clearTimeout(scoreTimeouts.current[key]);
      scoreTimeouts.current[key] = setTimeout(() => {
        if (evalIdNum == null) return;
        omzaService
          .saveTeacherScore(evalIdNum, { student_id: studentId, category, score: level })
          .then(() => showToast("Docentscore opgeslagen"))
          .catch((err) => showToast(`Fout bij opslaan: ${err?.message || "Onbekende fout"}`));
      }, 500);
    },
    [evalIdNum, showToast],
  );

  // ── OMZA comment change ───────────────────────────────────────────────────

  const handleCommentChange = useCallback(
    (studentId: number, value: string) => {
      setTeacherComments((prev) => ({ ...prev, [studentId]: value }));

      const key = String(studentId);
      if (commentTimeouts.current[key]) clearTimeout(commentTimeouts.current[key]);
      commentTimeouts.current[key] = setTimeout(() => {
        if (evalIdNum == null) return;
        setSavingComments((prev) => ({ ...prev, [key]: true }));
        omzaService
          .saveTeacherComment(evalIdNum, { student_id: studentId, comment: value })
          .then(() => showToast("Docentopmerking opgeslagen"))
          .catch((err) => showToast(`Fout bij opslaan: ${err?.message || "Onbekende fout"}`))
          .finally(() => setSavingComments((prev) => ({ ...prev, [key]: false })));
      }, 500);
    },
    [evalIdNum, showToast],
  );

  // ── standard comments helpers ─────────────────────────────────────────────

  const appendStandardComment = useCallback(
    (studentId: number, text: string) => {
      const current = teacherComments[studentId] || "";
      handleCommentChange(studentId, current ? `${current} ${text}` : text);
    },
    [teacherComments, handleCommentChange],
  );

  const addStandardComment = useCallback(
    (category: string, text: string) => {
      if (!text.trim() || !evalIdNum) return;
      omzaService
        .addStandardComment(evalIdNum, { category, text: text.trim() })
        .then((newComment) => {
          setStandardComments((prev) => ({
            ...prev,
            [category]: [...(prev[category] || []), newComment],
          }));
          showToast("Standaardopmerking toegevoegd");
        })
        .catch((err) => showToast(`Fout bij toevoegen: ${err?.message || "Onbekende fout"}`));
    },
    [evalIdNum, showToast],
  );

  const deleteStandardComment = useCallback(
    (commentId: string) => {
      if (!evalIdNum) return;
      omzaService
        .deleteStandardComment(evalIdNum, commentId)
        .then(() => {
          setStandardComments((prev) => {
            const next = { ...prev };
            Object.keys(next).forEach((cat) => {
              next[cat] = next[cat].filter((c) => c.id !== commentId);
            });
            return next;
          });
          showToast("Standaardopmerking verwijderd");
        })
        .catch((err) => showToast(`Fout bij verwijderen: ${err?.message || "Onbekende fout"}`));
    },
    [evalIdNum, showToast],
  );

  // ── "Neem peer score over" ────────────────────────────────────────────────

  const applyPeerScoresAll = useCallback(() => {
    if (!evalIdNum) return;
    const updates: Array<Promise<unknown>> = [];
    const newScores = { ...teacherScores };

    rows.forEach((row) => {
      categories.forEach((cat) => {
        const cs = row.categoryScores[cat];
        if (cs?.peer_avg != null) {
          const level = mapPeerScoreToIconLevel(cs.peer_avg);
          const key = `${row.user_id}-${cat}`;
          newScores[key] = level;
          updates.push(
            omzaService.saveTeacherScore(evalIdNum, {
              student_id: row.user_id,
              category: cat,
              score: level,
            }),
          );
        }
      });
    });

    setTeacherScores(newScores);
    Promise.all(updates)
      .then(() => showToast("Docentscores overgenomen van peer scores"))
      .catch((err) => showToast(`Fout bij opslaan: ${err?.message || "Onbekende fout"}`));
  }, [evalIdNum, rows, categories, teacherScores, showToast]);

  // ── grade helpers ─────────────────────────────────────────────────────────

  function handleUpdateTeamGroupGrade(teamNumber: number | null | undefined, value: string) {
    if (teamNumber == null) return;
    setAutoSaveState("saving");
    if (value.trim() === "") {
      setRows((all) =>
        all.map((x) => (x.teamNumber === teamNumber ? { ...x, rowGroupGrade: null } : x)),
      );
      return;
    }
    const num = Number(value.replace(",", "."));
    const newGrade = Number.isNaN(num) ? null : num;
    setRows((all) =>
      all.map((x) => (x.teamNumber === teamNumber ? { ...x, rowGroupGrade: newGrade } : x)),
    );
  }

  function handleUpdateOverride(userId: number, value: string) {
    setAutoSaveState("saving");
    if (value.trim() === "") {
      setRows((all) => all.map((x) => (x.user_id === userId ? { ...x, override: null } : x)));
      return;
    }
    const num = Number(value.replace(",", "."));
    const newVal = Number.isNaN(num) ? null : num;
    setRows((all) => all.map((x) => (x.user_id === userId ? { ...x, override: newVal } : x)));
  }

  function handleClearOverride(userId: number) {
    setAutoSaveState("saving");
    setRows((all) => all.map((x) => (x.user_id === userId ? { ...x, override: null } : x)));
  }

  // ── sort ──────────────────────────────────────────────────────────────────

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

  // ── derived data ──────────────────────────────────────────────────────────

  const teamOptions = useMemo(() => {
    const nums: number[] = [];
    const strs: string[] = [];
    rows.forEach((r) => {
      if (r.teamNumber != null) nums.push(r.teamNumber);
      else strs.push("–");
    });
    const uniqueNums = Array.from(new Set(nums)).sort((a, b) => a - b);
    const hasBlank = strs.length > 0;
    return [...uniqueNums, ...(hasBlank ? ["–"] : [])];
  }, [rows]);

  const classOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.className ?? "–"));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "nl"));
  }, [rows]);

  const filteredSorted = useMemo(() => {
    const q = searchName.trim().toLowerCase();
    let list = rows.filter((r) => {
      const teamMatch = filterTeam === "all" || String(r.teamNumber ?? "–") === filterTeam;
      const classMatch = filterClass === "all" || String(r.className ?? "–") === filterClass;
      const nameMatch = q === "" || r.name.toLowerCase().includes(q);
      return teamMatch && classMatch && nameMatch;
    });
    if (sortBy) {
      list = [...list].sort((a, b) => {
        let va: string | number = 0;
        let vb: string | number = 0;
        if (sortBy === "team") { va = a.teamNumber ?? -1; vb = b.teamNumber ?? -1; }
        else if (sortBy === "name") { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
        else if (sortBy === "class") { va = a.className ?? ""; vb = b.className ?? ""; }
        else if (sortBy === "final") { va = finalGrade(a); vb = finalGrade(b); }
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [rows, filterTeam, filterClass, searchName, sortBy, sortDir]);

  const stats = useMemo(() => {
    const list = filteredSorted;
    const count = list.length || 1;
    return {
      hasData: list.length > 0,
      avgGcf: list.reduce((s, r) => s + r.gcf, 0) / count,
      avgGroupGrade: list.reduce((s, r) => s + (r.rowGroupGrade ?? 0), 0) / count,
      avgFinal: list.reduce((s, r) => s + finalGrade(r), 0) / count,
    };
  }, [filteredSorted]);

  const autoSaveLabel =
    {
      idle: "",
      saving: "Opslaan…",
      saved: "✔ Opgeslagen",
      error: "⚠ Fout",
    }[autoSaveState] ?? "";

  // ── render ────────────────────────────────────────────────────────────────

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;

  // Column count: Team + Student + Klas + categories + 💬 + GCF + Groepscijfer + Eindcijfer
  const colSpan = 3 + categories.length + 1 + 1 + 1 + 1;

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className="bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg">{toast}</div>
        </div>
      )}

      <div className="space-y-6">
        {/* Filter bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              className="h-9 w-56 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Zoek op naam…"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
            <select
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm"
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              title="Filter op team"
            >
              <option value="all">Alle teams</option>
              {teamOptions.map((t) => (
                <option key={String(t)} value={String(t)}>
                  Team {String(t)}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm"
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              title="Filter op klas"
            >
              <option value="all">Alle klassen</option>
              {classOptions.map((c) => (
                <option key={String(c)} value={String(c)}>
                  {String(c)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {autoSaveLabel && (
              <span className="text-xs text-gray-500">{autoSaveLabel}</span>
            )}
            {projectId && (
              <button
                type="button"
                className={`h-9 rounded-lg border px-3 text-xs md:text-sm font-medium shadow-sm transition-colors ${
                  focusMode
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setFocusMode(!focusMode)}
              >
                📝 {focusMode ? "Verberg aantekeningen" : "Toon aantekeningen"}
              </button>
            )}
            <button
              type="button"
              className="h-9 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs md:text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-100"
              onClick={applyPeerScoresAll}
            >
              Neem peer score over
            </button>
          </div>
        </div>

        {/* Focus mode grid wrapper */}
        <div
          className={focusMode && projectId ? "grid gap-6 min-w-0" : ""}
          style={
            focusMode && projectId
              ? { gridTemplateColumns: `${notesWidth}px 1fr` }
              : undefined
          }
        >
          {focusMode && projectId && (
            <ProjectNotesPanel
              projectId={projectId}
              onClose={() => setFocusMode(false)}
              width={notesWidth}
              maxWidth={maxNotesWidth}
              onWidthChange={setNotesWidth}
            />
          )}

          <div className="min-w-0">
            {rows.length === 0 && !loading && (
              <p className="text-sm text-gray-500">Geen data gevonden.</p>
            )}

            {filteredSorted.length > 0 && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {/* Team */}
                        <th
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide w-14 cursor-pointer hover:bg-gray-100"
                          onClick={() => toggleSort("team")}
                        >
                          <div className="flex items-center gap-1">
                            Team
                            {sortBy === "team" && <span>{sortDir === "asc" ? "↑" : "↓"}</span>}
                          </div>
                        </th>
                        {/* Student */}
                        <th
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide cursor-pointer hover:bg-gray-100"
                          onClick={() => toggleSort("name")}
                        >
                          <div className="flex items-center gap-1">
                            Leerling
                            {sortBy === "name" && <span>{sortDir === "asc" ? "↑" : "↓"}</span>}
                          </div>
                        </th>
                        {/* Klas */}
                        <th
                          className="px-3 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide cursor-pointer hover:bg-gray-100"
                          onClick={() => toggleSort("class")}
                        >
                          <div className="flex items-center gap-1">
                            Klas
                            {sortBy === "class" && <span>{sortDir === "asc" ? "↑" : "↓"}</span>}
                          </div>
                        </th>
                        {/* OMZA categories */}
                        {categories.map((cat) => (
                          <th
                            key={cat}
                            className="px-2 py-3 text-center text-xs font-semibold text-gray-500 tracking-wide w-14"
                            title={CATEGORY_LABELS[cat] || cat}
                          >
                            {cat}
                          </th>
                        ))}
                        {/* Comment indicator */}
                        <th className="px-2 py-3 text-center text-xs font-semibold text-gray-500 tracking-wide w-8" />
                        {/* GCF */}
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 tracking-wide w-16">
                          GCF
                        </th>
                        {/* Groepscijfer */}
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 tracking-wide w-24">
                          Groepscijfer
                        </th>
                        {/* Eindcijfer */}
                        <th
                          className="px-3 py-3 text-right text-xs font-semibold text-gray-500 tracking-wide w-24 cursor-pointer hover:bg-gray-100"
                          onClick={() => toggleSort("final")}
                        >
                          <div className="flex items-center justify-end gap-1">
                            Eindcijfer
                            {sortBy === "final" && <span>{sortDir === "asc" ? "↑" : "↓"}</span>}
                          </div>
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">
                      {filteredSorted.map((r) => {
                        const isExpanded = expandedRow === r.user_id;
                        const hasComment = !!(teacherComments[r.user_id] || r.teacherComment);

                        return (
                          <React.Fragment key={r.user_id}>
                            <tr className={isExpanded ? "bg-indigo-50/40" : "bg-white hover:bg-gray-50"}>
                              {/* Team pill */}
                              <td className="px-4 py-3 align-middle text-xs text-gray-500">
                                {r.teamNumber != null && (
                                  <span className="inline-flex items-center justify-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                                    {r.teamNumber}
                                  </span>
                                )}
                              </td>
                              {/* Student link + expand button */}
                              <td className="px-4 py-3 align-middle">
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/teacher/evaluations/${evalIdStr}/students/${r.user_id}`}
                                    className="text-sm font-medium text-indigo-700 hover:underline"
                                  >
                                    {r.name}
                                  </Link>
                                  <button
                                    type="button"
                                    className="inline-flex items-center rounded-full border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-50"
                                    onClick={() =>
                                      setExpandedRow(isExpanded ? null : r.user_id)
                                    }
                                    title="Docentopmerking"
                                  >
                                    💬
                                  </button>
                                </div>
                              </td>
                              {/* Klas */}
                              <td className="px-3 py-3 align-middle text-xs text-gray-500">
                                {r.className ?? "–"}
                              </td>
                              {/* OMZA score cells with tooltip */}
                              {categories.map((cat) => {
                                const key = `${r.user_id}-${cat}`;
                                const teacherVal = teacherScores[key] ?? null;
                                const cs = r.categoryScores[cat];
                                const peerStr =
                                  cs?.peer_avg != null ? cs.peer_avg.toFixed(1) : "—";
                                const selfStr =
                                  cs?.self_avg != null ? cs.self_avg.toFixed(1) : "—";
                                const fullLabel = CATEGORY_LABELS[cat] || cat;

                                return (
                                  <td key={cat} className="px-2 py-3 align-middle">
                                    <div className="relative group flex justify-center">
                                      <LevelSelector
                                        value={teacherVal}
                                        onChange={(level) =>
                                          handleScoreChange(r.user_id, cat, level)
                                        }
                                      />
                                      {/* Tooltip */}
                                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                                        <div className="rounded-lg bg-gray-900 text-white text-[11px] px-2.5 py-2 shadow-lg whitespace-nowrap">
                                          <p className="font-semibold mb-1">{fullLabel}</p>
                                          <p>Peer gem.: {peerStr}</p>
                                          <p>Self score: {selfStr}</p>
                                        </div>
                                        <div className="mx-auto h-2 w-2 border-4 border-transparent border-t-gray-900 -mt-0.5" />
                                      </div>
                                    </div>
                                  </td>
                                );
                              })}
                              {/* Comment indicator */}
                              <td className="px-2 py-3 align-middle text-center text-xs text-gray-400">
                                {hasComment ? "💬" : ""}
                              </td>
                              {/* GCF */}
                              <td className="px-3 py-3 align-middle text-right">
                                <span
                                  className={`text-sm ${
                                    r.gcf < 0.9
                                      ? "text-red-600"
                                      : r.gcf !== 1
                                      ? "text-amber-600"
                                      : "text-gray-800"
                                  }`}
                                >
                                  {r.gcf.toFixed(2)}
                                </span>
                              </td>
                              {/* Groepscijfer */}
                              <td className="px-3 py-3 align-middle text-right">
                                <input
                                  type="text"
                                  className="w-20 text-right rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                                  placeholder="bijv. 7.5"
                                  value={
                                    r.rowGroupGrade != null && !Number.isNaN(r.rowGroupGrade)
                                      ? r.rowGroupGrade.toFixed(1)
                                      : ""
                                  }
                                  onChange={(e) =>
                                    handleUpdateTeamGroupGrade(r.teamNumber, e.target.value)
                                  }
                                />
                              </td>
                              {/* Eindcijfer */}
                              <td className="px-3 py-3 align-middle text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <input
                                    type="text"
                                    className={`w-16 text-right rounded-lg border px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm ${
                                      r.override != null
                                        ? "border-blue-300 bg-blue-50"
                                        : finalGrade(r) === 0
                                        ? "border-amber-300 bg-amber-50"
                                        : "border-gray-300 bg-white"
                                    }`}
                                    value={
                                      r.override != null && !Number.isNaN(r.override)
                                        ? r.override.toFixed(1)
                                        : finalGrade(r).toFixed(1)
                                    }
                                    onChange={(e) => handleUpdateOverride(r.user_id, e.target.value)}
                                  />
                                  {r.override != null && (
                                    <button
                                      type="button"
                                      className="text-xs text-gray-400 hover:text-red-600"
                                      onClick={() => handleClearOverride(r.user_id)}
                                      title="Verwijder individuele override"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Expanded comment row */}
                            {isExpanded && (
                              <tr className="bg-indigo-50/60">
                                <td colSpan={colSpan} className="px-5 pb-4 pt-0">
                                  <div className="pt-2 flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs font-medium text-gray-700">
                                        Docentopmerking voor {r.name}
                                      </p>
                                      <span className="text-[11px] text-gray-500">
                                        Tip: klik op een quick comment om deze toe te voegen.
                                      </span>
                                    </div>
                                    <OmzaQuickCommentsGrid
                                      categories={categories}
                                      standardComments={standardComments}
                                      studentId={r.user_id}
                                      appendStandardComment={appendStandardComment}
                                      addStandardComment={addStandardComment}
                                      deleteStandardComment={deleteStandardComment}
                                    />
                                    <div className="mt-3">
                                      <textarea
                                        className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                                        rows={4}
                                        placeholder="Eigen notitie of motivatie over het samenwerken in dit project…"
                                        value={teacherComments[r.user_id] || ""}
                                        onChange={(e) =>
                                          handleCommentChange(r.user_id, e.target.value)
                                        }
                                        disabled={savingComments[String(r.user_id)]}
                                      />
                                      {savingComments[String(r.user_id)] && (
                                        <span className="text-[10px] text-gray-500">Opslaan...</span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer averages */}
                {stats.hasData && (
                  <div className="border-t border-gray-200 bg-gray-50 px-5 py-3">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-medium text-gray-900 flex-1">
                        Gemiddelde (op basis van filter)
                      </span>
                      <span className="text-gray-500 text-xs w-16 text-right">
                        GCF: {stats.avgGcf.toFixed(2)}
                      </span>
                      <span className="text-gray-500 text-xs w-28 text-right">
                        Groep: {stats.avgGroupGrade.toFixed(1)}
                      </span>
                      <span className="font-semibold text-gray-900 text-xs w-28 text-right">
                        Eind: {stats.avgFinal.toFixed(1)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Legend */}
                <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-xs text-slate-500">
                  <p className="mb-2 font-medium">Leeswijzer</p>
                  <p>
                    De OMZA-knoppen geven per categorie het niveau aan dat jij als docent inschat.
                    Beweeg de muis over een OMZA-cel om peer- en selfscores te zien.
                    Het <span className="font-medium">groepscijfer</span> vul je per team in en
                    geldt voor alle leerlingen in dat team. De{" "}
                    <span className="font-medium">GCF</span> is gebaseerd op peer- en
                    self-evaluaties. Het <span className="font-medium">eindcijfer</span> is
                    groepscijfer × GCF (afgerond op één decimaal). Je kunt het eindcijfer handmatig
                    corrigeren; klik ✕ om een override te verwijderen.
                  </p>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
