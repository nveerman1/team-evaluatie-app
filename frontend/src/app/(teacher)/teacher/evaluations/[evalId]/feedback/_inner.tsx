"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  score?: number;
  created_at?: string;
  type?: "peer" | "self";
};

type UiGroup = {
  student_id: number;
  student_name: string;
  comments: UiComment[];
};

type ViewMode = "card" | "table";
type SortField = "student" | "criterion" | "type" | "score" | "date";

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
        score: c.score != null ? Number(c.score) : undefined,
        created_at: c.created_at,
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
      score: c.score != null ? Number(c.score) : undefined,
      created_at: c.created_at,
      type: c.type ?? (c.is_self ? "self" : "peer"),
    });
    byStudent.set(toId, group);
  }
  return Array.from(byStudent.values());
}

export default function FeedbackPageInner() {
  const evalIdNum = useNumericEvalId(); // null op /create
  const evalIdStr = evalIdNum != null ? String(evalIdNum) : "";
  const [groups, setGroups] = useState<UiGroup[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "self" | "peer">("all");
  const [sortField, setSortField] = useState<SortField>("student");
  const [sortAsc, setSortAsc] = useState(true);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("card");

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

  // Flat list for table view
  const allComments = useMemo(() => {
    const result: UiComment[] = [];
    for (const g of groups) {
      for (const c of g.comments) {
        result.push(c);
      }
    }
    return result;
  }, [groups]);

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const arr = groups
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

  const filteredSortedComments = useMemo(() => {
    const q = query.trim().toLowerCase();
    const arr = allComments.filter((c) => {
      const passType = typeFilter === "all" ? true : c.type === typeFilter;
      const passQuery =
        !q ||
        (c.to_student_name || "").toLowerCase().includes(q) ||
        (c.from_student_name || "").toLowerCase().includes(q) ||
        (c.criterion_name || "").toLowerCase().includes(q) ||
        (c.text || "").toLowerCase().includes(q);
      return passType && passQuery;
    });
    
    arr.sort((a, b) => {
      let result = 0;
      switch (sortField) {
        case "student":
          result = (a.to_student_name || "").localeCompare(b.to_student_name || "");
          break;
        case "criterion":
          result = (a.criterion_name || "").localeCompare(b.criterion_name || "");
          break;
        case "type":
          result = (a.type || "").localeCompare(b.type || "");
          break;
        case "score":
          result = (a.score ?? 0) - (b.score ?? 0);
          break;
        case "date":
          result = (a.created_at || "").localeCompare(b.created_at || "");
          break;
      }
      return sortAsc ? result : -result;
    });
    return arr;
  }, [allComments, query, typeFilter, sortField, sortAsc]);

  const toggleAll = (open: boolean) => {
    const map: Record<number, boolean> = {};
    filteredSorted.forEach((g) => (map[g.student_id] = open));
    setExpanded(map);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("nl-NL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
    } catch {
      return "-";
    }
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
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              Feedback
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              Bekijk ontvangen peer- en zelfevaluaties
            </p>
          </div>
          {evalIdNum != null && (
            <a
              href={`/api/v1/evaluations/${evalIdStr}/feedback/export.csv`}
              className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Export CSV
            </a>
          )}
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Tabs Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${
                    tab.id === "feedback"
                      ? "border-black text-black"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
                aria-current={tab.id === "feedback" ? "page" : undefined}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center justify-between">
        <button
          className={`px-4 py-2 rounded-lg border font-medium ${
            viewMode === "table"
              ? "bg-blue-500 text-white"
              : "bg-white hover:bg-gray-50"
          }`}
          onClick={() => setViewMode(viewMode === "card" ? "table" : "card")}
        >
          {viewMode === "card" ? "📋 Tabelweergave" : "💬 Kaartweergave"}
        </button>
      </div>

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
        {viewMode === "card" && (
          <>
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
          </>
        )}
      </div>

      {loading && <div className="text-gray-500">Laden…</div>}
      {err && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700">{err}</div>
      )}
      {!loading && !err && viewMode === "card" && filteredSorted.length === 0 && (
        <div className="text-gray-500">Geen feedback gevonden.</div>
      )}
      {!loading && !err && viewMode === "table" && filteredSortedComments.length === 0 && (
        <div className="text-gray-500">Geen feedback gevonden.</div>
      )}

      {/* Card View */}
      {viewMode === "card" && (
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
                          {c.score != null && (
                            <span className="px-2 py-0.5 rounded-full ring-1 ring-green-200 bg-green-50 text-green-700 font-medium">
                              Score: {c.score}
                            </span>
                          )}
                          {c.from_student_name && (
                            <span>van: {c.from_student_name}</span>
                          )}
                          {c.criterion_name && (
                            <span className="px-2 py-0.5 rounded-full ring-1 ring-gray-200 bg-gray-50">
                              {c.criterion_name}
                            </span>
                          )}
                          {c.created_at && (
                            <span className="text-gray-400">
                              {formatDate(c.created_at)}
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
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <section className="overflow-x-auto border rounded-2xl bg-white">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("student")}
                >
                  Student {sortField === "student" && (sortAsc ? "↑" : "↓")}
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("criterion")}
                >
                  Criterium {sortField === "criterion" && (sortAsc ? "↑" : "↓")}
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("type")}
                >
                  Type {sortField === "type" && (sortAsc ? "↑" : "↓")}
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("score")}
                >
                  Score {sortField === "score" && (sortAsc ? "↑" : "↓")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Feedbacktekst
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Van
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("date")}
                >
                  Datum {sortField === "date" && (sortAsc ? "↑" : "↓")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredSortedComments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Geen feedback gevonden
                  </td>
                </tr>
              ) : (
                filteredSortedComments.map((c, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{c.to_student_name}</td>
                    <td className="px-4 py-3 text-sm">{c.criterion_name || "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ring-1 ${
                          c.type === "self"
                            ? "ring-blue-200 bg-blue-50 text-blue-700"
                            : "ring-purple-200 bg-purple-50 text-purple-700"
                        }`}
                      >
                        {c.type === "self" ? "Zelf" : "Peer"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-medium">
                      {c.score != null ? c.score : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm max-w-md truncate" title={c.text}>
                      {c.text}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {c.from_student_name || "-"}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                      {formatDate(c.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}

        {evalIdNum == null && (
          <p className="text-sm text-gray-500">
            Geen geldige evaluatie geselecteerd.
          </p>
        )}
      </div>
    </>
  );
}
