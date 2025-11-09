"use client";

import api from "@/lib/api";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import RubricEditor, { type CriterionItem } from "@/components/teacher/RubricEditor";

// Types (optioneel importeren uit je lib/types):
type RubricOut = {
  id: number;
  title: string;
  scale_min: number;
  scale_max: number;
  scope?: string;
};
type CriterionOut = {
  id: number;
  rubric_id: number;
  name: string;
  weight: number;
  category?: string | null;
  order?: number | null;
  descriptors: {
    level1?: string;
    level2?: string;
    level3?: string;
    level4?: string;
    level5?: string;
  };
  learning_objective_ids?: number[];
};

const EMPTY_DESC = {
  level1: "",
  level2: "",
  level3: "",
  level4: "",
  level5: "",
};

export default function EditRubricPageInner() {
  const { rubricId } = useParams<{ rubricId: string }>();
  const router = useRouter();

  const [rubric, setRubric] = useState<RubricOut | null>(null);
  const [items, setItems] = useState<CriterionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [r, c] = await Promise.all([
          api.get<RubricOut>(`/rubrics/${rubricId}`),
          api.get<CriterionOut[]>(`/rubrics/${rubricId}/criteria`),
        ]);
        if (!mounted) return;
        setRubric(r.data);
        setItems(
          (c.data || []).map((ci) => ({
            id: ci.id,
            name: ci.name,
            weight: ci.weight,
            category: ci.category ?? null,
            order: ci.order ?? null,
            descriptors: { ...EMPTY_DESC, ...(ci.descriptors || {}) },
            learning_objective_ids: ci.learning_objective_ids || [],
          })),
        );
      } catch (e: any) {
        setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [rubricId]);



  async function saveAll() {
    if (!rubric) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const payload = {
        items: items.map((it, i) => ({
          id: it.id ?? undefined,
          name: it.name?.trim() || `Criterium ${i + 1}`,
          weight: Number(it.weight) || 1.0,
          category: it.category ?? null,
          order: it.order ?? i + 1,
          descriptors: {
            level1: it.descriptors?.level1 ?? "",
            level2: it.descriptors?.level2 ?? "",
            level3: it.descriptors?.level3 ?? "",
            level4: it.descriptors?.level4 ?? "",
            level5: it.descriptors?.level5 ?? "",
          },
          learning_objective_ids: it.learning_objective_ids || [],
        })),
      };
      const res = await api.put(
        `/rubrics/${rubric.id}/criteria/batch`,
        payload,
      );
      // reflecteer response
      const back = (res.data?.items || []) as CriterionOut[];
      setItems(
        back.map((ci, i) => ({
          id: ci.id,
          name: ci.name,
          weight: ci.weight,
          category: ci.category ?? null,
          order: ci.order ?? i + 1,
          descriptors: { ...EMPTY_DESC, ...(ci.descriptors || {}) },
        })),
      );
      setInfo("Opgeslagen ✔");
      setTimeout(() => setInfo(null), 1800);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  async function duplicateRubric() {
    if (!rubric) return;
    try {
      const res = await api.post(`/rubrics/${rubric.id}/duplicate`);
      const newId = res.data?.id;
      if (newId) router.replace(`/teacher/rubrics/${newId}/edit`);
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.message || "Dupliceren mislukt");
    }
  }
  async function deleteRubric() {
    if (!rubric) return;
    if (!confirm("Weet je zeker dat je deze rubric wilt verwijderen?")) return;
    try {
      await api.delete(`/rubrics/${rubric.id}`);
      router.replace("/teacher/rubrics");
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.message || "Verwijderen mislukt");
    }
  }

  if (loading) return <main className="p-6">Laden…</main>;

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Rubric bewerken</h1>
          {rubric && (
            <p className="text-gray-600 text-sm">
              {rubric.title} · schaal {rubric.scale_min}–{rubric.scale_max}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a href="/teacher/rubrics" className="px-3 py-2 rounded-lg border">
            Terug
          </a>
          <button
            onClick={duplicateRubric}
            className="px-3 py-2 rounded-lg border"
          >
            Dupliceer
          </button>
          <button
            onClick={deleteRubric}
            className="px-3 py-2 rounded-lg border text-red-600"
          >
            Verwijder
          </button>
          <button
            onClick={saveAll}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
          >
            {saving ? "Opslaan…" : "Opslaan"}
          </button>
        </div>
      </header>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700">{error}</div>
      )}
      {info && (
        <div className="p-3 rounded-lg bg-green-50 text-green-700">{info}</div>
      )}

      {rubric && (
        <RubricEditor
          scope={(rubric.scope as "peer" | "project") || "peer"}
          items={items}
          onItemsChange={setItems}
        />
      )}
    </main>
  );
}
