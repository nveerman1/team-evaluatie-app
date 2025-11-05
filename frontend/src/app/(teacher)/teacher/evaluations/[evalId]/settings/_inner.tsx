"use client";

import api from "@/lib/api";
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

  if (loading) return <main className="p-6">Laden…</main>;

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Evaluatie-instellingen</h1>
          <p className="text-gray-600 text-sm">
            Evaluatie #{evaluation?.id} — {evaluation?.title}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/teacher/evaluations"
            className="px-3 py-2 rounded-lg border"
          >
            Terug
          </a>
          <button
            onClick={handleSave}
            disabled={saving || anyLoading || !courseId || rubricId === ""}
            className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
          >
            {saving ? "Opslaan…" : "Opslaan"}
          </button>
        </div>
      </header>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700">
          {error}
        </div>
      )}
      {info && (
        <div className="p-3 rounded-lg bg-green-50 text-green-700">{info}</div>
      )}

      <form
        onSubmit={handleSave}
        className="bg-white border rounded-2xl p-5 space-y-6"
      >
        {/* Titel */}
        <div className="space-y-1">
          <label className="block text-sm font-medium">Titel</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        {/* Course (verplicht) + Rubric */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium">Course</label>
            <select
              className="w-full px-3 py-2 border rounded-lg"
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
            <p className="text-xs text-gray-500">
              Dit bepaalt welke leerlingen in de cijfers-/reviewpagina’s
              verschijnen.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium">Rubric</label>
            <select
              className="w-full px-3 py-2 border rounded-lg"
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
              <p className="text-xs text-gray-500 mt-1">
                Gekozen: {selectedRubric.title} (id: {selectedRubric.id})
              </p>
            )}
          </div>
        </div>

        {/* Deadlines */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium">
              Deadline Reviews
            </label>
            <input
              type="datetime-local"
              className="w-full border rounded-lg px-3 py-2"
              value={reviewDeadline}
              onChange={(e) => setReviewDeadline(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium">
              Deadline Reflectie
            </label>
            <input
              type="datetime-local"
              className="w-full border rounded-lg px-3 py-2"
              value={reflectionDeadline}
              onChange={(e) => setReflectionDeadline(e.target.value)}
            />
          </div>
        </div>

        {/* Overige instellingen */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium">Anonimiteit</label>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={anonymity}
              onChange={(e) => setAnonymity(e.target.value as any)}
            >
              <option value="none">Geen</option>
              <option value="pseudonym">Pseudoniem</option>
              <option value="full">Volledig anoniem</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium">
              Minimum woorden/review
            </label>
            <input
              type="number"
              className="w-full border rounded-lg px-3 py-2"
              value={minWords}
              onChange={(e) => setMinWords(e.target.valueAsNumber || 0)}
              min={0}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium">
              Correctiefactor-range
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                className="w-full border rounded-lg px-3 py-2"
                value={minCf}
                onChange={(e) => setMinCf(e.target.valueAsNumber || 0)}
              />
              <input
                type="number"
                step="0.1"
                className="w-full border rounded-lg px-3 py-2"
                value={maxCf}
                onChange={(e) => setMaxCf(e.target.valueAsNumber || 0)}
              />
            </div>
            <p className="text-xs text-gray-500">Bijv. 0.6 – 1.4</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4"
              checked={smoothing}
              onChange={(e) => setSmoothing(e.target.checked)}
            />
            <span className="text-sm">Smoothing (stabiliseer cijfers)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4"
              checked={reviewerRating}
              onChange={(e) => setReviewerRating(e.target.checked)}
            />
            <span className="text-sm">Beoordeel reviewers mee</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving || anyLoading || !courseId || rubricId === ""}
            className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
          >
            {saving ? "Opslaan…" : "Opslaan"}
          </button>
          <a
            href="/teacher/evaluations"
            className="px-4 py-2 rounded-xl border"
          >
            Terug
          </a>
        </div>
      </form>
    </main>
  );
}
