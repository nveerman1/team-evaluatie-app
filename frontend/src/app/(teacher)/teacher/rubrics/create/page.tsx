"use client";
import api from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { RubricCreate } from "@/lib/rubric-types";

export default function CreateRubricPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const fromDupId = sp.get("duplicate_of");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scaleMin, setScaleMin] = useState(1);
  const [scaleMax, setScaleMax] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: RubricCreate = {
        title,
        description,
        scale_min: scaleMin,
        scale_max: scaleMax,
        metadata_json: {},
      };
      const res = await api.post("/rubrics", payload);
      const id = res.data?.id;

      if (fromDupId) {
        await api.post(`/rubrics/${fromDupId}/duplicate`);
      }

      router.replace(`/teacher/rubrics/${id}/edit`);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Nieuwe rubric</h1>
        <p className="text-gray-600">
          Maak een rubric aan. Criteria voeg je toe op de volgende pagina.
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
          <label className="block text-sm font-medium">Titel</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">
            Omschrijving (optioneel)
          </label>
          <textarea
            className="w-full border rounded-lg px-3 py-2 min-h-24"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium">Schaal minimum</label>
            <input
              type="number"
              className="w-full border rounded-lg px-3 py-2"
              value={scaleMin}
              onChange={(e) => setScaleMin(e.target.valueAsNumber)}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium">Schaal maximum</label>
            <input
              type="number"
              className="w-full border rounded-lg px-3 py-2"
              value={scaleMax}
              onChange={(e) => setScaleMax(e.target.valueAsNumber)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
          >
            {saving ? "Opslaan…" : "Opslaan & verder"}
          </button>
          <a href="/teacher/rubrics" className="px-4 py-2 rounded-xl border">
            Annuleer
          </a>
        </div>
      </form>
    </main>
  );
}
