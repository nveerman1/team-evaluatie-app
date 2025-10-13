"use client";

import api from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

// Types (optioneel importeren uit je lib/types):
type RubricOut = {
  id: number;
  title: string;
  scale_min: number;
  scale_max: number;
};
type CriterionOut = {
  id: number;
  rubric_id: number;
  name: string;
  weight: number;
  order?: number | null;
  descriptors: {
    level1?: string;
    level2?: string;
    level3?: string;
    level4?: string;
    level5?: string;
  };
};
type UpsertItem = {
  id?: number | null;
  name: string;
  weight: number;
  order?: number | null;
  descriptors: {
    level1?: string;
    level2?: string;
    level3?: string;
    level4?: string;
    level5?: string;
  };
};

const EMPTY_DESC = {
  level1: "",
  level2: "",
  level3: "",
  level4: "",
  level5: "",
};

export default function EditRubricPage() {
  const { rubricId } = useParams<{ rubricId: string }>();
  const router = useRouter();

  const [rubric, setRubric] = useState<RubricOut | null>(null);
  const [items, setItems] = useState<UpsertItem[]>([]);
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
            order: ci.order ?? null,
            descriptors: { ...EMPTY_DESC, ...(ci.descriptors || {}) },
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

  function addCriterion() {
    const maxOrder = items.reduce((m, it) => Math.max(m, it.order ?? 0), 0);
    setItems((prev) => [
      ...prev,
      {
        name: "Nieuw criterium",
        weight: 1.0,
        order: maxOrder + 1,
        descriptors: { ...EMPTY_DESC },
      },
    ]);
  }
  function removeCriterion(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function move(idx: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next.map((it, i) => ({ ...it, order: i + 1 }));
    });
  }

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
          order: it.order ?? i + 1,
          descriptors: {
            level1: it.descriptors?.level1 ?? "",
            level2: it.descriptors?.level2 ?? "",
            level3: it.descriptors?.level3 ?? "",
            level4: it.descriptors?.level4 ?? "",
            level5: it.descriptors?.level5 ?? "",
          },
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

  const totalWeight = useMemo(
    () => items.reduce((s, it) => s + (Number(it.weight) || 0), 0),
    [items],
  );

  if (loading) return <main className="p-6">Laden…</main>;

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
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
        <section className="bg-white border rounded-2xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[28px_1.2fr_0.6fr_1fr_1fr_1fr_1fr_1fr_120px] gap-0 px-4 py-3 bg-gray-50 text-sm font-medium text-gray-600">
            <div>#</div>
            <div>Criterium</div>
            <div>Weging</div>
            <div>Niveau 1</div>
            <div>Niveau 2</div>
            <div>Niveau 3</div>
            <div>Niveau 4</div>
            <div>Niveau 5</div>
            <div className="text-right pr-2">Acties</div>
          </div>

          {/* Rows */}
          {items.map((it, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[28px_1.2fr_0.6fr_1fr_1fr_1fr_1fr_1fr_120px] items-start gap-2 px-4 py-3 border-t text-sm"
            >
              <div className="pt-2">{idx + 1}</div>

              <div>
                <input
                  className="w-full border rounded-lg px-2 py-1"
                  value={it.name}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                />
              </div>

              <div>
                <input
                  type="number"
                  step="0.1"
                  className="w-24 border rounded-lg px-2 py-1"
                  value={
                    Number.isFinite(it.weight)
                      ? it.weight
                      : ((it.weight as any) ?? 0)
                  }
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((x, i) =>
                        i === idx
                          ? { ...x, weight: e.target.valueAsNumber }
                          : x,
                      ),
                    )
                  }
                />
              </div>

              {(
                ["level1", "level2", "level3", "level4", "level5"] as const
              ).map((level) => (
                <div key={level}>
                  <textarea
                    className="w-full border rounded-lg px-2 py-1 min-h-20"
                    value={(it.descriptors?.[level] ?? "") as string}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((x, i) =>
                          i === idx
                            ? {
                                ...x,
                                descriptors: {
                                  ...x.descriptors,
                                  [level]: e.target.value,
                                },
                              }
                            : x,
                        ),
                      )
                    }
                  />
                </div>
              ))}

              <div className="flex items-start justify-end gap-1 pr-2">
                <button
                  className="px-2 py-1 rounded-lg border"
                  onClick={() => move(idx, -1)}
                  title="Omhoog"
                >
                  ↑
                </button>
                <button
                  className="px-2 py-1 rounded-lg border"
                  onClick={() => move(idx, 1)}
                  title="Omlaag"
                >
                  ↓
                </button>
                <button
                  className="px-2 py-1 rounded-lg border text-red-600"
                  onClick={() => removeCriterion(idx)}
                  title="Verwijder"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t bg-gray-50">
            <div className="text-sm text-gray-600">
              Som wegingen:{" "}
              <span className="font-medium">{totalWeight.toFixed(2)}</span>{" "}
              (streef 1.0 of 100%)
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-2 rounded-lg border"
                onClick={addCriterion}
              >
                + Criterium
              </button>
              <button
                className="px-4 py-2 rounded-xl bg-black text-white"
                onClick={saveAll}
                disabled={saving}
              >
                {saving ? "Opslaan…" : "Opslaan"}
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
