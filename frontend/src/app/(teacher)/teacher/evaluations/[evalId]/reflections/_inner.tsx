"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { useNumericEvalId } from "@/lib/id";

type Item = {
  student_id: number;
  student_name: string;
  text: string;
  submitted_at?: string | null;
  words?: number | null;
};

export default function ReflectionsPageInner() {
  const evalIdNum = useNumericEvalId(); // null op /create
  const evalIdStr = evalIdNum != null ? String(evalIdNum) : "";
  const [rows, setRows] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // UI state
  const [query, setQuery] = useState("");
  const [onlySubmitted, setOnlySubmitted] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [minWords, setMinWords] = useState<number>(0);
  const [sort, setSort] = useState<
    "name_asc" | "name_desc" | "date_new" | "date_old" | "words_hi" | "words_lo"
  >("name_asc");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setErr(null);
    if (evalIdNum == null) {
      setRows([]);
      setExpanded({});
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .get(`/evaluations/${evalIdNum}/reflections`)
      .then((r) => {
        const items: Item[] = r.data?.items ?? [];
        setRows(items);
        const map: Record<number, boolean> = {};
        items.forEach((i) => (map[i.student_id] = false));
        setExpanded(map);
      })
      .catch((e) =>
        setErr(e?.response?.data?.detail || e?.message || "Laden mislukt"),
      )
      .finally(() => setLoading(false));
  }, [evalIdNum]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = rows.filter((r) => {
      const submitted = !!r.submitted_at && (r.text?.trim()?.length ?? 0) > 0;
      if (onlySubmitted && !submitted) return false;
      if (onlyMissing && submitted) return false;
      if (minWords && (r.words ?? 0) < minWords) return false;
      if (q) {
        const hay = `${r.student_name ?? ""} ${r.text ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    arr.sort((a, b) => {
      const aDate = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const bDate = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      const aWords = a.words ?? 0,
        bWords = b.words ?? 0;
      switch (sort) {
        case "name_asc":
          return (a.student_name || "").localeCompare(b.student_name || "");
        case "name_desc":
          return (b.student_name || "").localeCompare(a.student_name || "");
        case "date_new":
          return bDate - aDate;
        case "date_old":
          return aDate - bDate;
        case "words_hi":
          return bWords - aWords;
        case "words_lo":
          return aWords - bWords;
      }
    });
    return arr;
  }, [rows, query, onlySubmitted, onlyMissing, minWords, sort]);

  const submittedCount = filtered.filter(
    (r) => !!r.submitted_at && (r.text?.trim()?.length ?? 0) > 0,
  ).length;

  const toggleAll = (open: boolean) => {
    const map: Record<number, boolean> = {};
    filtered.forEach((i) => (map[i.student_id] = open));
    setExpanded(map);
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Reflecties</h1>
        <div className="flex gap-2">
          {evalIdNum != null ? (
            <>
              <a
                href={`/api/v1/evaluations/${evalIdStr}/reflections/export.csv`}
                className="px-3 py-2 rounded-xl border"
              >
                Export CSV
              </a>
              <a
                href={`/teacher/evaluations/${evalIdStr}/dashboard`}
                className="px-3 py-2 rounded-xl border"
              >
                Terug naar dashboard
              </a>
            </>
          ) : (
            <>
              <span className="px-3 py-2 rounded-xl border opacity-60">
                Export CSV
              </span>
              <span className="px-3 py-2 rounded-xl border opacity-60">
                Terug naar dashboard
              </span>
            </>
          )}
        </div>
      </header>

      {/* Filters */}
      <div className="sticky top-0 bg-white/80 backdrop-blur border rounded-2xl p-3 flex flex-wrap items-center gap-3">
        <input
          className="px-3 py-2 border rounded-lg w-80"
          placeholder="Zoek op student/tekst…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="px-3 py-2 border rounded-lg"
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
        >
          <option value="name_asc">Naam A→Z</option>
          <option value="name_desc">Naam Z→A</option>
          <option value="date_new">Datum nieuw → oud</option>
          <option value="date_old">Datum oud → nieuw</option>
          <option value="words_hi">Woorden hoog → laag</option>
          <option value="words_lo">Woorden laag → hoog</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlySubmitted}
            onChange={(e) => {
              setOnlySubmitted(e.target.checked);
              if (e.target.checked) setOnlyMissing(false);
            }}
          />
          Alleen ingeleverd
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(e) => {
              setOnlyMissing(e.target.checked);
              if (e.target.checked) setOnlySubmitted(false);
            }}
          />
          Alleen ontbrekend
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Min. woorden</span>
          <input
            type="number"
            min={0}
            className="px-2 py-1 border rounded w-20"
            value={minWords}
            onChange={(e) => setMinWords(Number(e.target.value || 0))}
          />
        </div>
        <div className="ml-auto flex gap-2">
          <button
            className="px-3 py-2 border rounded-lg"
            onClick={() => toggleAll(true)}
          >
            Alles uitklappen
          </button>
          <button
            className="px-3 py-2 border rounded-lg"
            onClick={() => toggleAll(false)}
          >
            Alles inklappen
          </button>
        </div>
      </div>

      {loading && <div className="text-gray-500">Laden…</div>}
      {err && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700">{err}</div>
      )}

      {!loading && !err && (
        <>
          <div className="text-sm text-gray-600">
            {submittedCount}/{filtered.length} ingeleverd
          </div>

          {filtered.length === 0 ? (
            <div className="text-gray-500">Geen reflecties gevonden.</div>
          ) : (
            <ul className="space-y-4">
              {filtered.map((r) => {
                const open = !!expanded[r.student_id];
                const words = r.words ?? 0;
                const underMin = minWords > 0 && words < minWords;
                const dateLabel = r.submitted_at
                  ? new Date(r.submitted_at).toLocaleString()
                  : "—";
                return (
                  <li
                    key={r.student_id}
                    className="border rounded-2xl bg-white"
                  >
                    <button
                      className="w-full px-4 py-3 border-b flex items-center justify-between text-left"
                      onClick={() =>
                        setExpanded((prev) => ({
                          ...prev,
                          [r.student_id]: !open,
                        }))
                      }
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{r.student_name}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ring-1 ${
                            r.submitted_at
                              ? "ring-green-200 bg-green-50 text-green-700"
                              : "ring-gray-200 bg-gray-50 text-gray-600"
                          }`}
                        >
                          {r.submitted_at ? "ingeleverd" : "ontbreekt"}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ring-1 ${
                            underMin
                              ? "ring-amber-200 bg-amber-50 text-amber-700"
                              : "ring-gray-200 bg-gray-50 text-gray-700"
                          }`}
                        >
                          {words} woorden
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {dateLabel} {open ? "▾" : "▸"}
                      </span>
                    </button>

                    {open && (
                      <div className="p-4">
                        <p className="whitespace-pre-wrap">
                          {r.text || (
                            <em className="text-gray-500">Geen tekst</em>
                          )}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button
                            className="px-2 py-1 border rounded text-sm"
                            onClick={() =>
                              navigator.clipboard.writeText(r.text || "")
                            }
                          >
                            Kopieer tekst
                          </button>
                          <a
                            className="px-2 py-1 border rounded text-sm"
                            href={`data:text/plain;charset=utf-8,${encodeURIComponent(r.text || "")}`}
                            download={`${(r.student_name || "student").replace(/\s+/g, "_")}_reflectie.txt`}
                          >
                            Download .txt
                          </a>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {evalIdNum == null && (
        <p className="text-sm text-gray-500">
          Geen geldige evaluatie geselecteerd.
        </p>
      )}
    </main>
  );
}
