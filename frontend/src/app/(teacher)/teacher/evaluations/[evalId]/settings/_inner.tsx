"use client";

import api from "@/lib/api";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { RubricListResponse, RubricListItem } from "@/lib/rubric-types";
import { useCourses } from "@/hooks";

type EvaluationOut = {
  id: number;
  title: string;
  course_id: number;
  cluster: string | null; // kept for backward compat (course name)
  rubric_id?: number | null;
  settings?: any;
};

type SavePayload = {
  title: string;
  course_id: number;
  rubric_id: number;
  settings: any;
};

export default function EvaluationSettingsPageInner() {
  const { evalId } = useParams<{ evalId: string }>();
  const router = useRouter();

  // Data
  const [evaluation, setEvaluation] = useState<EvaluationOut | null>(null);
  const [rubrics, setRubrics] = useState<RubricListItem[]>([]);
  const { courses, courseNameById } = useCourses();

  // UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Form
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState<number | "">("");
  const [rubricId, setRubricId] = useState<number | "">("");
  const [reviewDeadline, setReviewDeadline] = useState("");
  const [reflectionDeadline, setReflectionDeadline] = useState("");
  const [anonymity, setAnonymity] = useState<"none" | "pseudonym" | "full">(
    "pseudonym",
  );
  const [minWords, setMinWords] = useState<number>(50);
  const [minCf, setMinCf] = useState<number>(0.6);
  const [maxCf, setMaxCf] = useState<number>(1.4);
  const [smoothing, setSmoothing] = useState<boolean>(true);
  const [reviewerRating, setReviewerRating] = useState<boolean>(true);

  function toDateOnly(s: string) {
    if (!s) return "";
    const i = s.indexOf("T");
    return i > 0 ? s.slice(0, i) : s;
  }

  // Load eval + rubrics
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [evRes, rubRes] = await Promise.all([
          api.get<EvaluationOut>(`/evaluations/${evalId}`),
          api.get<RubricListResponse>(`/rubrics?scope=peer`),
        ]);

        if (!mounted) return;

        const ev = evRes.data;
        setEvaluation(ev);

        const list = Array.isArray(rubRes.data?.items) ? rubRes.data.items : [];
        setRubrics(list);

        // Init form vanuit evaluatie
        setTitle(ev.title ?? "");
        setCourseId(ev.course_id ?? "");
        setRubricId(ev.rubric_id ?? "");
        const s = ev.settings || {};
        setAnonymity(s.anonymity ?? "pseudonym");
        setMinWords(Number.isFinite(s.min_words) ? s.min_words : 50);
        const r1 =
          s.deadlines?.review ?? s.review_deadline ?? s.deadline_reviews;
        const r2 =
          s.deadlines?.reflection ??
          s.reflection_deadline ??
          s.deadline_reflection;
        setReviewDeadline(r1 || "");
        setReflectionDeadline(r2 || "");
        setMinCf(Number.isFinite(s.min_cf) ? s.min_cf : 0.6);
        setMaxCf(Number.isFinite(s.max_cf) ? s.max_cf : 1.4);
        setSmoothing(Boolean(s.smoothing ?? true));
        setReviewerRating(Boolean(s.reviewer_rating ?? true));
      } catch (e: any) {
        setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [evalId]);

  // Preselecteer course als er precies één is en form leeg is
  useEffect(() => {
    if (!courseId && courses.length === 1) {
      setCourseId(courses[0].id);
    }
  }, [courseId, courses]);

  const selectedRubric = useMemo(
    () => rubrics.find((r) => r.id === rubricId),
    [rubrics, rubricId],
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setInfo(null);

    try {
      if (!courseId || rubricId === "") {
        throw new Error("Kies een course én een rubric.");
      }

      const settings = {
        anonymity,
        min_words: Number(minWords) || 0,
        min_cf: Number(minCf) || 0,
        max_cf: Number(maxCf) || 0,
        smoothing: Boolean(smoothing),
        reviewer_rating: Boolean(reviewerRating),
        deadlines: {
          review: toDateOnly(reviewDeadline) || null,
          reflection: toDateOnly(reflectionDeadline) || null,
        },
      };

      const payload: SavePayload = {
        title: (title || "").trim(),
        course_id: Number(courseId),
        rubric_id: Number(rubricId),
        settings,
      };

      await api.put(`/evaluations/${evalId}`, payload);
      setInfo("Opgeslagen ✔");
      setTimeout(() => setInfo(null), 1500);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  const anyLoading = loading;
  const evalIdStr = String(evalId);

  if (loading) return <main className="p-6">Laden…</main>;
  
  const tabs = [
    { id: "dashboard", label: "Dashboard", href: `/teacher/evaluations/${evalIdStr}/dashboard` },
    { id: "omza", label: "OMZA", href: `/teacher/evaluations/${evalIdStr}/omza` },
    { id: "grades", label: "Cijfers", href: `/teacher/evaluations/${evalIdStr}/grades` },
    { id: "feedback", label: "Feedback", href: `/teacher/evaluations/${evalIdStr}/feedback` },
    { id: "reflections", label: "Reflecties", href: `/teacher/evaluations/${evalIdStr}/reflections` },
    { id: "settings", label: "Instellingen", href: `/teacher/evaluations/${evalIdStr}/settings` },
  ];

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-slate-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
              Instellingen
            </h1>
            <p className="text-slate-600 mt-1 text-sm">
              Evaluatie #{evaluation?.id} — {evaluation?.title}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/teacher/evaluations"
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              Terug
            </Link>
            <button
              onClick={handleSave}
              disabled={saving || anyLoading || !courseId || rubricId === ""}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Opslaan…" : "Opslaan"}
            </button>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Tabs Navigation */}
        <div className="border-b border-slate-200">
          <nav className="flex gap-6 text-sm" aria-label="Tabs">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={`py-3 border-b-2 -mb-px transition-colors ${
                  tab.id === "settings"
                    ? "border-blue-600 text-blue-700 font-medium"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                }`}
                aria-current={tab.id === "settings" ? "page" : undefined}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200">
            {error}
          </div>
        )}
        {info && (
          <div className="p-3 rounded-xl bg-green-50 text-green-700 border border-green-200">{info}</div>
        )}

        <form
          onSubmit={handleSave}
          className="bg-white border border-slate-200 rounded-2xl p-5 space-y-6 shadow-sm"
        >
        {/* Titel */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-900">Titel</label>
          <input
            className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        {/* Course (verplicht) + Rubric */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-900">Course</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={courseId === "" ? "" : Number(courseId)}
              onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : "")}
              required
              disabled={anyLoading}
            >
              <option value="">— Kies course —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Dit bepaalt welke leerlingen in de cijfers-/reviewpagina’s
              verschijnen.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-900">Rubric</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={rubricId === "" ? "" : Number(rubricId)}
              onChange={(e) =>
                setRubricId(e.target.value ? Number(e.target.value) : "")
              }
              required
              disabled={anyLoading}
            >
              <option value="">— Kies rubric —</option>
              {rubrics.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title ?? `Rubric #${r.id}`}
                </option>
              ))}
            </select>
            {selectedRubric && (
              <p className="text-xs text-slate-500 mt-1">
                Gekozen: {selectedRubric.title} (id: {selectedRubric.id})
              </p>
            )}
          </div>
        </div>

        {/* Deadlines */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-900">
              Deadline Reviews
            </label>
            <input
              type="datetime-local"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={reviewDeadline}
              onChange={(e) => setReviewDeadline(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-900">
              Deadline Reflectie
            </label>
            <input
              type="datetime-local"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={reflectionDeadline}
              onChange={(e) => setReflectionDeadline(e.target.value)}
            />
          </div>
        </div>

        {/* Overige instellingen */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-900">
              Minimum woorden/review
            </label>
            <input
              type="number"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={minWords}
              onChange={(e) => setMinWords(e.target.valueAsNumber || 0)}
              min={0}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-900">
              Correctiefactor-range
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={minCf}
                onChange={(e) => setMinCf(e.target.valueAsNumber || 0)}
              />
              <input
                type="number"
                step="0.1"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={maxCf}
                onChange={(e) => setMaxCf(e.target.valueAsNumber || 0)}
              />
            </div>
            <p className="text-xs text-slate-500">Bijv. 0.6 – 1.4</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving || anyLoading || !courseId || rubricId === ""}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 shadow-sm"
          >
            {saving ? "Opslaan…" : "Opslaan"}
          </button>
          <a
            href="/teacher/evaluations"
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 shadow-sm"
          >
            Terug
          </a>
        </div>
        </form>
      </div>
    </>
  );
}
