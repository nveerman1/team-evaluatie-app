"use client";

import api from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { RubricListResponse, RubricListItem } from "@/lib/rubric-types";
import { useCourses } from "@/hooks";
import { projectService } from "@/services";
import type { ProjectListItem } from "@/dtos/project.dto";

type EvalCreatePayload = {
  title: string;
  rubric_id: number;
  course_id: number; // verplicht
  project_id?: number | null;
  settings?: {
    deadlines?: {
      review?: string | null; // "YYYY-MM-DD"
      reflection?: string | null; // "YYYY-MM-DD"
    };
    anonymity?: "none" | "pseudonym" | "full";
    min_words?: number;
    min_cf?: number;
    max_cf?: number;
    smoothing?: boolean;
    reviewer_rating?: boolean;
  };
};

export default function CreateEvaluationPageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const preRubricId = sp.get("rubric_id");

  // ---- Data ----
  const [rubrics, setRubrics] = useState<RubricListItem[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const { courses, courseNameById } = useCourses();

  // ---- UI ----
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // ---- Form ----
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState<number | "">("");
  const [projectId, setProjectId] = useState<number | "">("");
  const [rubricId, setRubricId] = useState<number | "">(
    preRubricId ? Number(preRubricId) : "",
  );

  // Voor de UI laten we datetime toe, maar sturen alleen "YYYY-MM-DD"
  const [reviewDeadline, setReviewDeadline] = useState(""); // yyyy-MM-ddTHH:mm
  const [reflectionDeadline, setReflectionDeadline] = useState("");

  // Optionele instellingen
  const [anonymity, setAnonymity] = useState<"none" | "pseudonym" | "full">(
    "pseudonym",
  );
  const [minWords, setMinWords] = useState<number>(50);
  const [minCf, setMinCf] = useState<number>(0.6);
  const [maxCf, setMaxCf] = useState<number>(1.4);
  const [smoothing, setSmoothing] = useState<boolean>(true);
  const [reviewerRating, setReviewerRating] = useState<boolean>(true);

  // Rubrics en projects laden
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [rubRes, projRes] = await Promise.all([
          api.get<RubricListResponse>("/rubrics?scope=peer"),
          projectService.listProjects(),
        ]);
        
        if (!mounted) return;

        const list = Array.isArray(rubRes.data?.items) ? rubRes.data.items : [];
        setRubrics(list);
        if (!preRubricId && list.length === 1) setRubricId(list[0].id);
        
        setProjects(projRes.items || []);
      } catch (e: any) {
        setError(
          e?.response?.data?.detail || e?.message || "Kon data niet laden",
        );
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [preRubricId]);

  // Als er precies één course is, preselecteer
  useEffect(() => {
    if (!courseId && courses.length === 1) {
      setCourseId(courses[0].id);
    }
  }, [courseId, courses]);

  const selectedRubric = useMemo(
    () => rubrics.find((r) => r.id === rubricId),
    [rubrics, rubricId],
  );

  function toDateOnly(s: string) {
    if (!s) return "";
    const i = s.indexOf("T");
    return i > 0 ? s.slice(0, i) : s;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!title.trim()) return setError("Vul een titel in.");
    if (!courseId) return setError("Kies een course.");
    if (rubricId === "" || rubricId == null)
      return setError("Kies een rubric.");

    setSubmitting(true);
    try {
      const payload: EvalCreatePayload = {
        title: title.trim(),
        rubric_id: Number(rubricId),
        course_id: Number(courseId),
        project_id: projectId ? Number(projectId) : null,
        settings: {
          deadlines: {
            review: toDateOnly(reviewDeadline) || null,
            reflection: toDateOnly(reflectionDeadline) || null,
          },
          anonymity,
          min_words: Number(minWords) || 0,
          min_cf: Number(minCf) || 0,
          max_cf: Number(maxCf) || 0,
          smoothing: Boolean(smoothing),
          reviewer_rating: Boolean(reviewerRating),
        },
      };

      await api.post("/evaluations", payload);
      setInfo("Evaluatie aangemaakt ✔");
      router.replace("/teacher/evaluations");
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : detail
            ? JSON.stringify(detail)
            : e?.message || "Aanmaken mislukt",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Verzamel states voor disabled
  const anyLoading = loading;

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Nieuwe evaluatie</h1>
        <div className="flex items-center gap-2">
          <a
            href="/teacher/evaluations"
            className="px-3 py-2 rounded-lg border"
          >
            Terug
          </a>
          <button
            onClick={handleSubmit as any}
            disabled={submitting || anyLoading}
            className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
          >
            {submitting ? "Aanmaken…" : "Aanmaken"}
          </button>
        </div>
      </header>

      {(error) && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 break-words">
          {error}
        </div>
      )}
      {info && (
        <div className="p-3 rounded-lg bg-green-50 text-green-700">{info}</div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white border rounded-2xl p-5 space-y-6"
      >
        {/* Titel */}
        <div className="space-y-1">
          <label className="block text-sm font-medium">Titel</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Bijv. Tussenreview sprint 2"
            required
          />
        </div>

        {/* Course & Project */}
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
              Bepaalt welke leerlingen in reviews/cijfers komen.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium">Project (optioneel)</label>
            <select
              className="w-full px-3 py-2 border rounded-lg"
              value={projectId === "" ? "" : Number(projectId)}
              onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : "")}
              disabled={anyLoading}
            >
              <option value="">— Geen project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">
              Koppel deze evaluatie aan een bestaand project.
            </p>
          </div>
        </div>

        {/* Rubric */}
        <div className="space-y-1">
          <label className="block text-sm font-medium">Rubric</label>
          <select
            className="w-full px-3 py-2 border rounded-lg"
            value={rubricId === "" ? "" : Number(rubricId)}
            onChange={(e) =>
              setRubricId(e.target.value ? Number(e.target.value) : "")
            }
            disabled={anyLoading}
            required
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
              <option value="pseudonym">Pseudoniem (aanbevolen)</option>
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

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting || anyLoading}
            className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
          >
            {submitting ? "Aanmaken…" : "Aanmaken"}
          </button>
          <a
            href="/teacher/evaluations"
            className="px-4 py-2 rounded-xl border"
          >
            Annuleer
          </a>
        </div>
      </form>
    </main>
  );
}
