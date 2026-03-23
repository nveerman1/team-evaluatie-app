"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { projectFeedbackService, projectService } from "@/services";
import { ProjectFeedbackQuestionIn } from "@/dtos/project-feedback.dto";
import type { ProjectListItem } from "@/dtos/project.dto";
import { ApiAuthError } from "@/lib/api";
import { Loading, ErrorMessage } from "@/components";

const DEFAULT_QUESTIONS: ProjectFeedbackQuestionIn[] = [
  { question_text: "Het project was leerzaam", question_type: "rating", order: 1, is_required: true },
  { question_text: "Het project was interessant", question_type: "rating", order: 2, is_required: true },
  { question_text: "Het project voelde als een echte opdracht", question_type: "rating", order: 3, is_required: true },
  { question_text: "De moeilijkheidsgraad was passend", question_type: "rating", order: 4, is_required: true },
  { question_text: "Wat werkte goed in dit project?", question_type: "open", order: 5, is_required: false },
  { question_text: "De opdracht was duidelijk", question_type: "rating", order: 6, is_required: true },
  { question_text: "Het project was goed georganiseerd", question_type: "rating", order: 7, is_required: true },
  { question_text: "Ik had voldoende tijd", question_type: "rating", order: 8, is_required: true },
  { question_text: "Ik wist tijdens het project welke stap we moesten doen (bijv. onderzoek, ideeën, ontwerp)", question_type: "rating", order: 9, is_required: true },
  { question_text: "Wat zou je verbeteren aan de organisatie?", question_type: "open", order: 10, is_required: false },
  { question_text: "De feedback van de docent hielp mij verder", question_type: "rating", order: 11, is_required: true },
  { question_text: "Ik kon op tijd hulp krijgen", question_type: "rating", order: 12, is_required: true },
  { question_text: "Hoe kan de begeleiding beter?", question_type: "open", order: 13, is_required: false },
  { question_text: "Mijn team werkte goed samen tijdens het project", question_type: "rating", order: 14, is_required: true },
  { question_text: "Welk cijfer geef je dit project?", question_type: "scale10", order: 15, is_required: true },
  { question_text: "Ik zou dit project aanraden aan andere leerlingen", question_type: "rating", order: 16, is_required: true },
  { question_text: "Wat is je belangrijkste tip voor verbetering?", question_type: "open", order: 17, is_required: false },
];

const TYPE_LABELS: Record<string, string> = {
  rating: "Likert (1–5)",
  scale10: "Cijfer (1–10)",
  open: "Open vraag",
};

function CreateFeedbackRoundInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledProjectId = searchParams.get("project_id");

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<number | "">(
    prefilledProjectId ? Number(prefilledProjectId) : ""
  );
  const [questions, setQuestions] = useState<ProjectFeedbackQuestionIn[]>(
    DEFAULT_QUESTIONS.map((q) => ({ ...q }))
  );

  useEffect(() => {
    async function load() {
      try {
        const resp = await projectService.listProjects({ per_page: 100 });
        setProjects(resp.items || []);
      } catch (e: any) {
        setError(e?.message || "Laden mislukt");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function updateQuestion(index: number, field: keyof ProjectFeedbackQuestionIn, value: string | boolean | number) {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  function addQuestion() {
    setQuestions((prev) => [
      ...prev,
      {
        question_text: "",
        question_type: "open",
        order: prev.length + 1,
        is_required: false,
      },
    ]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) { setError("Selecteer een project"); return; }
    if (!title.trim()) { setError("Vul een titel in"); return; }

    setSaving(true);
    setError(null);
    try {
      const round = await projectFeedbackService.createRound({
        project_id: Number(projectId),
        title: title.trim(),
        questions: questions.filter((q) => q.question_text.trim()),
      });
      router.push(`/teacher/project-feedback/${round.id}`);
    } catch (e: any) {
      if (e instanceof ApiAuthError) {
        setError(e.originalMessage);
      } else {
        setError(e?.response?.data?.detail || e?.message || "Opslaan mislukt");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Nieuwe projectfeedback
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Stel een feedbackronde in voor een project. Leerlingen vullen daarna de vragenlijst in.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Basic info */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Basisinformatie</h2>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Project <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : "")}
              required
            >
              <option value="">— Selecteer een project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Titel <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bijv. Projectfeedback periode 1"
              required
            />
          </div>
        </section>

        {/* Questions */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              Vragen ({questions.length})
            </h2>
            <button
              type="button"
              onClick={addQuestion}
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              + Vraag toevoegen
            </button>
          </div>

          <div className="space-y-2">
            {questions.map((q, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3"
              >
                <span className="mt-2 text-xs font-semibold text-gray-400 w-5 shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 space-y-2">
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={q.question_text}
                    onChange={(e) => updateQuestion(i, "question_text", e.target.value)}
                    placeholder="Vraag tekst"
                  />
                  <div className="flex items-center gap-3">
                    <select
                      className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={q.question_type}
                      onChange={(e) => updateQuestion(i, "question_type", e.target.value)}
                    >
                      {Object.entries(TYPE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={q.is_required}
                        onChange={(e) => updateQuestion(i, "is_required", e.target.checked)}
                        className="rounded"
                      />
                      Verplicht
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeQuestion(i)}
                  className="mt-1 text-gray-400 hover:text-red-500 text-xs px-1"
                  title="Verwijder vraag"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annuleren
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Opslaan…" : "Feedbackronde aanmaken"}
          </button>
        </div>
      </form>
    </main>
  );
}

export default function CreateProjectFeedbackPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CreateFeedbackRoundInner />
    </Suspense>
  );
}
