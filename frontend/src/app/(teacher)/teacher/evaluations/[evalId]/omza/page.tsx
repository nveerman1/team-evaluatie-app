"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useNumericEvalId } from "@/utils";
import { Loading, ErrorMessage } from "@/components";
import { omzaService } from "@/services/omza.service";
import { OmzaDataResponse, OmzaStudentData, StandardComment } from "@/dtos/omza.dto";
import { mapPeerScoreToIconLevel, ICON_LABELS, ICON_DESCRIPTIONS } from "@/utils/omza.utils";

// Helper to get badge color based on score
const getBadgeColor = (value: number | null) => {
  if (value == null) return "bg-gray-100 text-gray-500 border-gray-200";
  if (value < 2.0) return "bg-red-50 text-red-700 border-red-200";
  if (value < 3.0) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
};

// Category labels mapping
const CATEGORY_LABELS: Record<string, string> = {
  O: "Organiseren",
  M: "Meedoen",
  Z: "Zelfvertrouwen",
  A: "Autonomie",
};

// LevelSelector component for icon-based scoring
function LevelSelector({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {ICON_LABELS.map((label, index) => {
        const level = index + 1;
        const isActive = value === level;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(level)}
            className={
              "group flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium transition " +
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
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Component for quick comments grid
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
              {comments.map((comment) => (
                <div key={comment.id} className="group relative inline-flex">
                  <button
                    type="button"
                    className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700"
                    onClick={() => appendStandardComment(studentId, comment.text)}
                  >
                    {comment.text}
                  </button>
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
                </div>
              ))}
            </div>

            <div className="flex gap-1">
              <input
                className="flex-1 h-7 rounded-md border border-gray-300 bg-white px-2 text-[11px] shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Nieuwe opmerking..."
                value={newCommentText}
                onChange={(e) =>
                  setNewCommentTexts((prev) => ({ ...prev, [cat]: e.target.value }))
                }
                onKeyPress={(e) => {
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

export default function OMZAOverviewPage() {
  const evalIdNum = useNumericEvalId();
  const evalId = evalIdNum?.toString() ?? "";

  const [omzaData, setOmzaData] = useState<OmzaDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  
  const [teacherScores, setTeacherScores] = useState<Record<string, number | null>>({});
  const [teacherComments, setTeacherComments] = useState<Record<string, string>>({});
  const [standardComments, setStandardComments] = useState<Record<string, StandardComment[]>>({});
  
  const [savingScores, setSavingScores] = useState<Record<string, boolean>>({});
  const [savingComments, setSavingComments] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<"team" | "name" | "class" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  // Refs for debouncing
  const scoreTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const commentTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  // Load OMZA data
  useEffect(() => {
    if (!evalIdNum) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    omzaService
      .getOmzaData(evalIdNum)
      .then((data) => {
        // Ensure categories are in the correct order: O, M, Z, A
        const categoryOrder = ["O", "M", "Z", "A"];
        const sortedCategories: string[] = [];
        
        // Add categories in the specified order
        categoryOrder.forEach(cat => {
          if (data.categories.indexOf(cat) !== -1) {
            sortedCategories.push(cat);
          }
        });
        
        // Add any other categories that might exist
        data.categories.forEach(cat => {
          if (categoryOrder.indexOf(cat) === -1) {
            sortedCategories.push(cat);
          }
        });
        
        data.categories = sortedCategories;
        
        setOmzaData(data);
        
        // Initialize teacher scores and comments from loaded data
        const scores: Record<string, number | null> = {};
        const comments: Record<string, string> = {};
        
        data.students.forEach((student) => {
          data.categories.forEach((cat) => {
            const key = `${student.student_id}-${cat}`;
            const catScore = student.category_scores[cat];
            if (catScore?.teacher_score != null) {
              scores[key] = catScore.teacher_score;
            }
          });
          
          if (student.teacher_comment) {
            comments[student.student_id] = student.teacher_comment;
          }
        });
        
        setTeacherScores(scores);
        setTeacherComments(comments);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || err?.message || "Laden mislukt");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [evalIdNum]);

  // Load standard comments
  useEffect(() => {
    if (!evalIdNum) return;
    
    omzaService.getStandardComments(evalIdNum).then((comments) => {
      const byCategory: Record<string, StandardComment[]> = {};
      comments.forEach((comment) => {
        if (!byCategory[comment.category]) {
          byCategory[comment.category] = [];
        }
        byCategory[comment.category].push(comment);
      });
      setStandardComments(byCategory);
    });
  }, [evalIdNum]);

  // Show toast notification
  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Save teacher score (icon level)
  const handleScoreChange = useCallback((studentId: number, category: string, level: number) => {
    const key = `${studentId}-${category}`;
    
    setTeacherScores((prev) => ({ ...prev, [key]: level }));
    
    // Clear existing timeout
    if (scoreTimeouts.current[key]) {
      clearTimeout(scoreTimeouts.current[key]);
    }
    
    // Set new timeout for autosave
    scoreTimeouts.current[key] = setTimeout(() => {
      setSavingScores((prev) => ({ ...prev, [key]: true }));
      
      omzaService
        .saveTeacherScore(evalIdNum!, {
          student_id: studentId,
          category,
          score: level,
        })
        .then(() => {
          showToast("Docentscore opgeslagen");
        })
        .catch((err) => {
          showToast(`Fout bij opslaan: ${err?.message || "Onbekende fout"}`);
        })
        .finally(() => {
          setSavingScores((prev) => ({ ...prev, [key]: false }));
        });
    }, 500);
  }, [evalIdNum, showToast]);

  // Debounced save teacher comment
  const handleCommentChange = useCallback((studentId: number, value: string) => {
    setTeacherComments((prev) => ({ ...prev, [studentId]: value }));
    
    // Clear existing timeout
    if (commentTimeouts.current[studentId]) {
      clearTimeout(commentTimeouts.current[studentId]);
    }
    
    // Set new timeout for autosave
    commentTimeouts.current[studentId] = setTimeout(() => {
      setSavingComments((prev) => ({ ...prev, [studentId]: true }));
      
      omzaService
        .saveTeacherComment(evalIdNum!, {
          student_id: studentId,
          comment: value,
        })
        .then(() => {
          showToast("Docentopmerking opgeslagen");
        })
        .catch((err) => {
          showToast(`Fout bij opslaan: ${err?.message || "Onbekende fout"}`);
        })
        .finally(() => {
          setSavingComments((prev) => ({ ...prev, [studentId]: false }));
        });
    }, 500);
  }, [evalIdNum, showToast]);

  // Apply peer scores for all students (map to icon levels)
  const applyPeerScoresAll = useCallback(() => {
    if (!omzaData || !evalIdNum) return;
    
    const updates: Array<Promise<any>> = [];
    const newScores: Record<string, number | null> = { ...teacherScores };
    
    omzaData.students.forEach((student) => {
      omzaData.categories.forEach((cat) => {
        const catScore = student.category_scores[cat];
        if (catScore && catScore.peer_avg != null) {
          const iconLevel = mapPeerScoreToIconLevel(catScore.peer_avg);
          
          const key = `${student.student_id}-${cat}`;
          newScores[key] = iconLevel;
          
          updates.push(
            omzaService.saveTeacherScore(evalIdNum, {
              student_id: student.student_id,
              category: cat,
              score: iconLevel,
            })
          );
        }
      });
    });
    
    setTeacherScores(newScores);
    
    Promise.all(updates)
      .then(() => {
        showToast("Docentscores overgenomen van peer scores");
      })
      .catch((err) => {
        showToast(`Fout bij opslaan: ${err?.message || "Onbekende fout"}`);
      });
  }, [omzaData, evalIdNum, teacherScores, showToast]);

  // Add standard comment to teacher comment
  const appendStandardComment = useCallback((studentId: number, text: string) => {
    const currentComment = teacherComments[studentId] || "";
    const newComment = currentComment ? `${currentComment} ${text}` : text;
    handleCommentChange(studentId, newComment);
  }, [teacherComments, handleCommentChange]);

  // Add new standard comment
  const addStandardComment = useCallback((category: string, text: string) => {
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
      .catch((err) => {
        showToast(`Fout bij toevoegen: ${err?.message || "Onbekende fout"}`);
      });
  }, [evalIdNum, showToast]);

  // Delete standard comment
  const deleteStandardComment = useCallback((commentId: string) => {
    if (!evalIdNum) return;
    
    omzaService
      .deleteStandardComment(evalIdNum, commentId)
      .then(() => {
        // Remove from state
        setStandardComments((prev) => {
          const newComments = { ...prev };
          Object.keys(newComments).forEach((cat) => {
            newComments[cat] = newComments[cat].filter((c) => c.id !== commentId);
          });
          return newComments;
        });
        showToast("Standaardopmerking verwijderd");
      })
      .catch((err) => {
        showToast(`Fout bij verwijderen: ${err?.message || "Onbekende fout"}`);
      });
  }, [evalIdNum, showToast]);

  // Toggle sort
  const handleSort = (column: "team" | "name" | "class") => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Filter and sort students
  const filteredStudents = React.useMemo(() => {
    let filtered = omzaData?.students.filter((student) => {
      const matchesSearch = student.student_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTeam = teamFilter === "all" || student.team_number?.toString() === teamFilter;
      const matchesClass = classFilter === "all" || student.class_name === classFilter;
      return matchesSearch && matchesTeam && matchesClass;
    }) || [];

    // Apply sorting
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: any, bVal: any;
        
        if (sortColumn === "team") {
          aVal = a.team_number || 0;
          bVal = b.team_number || 0;
        } else if (sortColumn === "name") {
          aVal = a.student_name.toLowerCase();
          bVal = b.student_name.toLowerCase();
        } else if (sortColumn === "class") {
          aVal = a.class_name || "";
          bVal = b.class_name || "";
        }
        
        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [omzaData?.students, searchQuery, teamFilter, classFilter, sortColumn, sortDirection]);

  // Get unique teams and classes
  const teams = Array.from(new Set(omzaData?.students.map((s) => s.team_number).filter((t) => t != null)));
  const classes = Array.from(new Set(omzaData?.students.map((s) => s.class_name).filter((c) => c)));

  const tabs = [
    { id: "dashboard", label: "Dashboard", href: `/teacher/evaluations/${evalId}/dashboard` },
    { id: "omza", label: "OMZA", href: `/teacher/evaluations/${evalId}/omza` },
    { id: "grades", label: "Cijfers", href: `/teacher/evaluations/${evalId}/grades` },
    { id: "feedback", label: "Feedback", href: `/teacher/evaluations/${evalId}/feedback` },
    { id: "reflections", label: "Reflecties", href: `/teacher/evaluations/${evalId}/reflections` },
    { id: "settings", label: "Instellingen", href: `/teacher/evaluations/${evalId}/settings` },
  ];

  return (
    <>
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className="bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg">
            {toast}
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <header className="max-w-6xl mx-auto px-6 pt-8 pb-4">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
            OMZA Overzicht
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Overzicht van peer-, self- én docentscores per categorie.
          </p>
        </header>

        {/* Tabs */}
        <nav className="border-t border-gray-200">
          <div className="max-w-6xl mx-auto px-6 flex gap-6 text-sm">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={`-mb-px py-3 border-b-2 text-sm font-medium transition-colors ${
                  tab.id === "omza"
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-6">
        {loading && <Loading />}
        {error && <ErrorMessage message={error} />}

        {!loading && !error && omzaData && (
          <>
            {/* Filters bar */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div className="flex flex-wrap gap-3 items-center">
                <input
                  className="h-9 w-56 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Zoek op naam…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select
                  className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm"
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                >
                  <option value="all">Alle teams</option>
                  {teams.map((team) => (
                    <option key={team} value={team?.toString()}>
                      Team {team}
                    </option>
                  ))}
                </select>
                <select
                  className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm"
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                >
                  <option value="all">Alle klassen</option>
                  {classes.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="h-9 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs md:text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-100 hover:border-indigo-300"
                  onClick={applyPeerScoresAll}
                >
                  Neem peer score over
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-green-500 bg-green-100 text-[11px] text-green-700">
                    🙂
                  </span>
                  <span>Gaat goed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-green-500 bg-green-100 text-[11px] text-green-700">
                    V
                  </span>
                  <span>Voldoet aan verwachting</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-400 bg-amber-100 text-[11px] text-amber-700">
                    !
                  </span>
                  <span>Let op / bespreken</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-rose-500 bg-rose-100 text-[11px] text-rose-700">
                    !!
                  </span>
                  <span>Urgent</span>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="px-5 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide w-20 cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("team")}
                      >
                        <div className="flex items-center gap-1">
                          Team
                          {sortColumn === "team" && (
                            <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-5 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center gap-1">
                          Leerling
                          {sortColumn === "name" && (
                            <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("class")}
                      >
                        <div className="flex items-center gap-1">
                          Klas
                          {sortColumn === "class" && (
                            <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      {omzaData.categories.map((cat) => (
                        <th
                          key={cat}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span>{CATEGORY_LABELS[cat] || cat}</span>
                            <span className="text-[11px] font-normal text-slate-400">
                              Peer • Self • Docent
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {filteredStudents.map((student) => {
                      const isExpanded = expandedRow === student.student_id;

                      return (
                        <React.Fragment key={student.student_id}>
                          <tr
                            className={
                              isExpanded
                                ? "bg-indigo-50/40"
                                : "bg-white hover:bg-gray-50"
                            }
                          >
                            <td className="px-5 py-3 align-top text-xs text-gray-500">
                              {student.team_number && (
                                <span className="inline-flex items-center justify-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                                  {student.team_number}
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3 align-top">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/teacher/evaluations/${evalId}/students/${student.student_id}`}
                                  className="text-sm font-medium text-indigo-700 hover:underline"
                                >
                                  {student.student_name}
                                </Link>
                                <button
                                  type="button"
                                  className="inline-flex items-center rounded-full border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-50"
                                  onClick={() =>
                                    setExpandedRow(isExpanded ? null : student.student_id)
                                  }
                                  title="Open docentopmerking"
                                >
                                  💬
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-3 align-top text-xs text-gray-500">
                              {student.class_name}
                            </td>

                            {omzaData.categories.map((cat) => {
                              const catScore = student.category_scores[cat];
                              const key = `${student.student_id}-${cat}`;
                              const teacherValue = teacherScores[key];

                              return (
                                <td key={cat} className="px-4 py-3 align-middle">
                                  <div className="flex flex-col gap-1.5">
                                    <div className="flex flex-wrap gap-1 text-[11px] text-slate-500">
                                      <span className="rounded-full bg-slate-100 px-2 py-0.5">
                                        Peer: {catScore?.peer_avg?.toFixed(1) || "—"}
                                      </span>
                                      <span className="rounded-full bg-slate-100 px-2 py-0.5">
                                        Self: {catScore?.self_avg?.toFixed(1) || "—"}
                                      </span>
                                    </div>
                                    <LevelSelector
                                      value={teacherValue ?? null}
                                      onChange={(level) =>
                                        handleScoreChange(student.student_id, cat, level)
                                      }
                                    />
                                  </div>
                                </td>
                              );
                            })}
                          </tr>

                          {/* Inline expanded row */}
                          {isExpanded && (
                            <tr className="bg-indigo-50/60">
                              <td
                                colSpan={3 + omzaData.categories.length}
                                className="px-5 pb-4 pt-0"
                              >
                                <div className="pt-2 flex flex-col gap-3">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-medium text-gray-700">
                                      Docentopmerking voor {student.student_name}
                                    </p>
                                    <span className="text-[11px] text-gray-500">
                                      Tip: klik op een quick comment om deze toe te voegen.
                                    </span>
                                  </div>

                                  <OmzaQuickCommentsGrid
                                    categories={omzaData.categories}
                                    standardComments={standardComments}
                                    studentId={student.student_id}
                                    appendStandardComment={appendStandardComment}
                                    addStandardComment={addStandardComment}
                                    deleteStandardComment={deleteStandardComment}
                                  />

                                  <div className="mt-3">
                                    <textarea
                                      className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                                      rows={4}
                                      placeholder="Eigen notitie of motivatie over het samenwerken in dit project…"
                                      value={teacherComments[student.student_id] || ""}
                                      onChange={(e) =>
                                        handleCommentChange(student.student_id, e.target.value)
                                      }
                                      disabled={savingComments[student.student_id]}
                                    />
                                    {savingComments[student.student_id] && (
                                      <span className="text-[10px] text-gray-500">
                                        Opslaan...
                                      </span>
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

              {/* Footer */}
              <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-xs text-slate-500">
                <p className="mb-1 font-medium">Leeswijzer</p>
                <p>
                  De icoontjes geven per categorie het niveau aan dat jij als docent
                  inschat. Peer- en selfscores uit de peerreview worden apart
                  weergegeven op de detailpagina van de leerling.
                </p>
              </div>
            </div>
          </>
        )}

        {evalIdNum == null && (
          <p className="text-sm text-gray-500">
            Geen geldige evaluatie geselecteerd.
          </p>
        )}
      </main>
    </>
  );
}
