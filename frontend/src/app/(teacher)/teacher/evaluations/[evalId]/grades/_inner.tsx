"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { useNumericEvalId } from "@/lib/id";
import { gradesService } from "@/services/grades.service";
import type { GradePreviewItem } from "@/dtos/grades.dto";
import { useEvaluationLayout } from "../EvaluationLayoutContext";

type Row = {
  user_id: number;
  name: string;
  teamNumber?: number | null;
  className?: string | null;
  gcf: number;
  peerPct: number;
  serverSuggested: number;
  rowGroupGrade?: number | null;
  override?: number | null;
};

type SortKey = "team" | "class" | "name" | "final";

export default function GradesPageInner() {
  const evalIdNum = useNumericEvalId();
  const evalIdStr = evalIdNum != null ? String(evalIdNum) : "—";
  const router = useRouter();
  const { setPublishGrades } = useEvaluationLayout();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterTeam, setFilterTeam] = useState<string>("all");
  const [filterClass, setFilterClass] = useState<string>("all");
  const [searchName, setSearchName] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [autoSaveState, setAutoSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("saved");

  const round1 = (n: number) => Math.round(n * 10) / 10;

  function finalGrade(r: Row): number {
    if (r.override != null) return round1(r.override);
    if (r.rowGroupGrade != null) return round1(r.rowGroupGrade * r.gcf);
    return round1(r.serverSuggested ?? 0);
  }

  // --------- load data ----------
  useEffect(() => {
    setError(null);
    if (evalIdNum == null) {
      setRows([]);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        // Always fetch fresh preview data for latest GCF and suggested grade calculations
        const preview = await gradesService.previewGrades(evalIdNum);
        const items: GradePreviewItem[] = preview?.items ?? [];

        // Also fetch existing saved grades to preserve manual inputs
        const existing = await gradesService.listGrades(evalIdNum);
        const existingMap = new Map(
          existing.map((g) => [
            g.user_id,
            {
              override: g.grade ?? null,
              rowGroupGrade: g.meta?.group_grade ?? null,
            },
          ]),
        );

        // Merge: use fresh calculations (GCF, suggested) with preserved manual inputs
        setRows(
          items.map((i) => {
            const saved = existingMap.get(i.user_id);
            return {
              user_id: i.user_id,
              name: i.user_name,
              teamNumber: i.team_number ?? null,
              className: i.class_name ?? null,
              gcf: i.gcf, // Always fresh from preview
              peerPct: i.avg_score, // Always fresh from preview
              serverSuggested: i.suggested_grade ?? 0, // Always fresh from preview
              override: saved?.override ?? null, // Preserved from saved
              rowGroupGrade: saved?.rowGroupGrade ?? null, // Preserved from saved
            };
          }),
        );
      } catch (e: any) {
        setError(e?.response?.data?.detail ?? e?.message ?? "Laden mislukt");
      } finally {
        setLoading(false);
      }
    })();
  }, [evalIdNum]);

  async function handleDraftSave() {
    if (evalIdNum == null || rows.length === 0) return;
    const overrides = Object.fromEntries(
      rows.map((r) => [
        r.user_id,
        {
          grade: r.override ?? null,
          reason: null,
          rowGroupGrade: r.rowGroupGrade ?? null,
        },
      ]),
    );
    try {
      await gradesService.saveDraft({
        evaluation_id: Number(evalIdNum),
        group_grade: null,
        overrides,
      });
    } catch (err: any) {
      console.warn("Concept opslaan mislukt:", err?.message ?? err);
      setAutoSaveState("error");
      return;
    }
    setAutoSaveState("saved");
  }

  // autosave om de 30s
  useEffect(() => {
    if (evalIdNum == null) return;
    const timer = setInterval(() => {
      setAutoSaveState("saving");
      handleDraftSave();
      console.log("Draft opgeslagen");
    }, 30000);
    return () => clearInterval(timer);
  }, [rows, evalIdNum]);

  // Set publish function in context (only once on mount)
  useEffect(() => {
    setPublishGrades(handlePublish);
    
    // Cleanup on unmount
    return () => {
      setPublishGrades(null);
    };
  }, [setPublishGrades]);
  
  // Note: We intentionally don't include handlePublish in dependencies
  // because we want to set it once. The function will always have access
  // to the latest rows, evalIdNum, etc. via closures.

  const teamOptions = useMemo(() => {
    const set = new Set<number | string>();
    rows.forEach((r) => set.add(r.teamNumber ?? "–"));
    return Array.from(set);
  }, [rows]);

  const classOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.className ?? "–"));
    return Array.from(set);
  }, [rows]);

  const filteredSorted = useMemo(() => {
    const q = searchName.trim().toLowerCase();
    let list = rows.filter((r) => {
      const teamMatch =
        filterTeam === "all" || String(r.teamNumber ?? "–") === filterTeam;
      const classMatch =
        filterClass === "all" || String(r.className ?? "–") === filterClass;
      const nameMatch = q === "" || r.name.toLowerCase().includes(q);
      return teamMatch && classMatch && nameMatch;
    });
    const cmp = (a: Row, b: Row) => {
      let va: string | number = 0;
      let vb: string | number = 0;
      if (sortBy === "team") {
        va = a.teamNumber ?? -1;
        vb = b.teamNumber ?? -1;
      } else if (sortBy === "class") {
        va = a.className ?? "";
        vb = b.className ?? "";
      } else if (sortBy === "name") {
        va = a.name.toLowerCase();
        vb = b.name.toLowerCase();
      } else if (sortBy === "final") {
        va = finalGrade(a);
        vb = finalGrade(b);
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    };
    return list.sort(cmp);
  }, [rows, filterTeam, filterClass, searchName, sortBy, sortDir]);

  const stats = useMemo(() => {
    const list = filteredSorted;
    const count = list.length || 1;
    const avgProposal =
      list.reduce((sum, r) => sum + (r.serverSuggested ?? 0), 0) / count;
    const avgGroupGrade =
      list.reduce((sum, r) => sum + (r.rowGroupGrade ?? 0), 0) / count;
    const avgGcf = list.reduce((sum, r) => sum + (r.gcf ?? 0), 0) / count;
    const avgFinal = list.reduce((sum, r) => sum + finalGrade(r), 0) / count;
    return {
      hasData: list.length > 0,
      avgProposal,
      avgGroupGrade,
      avgGcf,
      avgFinal,
    };
  }, [filteredSorted]);

  async function handlePublish() {
    if (evalIdNum == null) return;
    setSaving(true);
    try {
      const overrides = Object.fromEntries(
        rows.map((r) => [
          r.user_id,
          { grade: finalGrade(r), reason: null },
        ]),
      );
      await gradesService.publish({
        evaluation_id: evalIdNum,
        group_grade: null,
        overrides,
      });
      // Don't show alert here, the layout will show toast
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e?.message ?? "Publiceren mislukt");
    } finally {
      setSaving(false);
    }
  }

  const autoSaveLabel =
    {
      idle: "",
      saving: "Concept wordt opgeslagen…",
      saved: "✔ Concept opgeslagen (laatste 30s)",
      error: "⚠ Niet opgeslagen – controleer je verbinding",
    }[autoSaveState] ?? "";

  return (
    <>
      {/* Filters and autosave status */}
      <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            className="h-9 w-56 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Zoek op naam…"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
          <select
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            title="Filter op team"
          >
            <option value="all">Alle teams</option>
            {teamOptions.map((t) => (
              <option key={String(t)} value={String(t)}>
                Team {String(t)}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            title="Filter op klas"
          >
            <option value="all">Alle klassen</option>
            {classOptions.map((c) => (
              <option key={String(c)} value={String(c)}>
                {String(c)}
              </option>
            ))}
          </select>
        </div>
        
        {/* Autosave status on the right */}
        {autoSaveLabel && (
          <div className="text-xs text-gray-500 min-h-[1.2rem]">
            {autoSaveLabel}
          </div>
        )}
      </div>

        {loading && <p className="text-sm text-gray-500">Laden…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && rows.length === 0 && !error && (
          <p className="text-sm text-gray-500">Geen data gevonden.</p>
        )}

        {/* Tabel / grid met cijfers */}
        {!loading && filteredSorted.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-5 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide w-20 cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleSort("team")}
                    >
                      <div className="flex items-center gap-1">
                        Team
                        {sortBy === "team" && (
                          <span>{sortDir === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-5 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleSort("name")}
                    >
                      <div className="flex items-center gap-1">
                        Leerling
                        {sortBy === "name" && (
                          <span>{sortDir === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-3 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleSort("class")}
                    >
                      <div className="flex items-center gap-1">
                        Klas
                        {sortBy === "class" && (
                          <span>{sortDir === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 tracking-wide">
                      Voorstel
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 tracking-wide">
                      Groepscijfer
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 tracking-wide">
                      GCF
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-semibold text-gray-500 tracking-wide cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleSort("final")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Eindcijfer
                        {sortBy === "final" && (
                          <span>{sortDir === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredSorted.map((r) => (
                    <tr
                      key={r.user_id}
                      className="bg-white hover:bg-gray-50"
                    >
                      <td className="px-5 py-3 align-top text-xs text-gray-500">
                        {r.teamNumber != null && (
                          <span className="inline-flex items-center justify-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                            {r.teamNumber}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 align-top">
                        <Link
                          href={`/teacher/evaluations/${evalIdStr}/students/${r.user_id}`}
                          className="text-sm font-medium text-indigo-700 hover:underline"
                        >
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3 align-top text-xs text-gray-500">
                        {r.className ?? "–"}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <span className="text-sm text-gray-800">
                          {r.serverSuggested != null
                            ? r.serverSuggested.toFixed(1)
                            : "–"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <input
                          type="text"
                          className="w-20 text-right rounded-lg border px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none border-gray-300 bg-white shadow-sm"
                          placeholder="bijv. 7.5"
                          value={
                            r.rowGroupGrade != null &&
                            !Number.isNaN(r.rowGroupGrade)
                              ? r.rowGroupGrade.toFixed(1)
                              : ""
                          }
                          onChange={(e) =>
                            handleUpdateTeamGroupGrade(r.teamNumber, e.target.value)
                          }
                        />
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <span
                          className={`text-sm ${
                            r.gcf < 0.9
                              ? "text-red-600"
                              : r.gcf !== 1
                                ? "text-amber-600"
                                : "text-gray-800"
                          }`}
                        >
                          {r.gcf.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="text"
                            className={`w-16 text-right rounded-lg border px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm ${
                              r.override != null
                                ? "border-blue-300 bg-blue-50"
                                : finalGrade(r) === 0
                                  ? "border-amber-300 bg-amber-50"
                                  : "border-gray-300 bg-white"
                            }`}
                            value={
                              r.override != null && !Number.isNaN(r.override)
                                ? r.override.toFixed(1)
                                : finalGrade(r).toFixed(1)
                            }
                            onChange={(e) =>
                              handleUpdateOverride(r.user_id, e.target.value)
                            }
                          />
                          {r.override != null && (
                            <button
                              type="button"
                              className="text-xs text-gray-400 hover:text-red-600"
                              onClick={() => handleClearOverride(r.user_id)}
                              title="Verwijder individuele override"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>

            {/* Footer with averages */}
            {stats.hasData && (
              <div className="border-t border-gray-200 bg-gray-50 px-5 py-3">
                <div className="grid grid-cols-[80px_1fr_auto_auto_auto_auto_auto] gap-0 text-sm items-center">
                  <div></div>
                  <div className="px-5 font-medium text-gray-900">
                    Gemiddelde (op basis van filter)
                  </div>
                  <div className="px-3 w-16"></div>
                  <div className="px-4 text-right font-medium text-gray-800 w-32">
                    {stats.avgProposal.toFixed(1)}
                  </div>
                  <div className="px-4 text-right font-medium text-gray-800 w-32">
                    {stats.avgGroupGrade.toFixed(1)}
                  </div>
                  <div className="px-4 text-right font-medium text-gray-800 w-28">
                    {stats.avgGcf.toFixed(2)}
                  </div>
                  <div className="px-4 text-right font-semibold text-gray-900 w-32">
                    {stats.avgFinal.toFixed(1)}
                  </div>
                </div>
              </div>
            )}

            {/* Legend footer */}
            <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-xs text-slate-500">
              <p className="mb-2 font-medium">Leeswijzer</p>
              <p>
                Het <span className="font-medium">voorstelcijfer</span> komt uit de beoordeling van de docent en/of berekening in de app.
                Het <span className="font-medium">groepscijfer</span> vul je per
                team in en geldt voor alle leerlingen in dat team. De{" "}
                <span className="font-medium">GCF</span> (Group Correction Factor)
                is gebaseerd op peer- en self-evaluaties. Het voorgestelde
                eindcijfer is in de praktijk: groepscijfer × GCF (afgerond op één
                decimaal). Je kunt het{" "}
                <span className="font-medium">eindcijfer</span> altijd handmatig
                corrigeren in de tabel; jouw aanpassing overschrijft dan het
                voorstel. Klik op het ✕ symbool om een individuele override te verwijderen.
              </p>
            </div>
          </section>
        )}
    </>
  );

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

  function handleUpdateTeamGroupGrade(
    teamNumber: number | null | undefined,
    value: string,
  ) {
    if (teamNumber == null) return;
    setAutoSaveState("saving");
    // Handle empty string as null (clearing the group grade)
    if (value.trim() === "") {
      setRows((all) =>
        all.map((x) =>
          x.teamNumber === teamNumber ? { ...x, rowGroupGrade: null } : x,
        ),
      );
      return;
    }
    // Replace comma with dot for decimal numbers
    const num = Number(value.replace(",", "."));
    const newGrade = Number.isNaN(num) ? null : num;

    setRows((all) =>
      all.map((x) =>
        x.teamNumber === teamNumber ? { ...x, rowGroupGrade: newGrade } : x,
      ),
    );
  }

  function handleUpdateOverride(userId: number, value: string) {
    setAutoSaveState("saving");
    // Handle empty string as null (clearing the override)
    if (value.trim() === "") {
      setRows((all) =>
        all.map((x) => (x.user_id === userId ? { ...x, override: null } : x)),
      );
      return;
    }
    // Replace comma with dot for decimal numbers
    const num = Number(value.replace(",", "."));
    const newVal = Number.isNaN(num) ? null : num;
    setRows((all) =>
      all.map((x) => (x.user_id === userId ? { ...x, override: newVal } : x)),
    );
  }

  function handleClearOverride(userId: number) {
    setAutoSaveState("saving");
    setRows((all) =>
      all.map((x) => (x.user_id === userId ? { ...x, override: null } : x)),
    );
  }
}
