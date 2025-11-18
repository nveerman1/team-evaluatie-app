"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  const [statusFilter, setStatusFilter] = useState<"all" | "submitted" | "missing">("all");
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
      if (statusFilter === "submitted" && !submitted) return false;
      if (statusFilter === "missing" && submitted) return false;
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
  }, [rows, query, statusFilter, sort]);

  const submittedCount = filtered.filter(
    (r) => !!r.submitted_at && (r.text?.trim()?.length ?? 0) > 0,
  ).length;

  const toggleAll = (open: boolean) => {
    const map: Record<number, boolean> = {};
    filtered.forEach((i) => (map[i.student_id] = open));
    setExpanded(map);
  };

  const tabs = [
    { id: "dashboard", label: "Dashboard", href: `/teacher/evaluations/${evalIdStr}/dashboard` },
    { id: "omza", label: "OMZA", href: `/teacher/evaluations/${evalIdStr}/omza` },
    { id: "grades", label: "Cijfers", href: `/teacher/evaluations/${evalIdStr}/grades` },
    { id: "feedback", label: "Feedback", href: `/teacher/evaluations/${evalIdStr}/feedback` },
    { id: "reflections", label: "Reflecties", href: `/teacher/evaluations/${evalIdStr}/reflections` },
    { id: "settings", label: "Instellingen", href: `/teacher/evaluations/${evalIdStr}/settings` },
  ];

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-slate-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
              Reflecties
            </h1>
            <p className="text-slate-600 mt-1 text-sm">
              Bekijk en exporteer studentreflecties
            </p>
          </div>
          {evalIdNum != null && (
            <a
              href={`/api/v1/evaluations/${evalIdStr}/reflections/export.csv`}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              Export CSV
            </a>
          )}
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Tabs Navigation */}
        <div className="border-b border-slate-200">
          <nav className="flex gap-6 text-sm" aria-label="Tabs">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={`py-3 border-b-2 -mb-px transition-colors ${
                  tab.id === "reflections"
                    ? "border-blue-600 text-blue-700 font-medium"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                }`}
                aria-current={tab.id === "reflections" ? "page" : undefined}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Filters */}
        <div className="sticky top-0 bg-white/80 backdrop-blur border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center gap-3 shadow-sm">
        <input
          className="px-3 py-2 border border-slate-200 rounded-xl w-80 focus:outline-none focus:ring-2 focus:ring-blue-600"
          placeholder="Zoek op student/tekst…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
        >
          <option value="all">Alle reflecties</option>
          <option value="submitted">Ingeleverd</option>
          <option value="missing">Ontbrekend</option>
        </select>
        <select
          className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
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
        <div className="ml-auto flex gap-2">
          <button
            className="px-3 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-sm shadow-sm"
            onClick={() => toggleAll(true)}
          >
            Alles uitklappen
          </button>
          <button
            className="px-3 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-sm shadow-sm"
            onClick={() => toggleAll(false)}
          >
            Alles inklappen
          </button>
        </div>
      </div>

      {loading && <div className="text-slate-500">Laden…</div>}
      {err && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200">{err}</div>
      )}

      {!loading && !err && (
        <>
          <div className="text-sm text-slate-600">
            {submittedCount}/{filtered.length} ingeleverd
          </div>

          {filtered.length === 0 ? (
            <div className="text-slate-500">Geen reflecties gevonden.</div>
          ) : (
            <ul className="space-y-4">
              {filtered.map((r) => {
                const open = !!expanded[r.student_id];
                const words = r.words ?? 0;
                const dateLabel = r.submitted_at
                  ? new Date(r.submitted_at).toLocaleString()
                  : "—";
                return (
                  <li
                    key={r.student_id}
                    className="border border-slate-200 rounded-2xl bg-white shadow-sm"
                  >
                    <button
                      className="w-full px-4 py-3 border-b border-slate-200 flex items-center justify-between text-left hover:bg-slate-50"
                      onClick={() =>
                        setExpanded((prev) => ({
                          ...prev,
                          [r.student_id]: !open,
                        }))
                      }
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-900">{r.student_name}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ring-1 ${
                            r.submitted_at
                              ? "ring-green-200 bg-green-50 text-green-700"
                              : "ring-slate-200 bg-slate-50 text-slate-600"
                          }`}
                        >
                          {r.submitted_at ? "ingeleverd" : "ontbreekt"}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full ring-1 ring-slate-200 bg-slate-50 text-slate-700">
                          {words} woorden
                        </span>
                      </div>
                      <span className="text-sm text-slate-500">
                        {dateLabel} {open ? "▾" : "▸"}
                      </span>
                    </button>

                    {open && (
                      <div className="p-4">
                        <p className="whitespace-pre-wrap text-slate-800">
                          {r.text || (
                            <em className="text-slate-500">Geen tekst</em>
                          )}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button
                            className="px-2 py-1 border border-slate-200 rounded-xl text-sm bg-white hover:bg-slate-50 shadow-sm"
                            onClick={() =>
                              navigator.clipboard.writeText(r.text || "")
                            }
                          >
                            Kopieer tekst
                          </button>
                          <a
                            className="px-2 py-1 border border-slate-200 rounded-xl text-sm bg-white hover:bg-slate-50 shadow-sm"
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
          <p className="text-sm text-slate-500">
            Geen geldige evaluatie geselecteerd.
          </p>
        )}
      </div>
    </>
  );
}
