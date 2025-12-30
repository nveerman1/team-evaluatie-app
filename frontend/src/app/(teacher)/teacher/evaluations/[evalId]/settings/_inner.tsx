"use client";

import api from "@/lib/api";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { RubricListResponse, RubricListItem } from "@/lib/rubric-types";
import { useCourses } from "@/hooks";
import { projectService } from "@/services";
import type { ProjectListItem } from "@/dtos/project.dto";

type EvaluationOut = {
  id: number;
  title: string;
  course_id: number;
  cluster: string | null; // kept for backward compat (course name)
  project_id?: number | null;
  rubric_id?: number | null;
  settings?: any;
};

type SavePayload = {
  title: string;
  course_id: number;
  project_id: number;
  rubric_id: number;
  settings: any;
};

export default function EvaluationSettingsPageInner() {
  const { evalId } = useParams<{ evalId: string }>();
  const router = useRouter();

  // Data
  const [evaluation, setEvaluation] = useState<EvaluationOut | null>(null);
  const [rubrics, setRubrics] = useState<RubricListItem[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const { courses, courseNameById } = useCourses();

  // UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Form
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState<number | "">("");
  const [projectId, setProjectId] = useState<number | "">("");
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

  // Filter projects based on selected course
  const filteredProjects = useMemo(() => {
    if (!courseId || typeof courseId !== "number") return [];
    return projects.filter(p => p.course_id === Number(courseId));
  }, [projects, courseId]);

  function toDateOnly(s: string) {
    if (!s) return "";
    const i = s.indexOf("T");
    return i > 0 ? s.slice(0, i) : s;
  }

  // Load eval + rubrics + projects
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [evRes, rubRes, projRes] = await Promise.all([
          api.get<EvaluationOut>(`/evaluations/${evalId}`),
          api.get<RubricListResponse>(`/rubrics?scope=peer`),
          projectService.listProjects(),
        ]);

        if (!mounted) return;

        const ev = evRes.data;
        setEvaluation(ev);

        const list = Array.isArray(rubRes.data?.items) ? rubRes.data.items : [];
        setRubrics(list);

        setProjects(projRes.items || []);

        // Init form vanuit evaluatie
        setTitle(ev.title ?? "");
        setCourseId(ev.course_id ?? "");
        setProjectId(ev.project_id ?? "");
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
      if (!courseId || !projectId || !rubricId) {
        throw new Error("Kies een course, project én een rubric.");
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
        project_id: Number(projectId),
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

  return (
    <>
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

        {/* Course (verplicht) + Project + Rubric */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-900">Course</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={courseId === "" ? "" : Number(courseId)}
              onChange={(e) => {
                setCourseId(e.target.value ? Number(e.target.value) : "");
                setProjectId(""); // Reset project when course changes
              }}
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
            <label className="block text-sm font-medium text-slate-900">Project</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={projectId === "" ? "" : Number(projectId)}
              onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : "")}
              required
              disabled={anyLoading || !courseId}
            >
              <option value="">— Kies project —</option>
              {filteredProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Alle teams van dit project zijn gekoppeld aan deze evaluatie.
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
            disabled={saving || anyLoading || !courseId || rubricId === "" || projectId === ""}
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
    </>
  );
}
