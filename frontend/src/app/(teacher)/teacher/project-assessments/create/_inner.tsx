"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import api, { ApiAuthError } from "@/lib/api";
import { projectAssessmentService, rubricService } from "@/services";
import { RubricListItem, ProjectAssessmentCreate } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";

type Group = {
  id: number;
  name: string;
  team_number?: number | null;
};

export default function CreateProjectAssessmentInner() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rubrics, setRubrics] = useState<RubricListItem[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const [title, setTitle] = useState("");
  const [rubricId, setRubricId] = useState<number | "">("");
  const [groupId, setGroupId] = useState<number | "">("");
  const [version, setVersion] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        // Load project rubrics
        const rubricResponse = await rubricService.getRubrics("", "project");
        setRubrics(rubricResponse.items || []);

        // Load teams from the students/teams endpoint
        const groupsResponse = await api.get<Group[]>("/students/teams");
        setGroups(Array.isArray(groupsResponse.data) ? groupsResponse.data : []);
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
    if (!rubricId || !groupId) {
      setError("Selecteer een rubric en team");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: ProjectAssessmentCreate = {
        title,
        rubric_id: Number(rubricId),
        group_id: Number(groupId),
        version: version || undefined,
        metadata_json: {},
      };
      const result = await projectAssessmentService.createProjectAssessment(
        payload
      );
      router.push(`/teacher/project-assessments/${result.id}/edit`);
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
        <h1 className="text-2xl font-semibold">Nieuwe projectbeoordeling</h1>
        <p className="text-gray-600">
          Maak een projectbeoordeling aan voor een team.
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
            Titel <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Bijv. Projectbeoordeling periode 1"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">
            Projectrubric <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={rubricId}
            onChange={(e) => setRubricId(Number(e.target.value) || "")}
            required
          >
            <option value="">-- Selecteer rubric --</option>
            {rubrics.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title} ({r.criteria_count} criteria)
              </option>
            ))}
          </select>
          {rubrics.length === 0 && (
            <p className="text-sm text-amber-600">
              Geen projectrubrics gevonden. Maak eerst een rubric met scope
              &apos;project&apos; aan.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">
            Team <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={groupId}
            onChange={(e) => setGroupId(Number(e.target.value) || "")}
            required
          >
            <option value="">-- Selecteer team --</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {g.team_number ? ` (Team ${g.team_number})` : ""}
              </option>
            ))}
          </select>
          {groups.length === 0 && (
            <p className="text-sm text-amber-600">
              Geen teams gevonden. Maak eerst teams aan in de admin sectie.
            </p>
          )}
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
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || rubrics.length === 0 || groups.length === 0}
            className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
          >
            {saving ? "Opslaan…" : "Opslaan & verder"}
          </button>
          <a
            href="/teacher/project-assessments"
            className="px-4 py-2 rounded-xl border"
          >
            Annuleer
          </a>
        </div>
      </form>
    </main>
  );
}
