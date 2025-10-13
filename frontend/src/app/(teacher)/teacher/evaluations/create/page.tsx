"use client";

import api from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { RubricListResponse, RubricListItem } from "@/lib/rubric-types";

type EvalCreateBase = {
  title: string;
  course_id: number | null;
  rubric_id: number | null;
};

type EvalSettings = {
  anonymity: "none" | "pseudonym" | "full";
  min_words: number;
  min_cf: number;
  max_cf: number;
  smoothing: boolean;
  reviewer_rating: boolean;
  deadlines: {
    review: string | null;
    reflection: string | null;
  };
  // legacy sleutels voor oudere backends (schadeloos als genegeerd)
  review_deadline?: string | null;
  reflection_deadline?: string | null;
  deadline_reviews?: string | null;
  deadline_reflection?: string | null;
};

export default function CreateEvaluationPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const preRubricId = sp.get("rubric_id");

  // ---- Data/UI ----
  const [rubrics, setRubrics] = useState<RubricListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // ---- Form (zelfde velden als settings) ----
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState<number | "">("");
  const [rubricId, setRubricId] = useState<number | "">(
    preRubricId ? Number(preRubricId) : "",
  );

  const [reviewDeadline, setReviewDeadline] = useState(""); // yyyy-MM-ddTHH:mm
  const [reflectionDeadline, setReflectionDeadline] = useState("");

  const [anonymity, setAnonymity] = useState<"none" | "pseudonym" | "full">(
    "pseudonym",
  );
  const [minWords, setMinWords] = useState<number>(50);
  const [minCf, setMinCf] = useState<number>(0.6);
  const [maxCf, setMaxCf] = useState<number>(1.4);
  const [smoothing, setSmoothing] = useState<boolean>(true);
  const [reviewerRating, setReviewerRating] = useState<boolean>(true);

  // Rubrics laden
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await api.get<RubricListResponse>("/rubrics");
        if (!mounted) return;
        const list = Array.isArray(r.data?.items) ? r.data.items : [];
        setRubrics(list);
        if (!preRubricId && list.length === 1) setRubricId(list[0].id);
      } catch (e: any) {
        setError(
          e?.response?.data?.detail || e?.message || "Kon rubrics niet laden",
        );
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [preRubricId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    // simpele checks
    if (!title.trim()) return setError("Vul een titel in.");
    if (rubricId === "" || rubricId == null)
      return setError("Kies een rubric.");
    if (courseId === "" || courseId == null)
      return setError("Vul een course_id in.");

    setSubmitting(true);
    try {
      // 1) eerst basis record aanmaken
      const base: EvalCreateBase = {
        title: title.trim(),
        course_id: Number(courseId),
        rubric_id: Number(rubricId),
      };
      const createRes = await api.post("/evaluations", base);
      const newId = createRes.data?.id;
      if (!newId) throw new Error("Geen ID ontvangen na aanmaken.");

      // 2) daarna settings bijwerken (zelfde shape als settings-page)
      const settings: EvalSettings = {
        anonymity,
        min_words: Number(minWords) || 0,
        min_cf: Number(minCf) || 0,
        max_cf: Number(maxCf) || 0,
        smoothing: Boolean(smoothing),
        reviewer_rating: Boolean(reviewerRating),
        deadlines: {
          review: reviewDeadline || "",
          reflection: reflectionDeadline || "",
        },
        // legacy aliasen (veilig)
        review_deadline: reviewDeadline || "",
        reflection_deadline: reflectionDeadline || "",
        deadline_reviews: reviewDeadline || "",
        deadline_reflection: reflectionDeadline || "",
      };
      await api.put(`/evaluations/${newId}`, { settings });

      setInfo("Aangemaakt ✔");
      // 3) terug naar de lijst
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
            disabled={submitting}
            className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
          >
            {submitting ? "Aanmaken…" : "Aanmaken"}
          </button>
        </div>
      </header>

      {error && (
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

        {/* Course & Rubric */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium">Vak / Course ID</label>
            <input
              type="number"
              className="w-full border rounded-lg px-3 py-2"
              value={courseId}
              onChange={(e) =>
                setCourseId(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder="Bijv. 101"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium">Rubric</label>
            <select
              className="w-full px-3 py-2 border rounded-lg"
              value={rubricId === "" ? "" : Number(rubricId)}
              onChange={(e) =>
                setRubricId(e.target.value ? Number(e.target.value) : "")
              }
              disabled={loading}
              required
            >
              <option value="">— Kies rubric —</option>
              {rubrics.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title ?? `Rubric #${r.id}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Deadlines (zelfde inputs als settings) */}
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

        {/* Overige instellingen (exact zoals settings) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium">Anonimiteit</label>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={anonymity}
              onChange={(e) => setAnonymity(e.target.value as any)}
            >
              <option value="none">Geen (alles zichtbaar)</option>
              <option value="pseudonym">Pseudoniemen (aanbevolen)</option>
              <option value="full">Volledig anoniem</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium">
              Minimum woorden per review
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
            disabled={submitting}
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
