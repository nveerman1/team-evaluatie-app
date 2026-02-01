"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import api, { ApiAuthError } from "@/lib/api";
import { projectPlanService, projectService } from "@/services";
import { ProjectPlanCreate } from "@/dtos/projectplan.dto";
import { Loading, ErrorMessage } from "@/components";
import type { ProjectListItem } from "@/dtos/project.dto";
import { useCourses } from "@/hooks";

export default function CreateProjectPlanInner() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const { courses } = useCourses();

  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState<number | "">("");
  const [projectId, setProjectId] = useState<number | "">("");
  const [version, setVersion] = useState("");

  // Filter projects based on selected course
  const filteredProjects = useMemo(() => {
    if (typeof courseId !== "number") return [];
    return projects.filter((p) => p.course_id === Number(courseId));
  }, [projects, courseId]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        // Load projects
        const projectsResponse = await projectService.listProjects();
        setProjects(projectsResponse.items || []);
      } catch (e: any) {
        setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!courseId) {
      setError("Selecteer een course");
      return;
    }
    if (!projectId) {
      setError("Selecteer een project");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: ProjectPlanCreate = {
        project_id: Number(projectId),
        title: title || undefined,
      };
      const result = await projectPlanService.createProjectPlan(payload);
      router.push(`/teacher/projectplans/${result.id}`);
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
        <h1 className="text-2xl font-semibold">Nieuw projectplan</h1>
        <p className="text-gray-600">
          Maak een projectplan aan voor een project.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 bg-white p-5 rounded-2xl border"
      >
        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700">{error}</div>
        )}

        <div className="space-y-1">
          <label className="block text-sm font-medium">
            Titel (optioneel)
          </label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Bijv. Projectplan periode 1"
          />
          <p className="text-xs text-gray-500">
            Laat leeg om standaard titel te gebruiken
          </p>
        </div>

        {/* Course & Project */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium">
              Course <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border rounded-lg"
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value ? Number(e.target.value) : "");
                setProjectId(""); // Reset project when course changes
              }}
              required
              disabled={loading}
            >
              <option value="">— Kies course —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">
              Bepaalt welke projecten beschikbaar zijn.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium">
              Project <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border rounded-lg"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value ? Number(e.target.value) : "");
              }}
              required
              disabled={loading || !courseId}
            >
              <option value="">— Kies project —</option>
              {filteredProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">
              Het project waarvoor dit projectplan is.
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">
            Versie (optioneel)
          </label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="Bijv. tussentijds, eind"
          />
          <p className="text-xs text-gray-500">
            Vrij veld voor versie-aanduiding
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || courses.length === 0 || !courseId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {saving ? "Opslaan..." : "Aanmaken"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Annuleren
          </button>
        </div>
      </form>
    </main>
  );
}
