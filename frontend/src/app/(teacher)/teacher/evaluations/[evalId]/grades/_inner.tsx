"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { useNumericEvalId } from "@/lib/id";
import { gradesService } from "@/services/grades.service";
import type { GradePreviewItem, PublishedGradeOut } from "@/dtos/grades.dto";

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
          ])
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
              gcf: i.gcf,  // Always fresh from preview
              peerPct: i.avg_score,  // Always fresh from preview
              serverSuggested: i.suggested_grade ?? 0,  // Always fresh from preview
              override: saved?.override ?? null,  // Preserved from saved
              comment: saved?.comment ?? "",  // Preserved from saved
              rowGroupGrade: saved?.rowGroupGrade ?? null,  // Preserved from saved
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
    }
  }

  useEffect(() => {
    if (evalIdNum == null) return;
    const timer = setInterval(() => {
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
              Cijfers
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              Beheer en publiceer eindcijfers voor deze evaluatie
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                await handleDraftSave();
                alert("Concept opgeslagen!");
              }}
              className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Concept opslaan
            </button>
            <button
              onClick={handlePublish}
              disabled={saving || loading || evalIdNum == null}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Publiceren…" : "Publiceer cijfers"}
            </button>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
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
                    tab.id === "grades"
                      ? "border-black text-black"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
                aria-current={tab.id === "grades" ? "page" : undefined}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>

        <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input
              placeholder="Zoek op naam…"
              className="border rounded-lg px-2 py-1"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
            <select
              className="border rounded-lg px-2 py-1"
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
              className="border rounded-lg px-2 py-1"
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
            <select
              className="border rounded-lg px-2 py-1"
              value={`${sortBy}:${sortDir}`}
              onChange={(e) => {
                const [k, d] = e.target.value.split(":") as [
                  SortKey,
                  "asc" | "desc",
                ];
                setSortBy(k);
                setSortDir(d);
              }}
              title="Sorteer kolommen"
            >
              <option value="team:asc">Team ↑</option>
              <option value="team:desc">Team ↓</option>
              <option value="class:asc">Klas ↑</option>
              <option value="class:desc">Klas ↓</option>
              <option value="name:asc">Naam A–Z</option>
              <option value="name:desc">Naam Z–A</option>
              <option value="final:asc">Eindcijfer ↑</option>
              <option value="final:desc">Eindcijfer ↓</option>
            </select>
          </div>
        </div>

        {loading && <p>Laden…</p>}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && rows.length === 0 && !error && <p>Geen data gevonden.</p>}

        {!loading && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[1000px]">
              <thead className="border-b text-gray-600">
                <tr>
                  <Th
                    onClick={() => toggleSort("team")}
                    active={sortBy === "team"}
                    dir={sortDir}
                  >
                    Team#
                  </Th>
                  <Th
                    onClick={() => toggleSort("name")}
                    active={sortBy === "name"}
                    dir={sortDir}
                  >
                    Naam
                  </Th>
                  <Th
                    onClick={() => toggleSort("class")}
                    active={sortBy === "class"}
                    dir={sortDir}
                  >
                    Klas
                  </Th>
                  <Th
                    onClick={() => toggleSort("final")}
                    active={sortBy === "final"}
                    dir={sortDir}
                  >
                    Voorstel
                  </Th>
                  <th className="text-left py-2 px-2">Groepscijfer</th>
                  <th className="text-left py-2 px-2">GCF</th>
                  <th className="text-left py-2 px-2">Handmatige correctie</th>
                  <th className="text-left py-2 px-2">Eindcijfer</th>
                  <th className="text-left py-2 px-2">Opmerking docent</th>
                </tr>
              </thead>

              <tbody>
                {filteredSorted.map((r) => (
                  <tr key={r.user_id} className="border-t align-top">
                    <td className="py-2 px-2">{r.teamNumber ?? "–"}</td>
                    <td className="py-2 px-2">
                      <Link
                        href={`/teacher/evaluations/${evalIdStr}/students/${r.user_id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="py-2 px-2">{r.className ?? "–"}</td>
                    <td className="py-2 px-2 font-medium">
                      {r.serverSuggested != null ? r.serverSuggested.toFixed(1) : "–"}
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        className="w-24 border rounded-lg px-2 py-1"
                        placeholder="bijv. 7.5"
                        title="Optioneel: per leerling een aangepast groepscijfer"
                        value={r.rowGroupGrade ?? ""}
                        min={1}
                        max={10}
                        step={0.1}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRows((all) =>
                            all.map((x) =>
                              x.user_id === r.user_id
                                ? {
                                    ...x,
                                    rowGroupGrade:
                                      val === "" ? null : Number(val),
                                  }
                                : x,
                            ),
                          );
                        }}
                      />
                    </td>
                    <td className="py-2 px-2">{r.gcf.toFixed(2)}</td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        className="w-24 border rounded-lg px-2 py-1"
                        placeholder="bijv. 8.0"
                        title="Handmatig aangepast eindcijfer (1–10)"
                        value={r.override ?? ""}
                        min={1}
                        max={10}
                        step={0.1}
                        onChange={(e) => {
                          const str = e.target.value;
                          const num =
                            str === "" ? null : e.target.valueAsNumber;
                          setRows((all) =>
                            all.map((x) =>
                              x.user_id === r.user_id
                                ? { ...x, override: num }
                                : x,
                            ),
                          );
                        }}
                      />
                    </td>
                    <td className="py-2 px-2 font-medium">
                      {finalGrade(r).toFixed(1)}
                    </td>
                    <td className="py-2 px-2">
                      <AutoTextarea
                        value={r.comment ?? ""}
                        onChange={(v) =>
                          setRows((all) =>
                            all.map((x) =>
                              x.user_id === r.user_id
                                ? { ...x, comment: v }
                                : x,
                            ),
                          )
                        }
                        placeholder="Toelichting / motivatie (optioneel)"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
}

// --- UI helpers ---
function Th({
  children,
  onClick,
  active,
  dir,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  dir?: "asc" | "desc";
}) {
  return (
    <th
      className="text-left py-2 px-2 cursor-pointer select-none"
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active && <span>{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

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
      className="w-full border rounded-lg px-2 py-1 leading-snug"
      placeholder={placeholder}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        if (ref.current) resize(ref.current);
      }}
      rows={2}
      style={{ resize: "vertical", maxHeight: 240 }}
    />
  );
}
