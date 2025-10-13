"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { useNumericEvalId } from "@/lib/id";

type UiComment = {
  to_student_id?: number;
  to_student_name?: string;
  from_student_id?: number;
  from_student_name?: string;
  criterion_id?: number;
  criterion_name?: string;
  text: string;
  type?: "peer" | "self";
};

type UiGroup = {
  student_id: number;
  student_name: string;
  comments: UiComment[];
};

function asArray<T = any>(x: any): T[] {
  if (Array.isArray(x)) return x;
  if (x?.items && Array.isArray(x.items)) return x.items;
  if (x?.data && Array.isArray(x.data)) return x.data;
  return [];
}

function normalizeToGroups(res: any): UiGroup[] {
  const items = asArray(res);
  if (items.length && Array.isArray(items[0]?.comments)) {
    return items.map((it: any) => ({
      student_id: Number(it.student_id ?? it.user_id ?? it.id),
      student_name:
        it.student_name ??
        it.user_name ??
        it.name ??
        `#${it.student_id ?? it.user_id ?? "?"}`,
      comments: (it.comments ?? []).map((c: any) => ({
        to_student_id: Number(it.student_id ?? it.user_id),
        to_student_name: it.student_name ?? it.user_name ?? it.name,
        from_student_id: Number(
          c.from_student_id ?? c.reviewer_id ?? c.author_id,
        ),
        from_student_name:
          c.from_student_name ?? c.reviewer_name ?? c.author_name,
        criterion_id:
          Number(c.criterion_id ?? c.criterion?.id ?? 0) || undefined,
        criterion_name: c.criterion_name ?? c.criterion?.name,
        text: String(c.text ?? c.comment ?? ""),
        type: c.type ?? (c.is_self ? "self" : "peer"),
      })),
    }));
  }
  const flat = items.length ? items : asArray(res?.comments);
  const byStudent = new Map<number, UiGroup>();
  for (const c of flat) {
    const toId = Number(c.to_student_id ?? c.student_id ?? c.user_id);
    const toName =
      c.to_student_name ?? c.student_name ?? c.user_name ?? `#${toId}`;
    const group = byStudent.get(toId) ?? {
      student_id: toId,
      student_name: toName,
      comments: [],
    };
    group.comments.push({
      to_student_id: toId,
      to_student_name: toName,
      from_student_id: Number(
        c.from_student_id ?? c.reviewer_id ?? c.author_id,
      ),
      from_student_name:
        c.from_student_name ?? c.reviewer_name ?? c.author_name,
      criterion_id: Number(c.criterion_id ?? c.criterion?.id ?? 0) || undefined,
      criterion_name: c.criterion_name ?? c.criterion?.name,
      text: String(c.text ?? c.comment ?? ""),
      type: c.type ?? (c.is_self ? "self" : "peer"),
    });
    byStudent.set(toId, group);
  }
  return Array.from(byStudent.values());
}

export default function FeedbackPage() {
  const evalIdNum = useNumericEvalId(); // null op /create
  const evalIdStr = evalIdNum != null ? String(evalIdNum) : "";
  const [groups, setGroups] = useState<UiGroup[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "self" | "peer">("all");
  const [sortAsc, setSortAsc] = useState(true);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);
    if (evalIdNum == null) {
      setGroups([]);
      setExpanded({});
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .get(`/evaluations/${evalIdNum}/feedback`)
      .then((r) => {
        const gs = normalizeToGroups(r.data);
        setGroups(gs);
        const map: Record<number, boolean> = {};
        gs.forEach((g) => (map[g.student_id] = true)); // standaard alles open
        setExpanded(map);
      })
      .catch((e: any) =>
        setErr(e?.response?.data?.detail || e?.message || "Laden mislukt"),
      )
      .finally(() => setLoading(false));
  }, [evalIdNum]);

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = groups
      .map((g) => ({
        ...g,
        comments: g.comments.filter((c) => {
          const passType = typeFilter === "all" ? true : c.type === typeFilter;
          const passQuery =
            !q ||
            (g.student_name || "").toLowerCase().includes(q) ||
            (c.from_student_name || "").toLowerCase().includes(q) ||
            (c.criterion_name || "").toLowerCase().includes(q) ||
            (c.text || "").toLowerCase().includes(q);
          return passType && passQuery;
        }),
      }))
      .filter((g) => g.comments.length > 0);
    arr.sort((a, b) => {
      const cmp = (a.student_name || "").localeCompare(b.student_name || "");
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [groups, query, typeFilter, sortAsc]);

  const toggleAll = (open: boolean) => {
    const map: Record<number, boolean> = {};
    filteredSorted.forEach((g) => (map[g.student_id] = open));
    setExpanded(map);
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Feedback (ontvangen)</h1>
        <div className="flex gap-2">
          {evalIdNum != null ? (
            <>
              <a
                href={`/api/v1/evaluations/${evalIdStr}/feedback/export.csv`}
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

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="px-3 py-2 border rounded-lg w-80"
          placeholder="Zoek op student/criterium/tekst…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="px-3 py-2 border rounded-lg"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
        >
          <option value="all">Alle (self + peer)</option>
          <option value="self">Alleen self</option>
          <option value="peer">Alleen peer</option>
        </select>
        <button
          className="px-3 py-2 border rounded-lg"
          onClick={() => setSortAsc((s) => !s)}
          title="Sorteer op studentnaam"
        >
          Sorteer: {sortAsc ? "A→Z" : "Z→A"}
        </button>
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
      {!loading && !err && filteredSorted.length === 0 && (
        <div className="text-gray-500">Geen feedback gevonden.</div>
      )}

      <section className="space-y-4">
        {filteredSorted.map((g) => {
          const open = !!expanded[g.student_id];
          return (
            <article key={g.student_id} className="border rounded-2xl bg-white">
              <button
                className="w-full px-4 py-3 border-b flex items-center justify-between text-left"
                onClick={() =>
                  setExpanded((prev) => ({ ...prev, [g.student_id]: !open }))
                }
              >
                <span className="font-semibold">{g.student_name}</span>
                <span className="text-sm text-gray-500">
                  {g.comments.length} reacties {open ? "▾" : "▸"}
                </span>
              </button>

              {open && (
                <ul className="divide-y">
                  {g.comments.map((c, idx) => (
                    <li key={idx} className="p-4">
                      <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full ring-1 ${
                            c.type === "self"
                              ? "ring-blue-200 bg-blue-50 text-blue-700"
                              : "ring-purple-200 bg-purple-50 text-purple-700"
                          }`}
                        >
                          {c.type === "self" ? "zelf" : "peer"}
                        </span>
                        {c.from_student_name && (
                          <span>van: {c.from_student_name}</span>
                        )}
                        {c.criterion_name && (
                          <span className="px-2 py-0.5 rounded-full ring-1 ring-gray-200 bg-gray-50">
                            {c.criterion_name}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap">{c.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </section>

      {evalIdNum == null && (
        <p className="text-sm text-gray-500">
          Geen geldige evaluatie geselecteerd.
        </p>
      )}
    </main>
  );
}
