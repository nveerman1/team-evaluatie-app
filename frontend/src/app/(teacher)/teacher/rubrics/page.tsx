"use client";
import api from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { RubricListItem, RubricListResponse } from "@/lib/rubric-types";

export default function RubricsListPage() {
  const [data, setData] = useState<RubricListItem[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchList(query = "") {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      const res = await api.get<RubricListResponse>(
        `/rubrics?${params.toString()}`,
      );
      setData(res.data.items || []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchList();
  }, []);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Rubrics</h1>
          <p className="text-gray-600">
            Beheer je beoordelingsrubrics met criteria op 5 niveaus.
          </p>
        </div>
        <Link
          href="/teacher/rubrics/create"
          className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90"
        >
          + Nieuwe rubric
        </Link>
      </header>

      <section className="flex items-center gap-3">
        <input
          className="border rounded-lg px-3 py-2 w-72"
          placeholder="Zoek op titel/omschrijving…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              fetchList(q.trim());
            }
          }}
        />
        <button
          className="px-3 py-2 rounded-lg border"
          onClick={() => fetchList(q.trim())}
        >
          Zoek
        </button>
        {q && (
          <button
            className="px-3 py-2 rounded-lg border"
            onClick={() => {
              setQ("");
              fetchList("");
            }}
          >
            Reset
          </button>
        )}
      </section>

      <section className="bg-white border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_140px_160px_140px] gap-0 px-4 py-3 bg-gray-50 text-sm font-medium text-gray-600">
          <div>Titel</div>
          <div># Criteria</div>
          <div>Schaal</div>
          <div className="text-right pr-2">Acties</div>
        </div>
        {loading && <div className="p-6 text-gray-500">Laden…</div>}
        {error && !loading && (
          <div className="p-6 text-red-600">Fout: {error}</div>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="p-6 text-gray-500">Geen rubrics gevonden.</div>
        )}
        {!loading &&
          !error &&
          data.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[1fr_140px_160px_140px] items-center gap-0 px-4 py-3 border-t text-sm"
            >
              <div>
                <div className="font-medium">{r.title}</div>
                <div className="text-gray-500 text-xs line-clamp-1">
                  {r.description || "—"}
                </div>
              </div>
              <div>{r.criteria_count}</div>
              <div>
                {r.scale_min}–{r.scale_max}
              </div>
              <div className="flex justify-end gap-2 pr-2">
                <Link
                  href={`/teacher/rubrics/${r.id}/edit`}
                  className="px-2 py-1 rounded-lg border hover:bg-gray-50"
                >
                  Bewerk
                </Link>
                <Link
                  href={`/teacher/evaluations/create?rubric_id=${r.id}`}
                  className="px-2 py-1 rounded-lg border hover:bg-gray-50"
                >
                  Gebruik
                </Link>
              </div>
            </div>
          ))}
      </section>
    </main>
  );
}
