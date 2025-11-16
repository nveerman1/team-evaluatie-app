"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useNumericEvalId } from "@/utils";
import { Loading, ErrorMessage } from "@/components";
import { omzaService } from "@/services/omza.service";
import { OmzaDataResponse, OmzaStudentData, StandardComment } from "@/dtos/omza.dto";

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

// Component for quick comments grid
function OmzaQuickCommentsGrid({
  categories,
  standardComments,
  studentId,
  appendStandardComment,
  addStandardComment,
}: {
  categories: string[];
  standardComments: Record<string, StandardComment[]>;
  studentId: number;
  appendStandardComment: (studentId: number, text: string) => void;
  addStandardComment: (category: string, text: string) => void;
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
                <button
                  key={comment.id}
                  type="button"
                  className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700"
                  onClick={() => appendStandardComment(studentId, comment.text)}
                >
                  {comment.text}
                </button>
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
  
  const [teacherScores, setTeacherScores] = useState<Record<string, number | "">>({});
  const [teacherComments, setTeacherComments] = useState<Record<string, string>>({});
  const [standardComments, setStandardComments] = useState<Record<string, StandardComment[]>>({});
  
  const [savingScores, setSavingScores] = useState<Record<string, boolean>>({});
  const [savingComments, setSavingComments] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  
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
        setOmzaData(data);
        
        // Initialize teacher scores and comments from loaded data
        const scores: Record<string, number | ""> = {};
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

  // Debounced save teacher score
  const handleScoreChange = useCallback((studentId: number, category: string, value: string) => {
    const key = `${studentId}-${category}`;
    const numValue = value === "" ? "" : Number(value);
    
    setTeacherScores((prev) => ({ ...prev, [key]: numValue }));
    
    // Clear existing timeout
    if (scoreTimeouts.current[key]) {
      clearTimeout(scoreTimeouts.current[key]);
    }
    
    // Set new timeout for autosave
    if (value !== "") {
      scoreTimeouts.current[key] = setTimeout(() => {
        setSavingScores((prev) => ({ ...prev, [key]: true }));
        
        omzaService
          .saveTeacherScore(evalIdNum!, {
            student_id: studentId,
            category,
            score: Number(value),
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
    }
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

  // Apply weighted average for all students
  const applyWeightedAverageAll = useCallback(() => {
    if (!omzaData || !evalIdNum) return;
    
    const updates: Array<Promise<any>> = [];
    const newScores: Record<string, number | ""> = { ...teacherScores };
    
    omzaData.students.forEach((student) => {
      omzaData.categories.forEach((cat) => {
        const catScore = student.category_scores[cat];
        if (catScore && catScore.peer_avg != null && catScore.self_avg != null) {
          const weighted = 0.75 * catScore.peer_avg + 0.25 * catScore.self_avg;
          const roundedScore = Math.round(weighted * 100) / 100;
          
          const key = `${student.student_id}-${cat}`;
          newScores[key] = roundedScore;
          
          updates.push(
            omzaService.saveTeacherScore(evalIdNum, {
              student_id: student.student_id,
              category: cat,
              score: roundedScore,
            })
          );
        }
      });
    });
    
    setTeacherScores(newScores);
    
    Promise.all(updates)
      .then(() => {
        showToast("Docentscores ingevuld op basis van peer/self");
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

  // Filter students
  const filteredStudents = omzaData?.students.filter((student) => {
    const matchesSearch = student.student_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTeam = teamFilter === "all" || student.team_number?.toString() === teamFilter;
    const matchesClass = classFilter === "all" || student.class_name === classFilter;
    return matchesSearch && matchesTeam && matchesClass;
  }) || [];

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
                  onClick={applyWeightedAverageAll}
                >
                  Neem 75% peer + 25% self over
                </button>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Peer ≥ 3,0
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  2,0 – 2,9
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  &lt; 2,0
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide w-20">
                        Team
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide">
                        Leerling
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide">
                        Klas
                      </th>
                      {omzaData.categories.map((cat) => (
                        <th
                          key={cat}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide"
                        >
                          <div className="flex flex-col">
                            <span>{CATEGORY_LABELS[cat] || cat}</span>
                            <span className="text-[10px] text-gray-400 font-normal">
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
                                  #{student.team_number}
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
                              const isSaving = savingScores[key];

                              return (
                                <td key={cat} className="px-4 py-3 align-top">
                                  <div className="flex flex-col gap-1 text-[11px] text-gray-500">
                                    <div className="flex items-center gap-1">
                                      <span
                                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${getBadgeColor(
                                          catScore?.peer_avg || null
                                        )}`}
                                      >
                                        Peer: {catScore?.peer_avg?.toFixed(2) || "-"}
                                      </span>
                                      <span className="text-gray-400">
                                        Self: {catScore?.self_avg?.toFixed(2) || "-"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[11px] text-gray-500">
                                        Docent:
                                      </span>
                                      <input
                                        className="h-7 w-14 rounded-md border border-gray-300 bg-white px-1.5 text-[11px] text-right shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                        value={
                                          teacherValue === "" || teacherValue == null
                                            ? ""
                                            : teacherValue
                                        }
                                        onChange={(e) =>
                                          handleScoreChange(student.student_id, cat, e.target.value)
                                        }
                                        placeholder={catScore?.peer_avg?.toFixed(2) || ""}
                                        disabled={isSaving}
                                      />
                                      <button
                                        type="button"
                                        className="inline-flex items-center rounded-full border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-50"
                                        onClick={() =>
                                          setExpandedRow(isExpanded ? null : student.student_id)
                                        }
                                      >
                                        💬
                                      </button>
                                    </div>
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
              <div className="border-t border-gray-200 bg-gray-50 px-5 py-3 text-xs text-gray-600">
                <span className="font-semibold text-gray-700 mr-1">Leeswijzer:</span>
                Peer- en selfscores zijn gemiddelden van de peerreview. De docent
                kan per categorie een eigen score invullen en één notitieveld per leerling gebruiken.
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
