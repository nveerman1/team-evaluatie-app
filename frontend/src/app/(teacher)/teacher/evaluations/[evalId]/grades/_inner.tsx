"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { useNumericEvalId } from "@/lib/id";
import { gradesService } from "@/services/grades.service";
import type { GradePreviewItem } from "@/dtos/grades.dto";

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
  comment?: string;
};

type SortKey = "team" | "class" | "name" | "final";

export default function GradesPageInner() {
  const evalIdNum = useNumericEvalId();
  const evalIdStr = evalIdNum != null ? String(evalIdNum) : "—";
  const router = useRouter();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterTeam, setFilterTeam] = useState<string>("all");
  const [filterClass, setFilterClass] = useState<string>("all");
  const [searchName, setSearchName] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortKey>("team");
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
              comment: g.reason ?? "",
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
              comment: saved?.comment ?? "", // Preserved from saved
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
          reason: (r.comment ?? "").trim() || null,
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
          { grade: finalGrade(r), reason: (r.comment ?? "").trim() || null },
        ]),
      );
      await gradesService.publish({
        evaluation_id: evalIdNum,
        group_grade: null,
        overrides,
      });
      alert("Cijfers gepubliceerd!");
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e?.message ?? "Publiceren mislukt");
    } finally {
      setSaving(false);
    }
  }

  const tabs = [
    {
      id: "dashboard",
      label: "Dashboard",
      href: `/teacher/evaluations/${evalIdStr}/dashboard`,
    },
    {
      id: "omza",
      label: "OMZA",
      href: `/teacher/evaluations/${evalIdStr}/omza`,
    },
    {
      id: "grades",
      label: "Cijfers",
      href: `/teacher/evaluations/${evalIdStr}/grades`,
    },
    {
      id: "feedback",
      label: "Feedback",
      href: `/teacher/evaluations/${evalIdStr}/feedback`,
    },
    {
      id: "reflections",
      label: "Reflecties",
      href: `/teacher/evaluations/${evalIdStr}/reflections`,
    },
    {
      id: "settings",
      label: "Instellingen",
      href: `/teacher/evaluations/${evalIdStr}/settings`,
    },
  ];

  const autoSaveLabel =
    {
      idle: "",
      saving: "Concept wordt opgeslagen…",
      saved: "✔ Concept opgeslagen (laatste 30s)",
      error: "⚠ Niet opgeslagen – controleer je verbinding",
    }[autoSaveState] ?? "";

  const pillClass = (active: boolean) =>
    `px-3 py-1.5 text-xs rounded-full border transition inline-flex items-center gap-1 ${
      active
        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
    }`;

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              Cijfers
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              Beheer en publiceer eindcijfers voor deze evaluatie.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-xs text-gray-500 min-h-[1.2rem]">
              {autoSaveLabel}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDraftSave}
                className="rounded-full border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Concept opslaan
              </button>
              <button
                onClick={handlePublish}
                disabled={saving || loading || evalIdNum == null}
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Publiceren…" : "Publiceer cijfers"}
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
        {/* Tabs Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-6 text-sm" aria-label="Tabs">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={`py-3 border-b-2 -mb-px transition-colors ${
                  tab.id === "grades"
                    ? "border-blue-600 text-blue-700 font-medium"
                    : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
                }`}
                aria-current={tab.id === "grades" ? "page" : undefined}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Filters */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 px-4 py-3 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-3 flex-1 min-w-[230px]">
            <div className="relative flex-1 min-w-[180px]">
              <input
                type="text"
                className="w-full rounded-full border border-gray-300 px-10 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Zoek op naam…"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                🔍
              </span>
            </div>
            <select
              className="rounded-full border border-gray-300 px-3 py-2 text-sm bg-white min-w-[130px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="rounded-full border border-gray-300 px-3 py-2 text-sm bg-white min-w-[130px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
          <div className="flex items-center gap-2 text-xs text-gray-600 mt-2 md:mt-0">
            <span>Sorteren op</span>
            <button
              className={pillClass(sortBy === "team")}
              onClick={() => toggleSort("team")}
            >
              Team
            </button>
            <button
              className={pillClass(sortBy === "name")}
              onClick={() => toggleSort("name")}
            >
              Naam
            </button>
            <button
              className={pillClass(sortBy === "class")}
              onClick={() => toggleSort("class")}
            >
              Klas
            </button>
          </div>
        </section>

        {loading && <p className="text-sm text-gray-500">Laden…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && rows.length === 0 && !error && (
          <p className="text-sm text-gray-500">Geen data gevonden.</p>
        )}

        {/* Tabel / grid met cijfers */}
        {!loading && filteredSorted.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {/* header */}
              <div className="grid grid-cols-12 gap-3 px-4 py-3 text-xs font-semibold text-gray-500 bg-gray-50">
                <div className="col-span-1 text-right">Team</div>
                <div className="col-span-2">Leerling</div>
                <div className="col-span-1 text-right">Klas</div>
                <div className="col-span-1 text-right">Voorstel</div>
                <div className="col-span-2 text-right">Groepscijfer</div>
                <div className="col-span-1 text-right">GCF</div>
                <div className="col-span-1 text-right">Eindcijfer</div>
                <div className="col-span-3">Opmerking docent</div>
              </div>

              {/* rows */}
              {filteredSorted.map((r, idx) => (
                <div
                  key={r.user_id}
                  className={`grid grid-cols-12 gap-3 px-4 py-3 text-sm items-center ${
                    idx % 2 === 1 ? "bg-gray-50/50" : "bg-white"
                  }`}
                >
                  <div className="col-span-1 text-right text-xs text-gray-600">
                    {r.teamNumber != null ? `Team ${r.teamNumber}` : "–"}
                  </div>
                  <div className="col-span-2">
                    <Link
                      href={`/teacher/evaluations/${evalIdStr}/students/${r.user_id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {r.name}
                    </Link>
                  </div>
                  <div className="col-span-1 text-right text-xs text-gray-600">
                    {r.className ?? "–"}
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="text-sm text-gray-800">
                      {r.serverSuggested != null
                        ? r.serverSuggested.toFixed(1)
                        : "–"}
                    </span>
                  </div>
                  <div className="col-span-2 text-right">
                    <input
                      type="text"
                      className="w-20 text-right rounded-full border px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none border-gray-300 bg-white"
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
                  </div>
                  <div className="col-span-1 text-right">
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
                  </div>
                  <div className="col-span-1 text-right">
                    <input
                      type="text"
                      className={`w-16 text-right rounded-full border px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${
                        finalGrade(r) === 0
                          ? "border-amber-300 bg-amber-50"
                          : "border-gray-300 bg-white"
                      }`}
                      value={finalGrade(r).toFixed(1)}
                      onChange={(e) =>
                        handleUpdateOverride(r.user_id, e.target.value)
                      }
                    />
                  </div>
                  <div className="col-span-3">
                    <AutoTextarea
                      value={r.comment ?? ""}
                      onChange={(v) => handleUpdateComment(r.user_id, v)}
                      placeholder="Toelichting / motivatie (optioneel)"
                    />
                  </div>
                </div>
              ))}

              {/* Gemiddelde rij */}
              {stats.hasData && (
                <div className="grid grid-cols-12 gap-3 px-4 py-3 text-sm items-center bg-gray-50 border-t border-gray-200">
                  <div className="col-span-1 text-right text-xs font-medium text-gray-700">
                    —
                  </div>
                  <div className="col-span-2 font-medium text-gray-900">
                    Gemiddelde (op basis van filter)
                  </div>
                  <div className="col-span-1" />
                  <div className="col-span-1 text-right font-medium text-gray-800">
                    {stats.avgProposal.toFixed(1)}
                  </div>
                  <div className="col-span-2 text-right font-medium text-gray-800">
                    {stats.avgGroupGrade.toFixed(1)}
                  </div>
                  <div className="col-span-1 text-right font-medium text-gray-800">
                    {stats.avgGcf.toFixed(2)}
                  </div>
                  <div className="col-span-1 text-right font-semibold text-gray-900">
                    {stats.avgFinal.toFixed(1)}
                  </div>
                  <div className="col-span-3 text-xs text-gray-500">—</div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Uitleg onder de tabel */}
        <section className="text-xs text-gray-500 leading-relaxed">
          <p>
            Toelichting: het <span className="font-medium">voorstelcijfer</span>{" "}
            komt uit de beoordeling van de docent en/of berekening in de app.
            Het <span className="font-medium">groepscijfer</span> vul je per
            team in en geldt voor alle leerlingen in dat team. De{" "}
            <span className="font-medium">GCF</span> (Group Correction Factor)
            is gebaseerd op peer- en self-evaluaties. Het voorgestelde
            eindcijfer is in de praktijk: groepscijfer × GCF (afgerond op één
            decimaal). Je kunt het{" "}
            <span className="font-medium">eindcijfer</span> altijd handmatig
            corrigeren in de tabel; jouw aanpassing overschrijft dan het
            voorstel.
          </p>
        </section>
      </div>
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
    const num = Number(value.replace(",", "."));
    const newVal = Number.isNaN(num) ? null : num;
    setRows((all) =>
      all.map((x) => (x.user_id === userId ? { ...x, override: newVal } : x)),
    );
  }

  function handleUpdateComment(userId: number, value: string) {
    setAutoSaveState("saving");
    setRows((all) =>
      all.map((x) => (x.user_id === userId ? { ...x, comment: value } : x)),
    );
  }
}

// --- UI helpers ---
function AutoTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (ref.current) resize(ref.current);
  }, [value]);
  function resize(el: HTMLTextAreaElement) {
    el.style.height = "0px";
    el.style.height = Math.max(40, el.scrollHeight) + "px";
  }
  return (
    <textarea
      ref={ref}
      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs leading-snug resize-none h-12 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
      placeholder={placeholder}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        if (ref.current) resize(ref.current);
      }}
      rows={2}
      style={{ maxHeight: 240 }}
    />
  );
}
