"use client";
import { useParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { ApiAuthError } from "@/lib/api";
import { projectAssessmentService } from "@/services";
import { ProjectAssessmentReflectionsOverview, ReflectionInfo } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";

export default function ProjectAssessmentReflectionsInner() {
  const params = useParams();
  const assessmentId = Number(params?.assessmentId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProjectAssessmentReflectionsOverview | null>(null);

  // UI state for search and filters
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "submitted" | "missing">("all");
  const [sort, setSort] = useState<
    "name_asc" | "name_desc" | "date_new" | "date_old" | "words_hi" | "words_lo"
  >("name_asc");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const result = await projectAssessmentService.getReflections(assessmentId);
        setData(result);
        // Initialize all cards as collapsed
        const map: Record<number, boolean> = {};
        result.reflections.forEach((r: ReflectionInfo) => (map[r.id] = false));
        setExpanded(map);
      } catch (e: unknown) {
        if (e instanceof ApiAuthError) {
          setError(e.originalMessage);
        } else {
          const err = e as { response?: { data?: { detail?: string } }; message?: string };
          setError(err?.response?.data?.detail || err?.message || "Laden mislukt");
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [assessmentId]);

  // Filter and sort reflections
  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    let arr = data.reflections.filter((r) => {
      const submitted = !!r.submitted_at && (r.text?.trim()?.length ?? 0) > 0;
      if (statusFilter === "submitted" && !submitted) return false;
      if (statusFilter === "missing" && submitted) return false;
      if (q) {
        const hay = `${r.user_name ?? ""} ${r.text ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    arr.sort((a, b) => {
      const aDate = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const bDate = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      const aWords = a.word_count ?? 0;
      const bWords = b.word_count ?? 0;
      switch (sort) {
        case "name_asc":
          return (a.user_name || "").localeCompare(b.user_name || "");
        case "name_desc":
          return (b.user_name || "").localeCompare(a.user_name || "");
        case "date_new":
          return bDate - aDate;
        case "date_old":
          return aDate - bDate;
        case "words_hi":
          return bWords - aWords;
        case "words_lo":
          return aWords - bWords;
        default:
          return 0;
      }
    });
    return arr;
  }, [data, query, statusFilter, sort]);

  const toggleAll = (open: boolean) => {
    const map: Record<number, boolean> = {};
    filtered.forEach((r) => (map[r.id] = open));
    setExpanded(map);
  };

  if (loading) return <Loading />;
  if (error && !data) return <ErrorMessage message={error} />;
  if (!data) return <ErrorMessage message="Geen data gevonden" />;

  return (
    <>
      {/* Search and Filter bar */}
      <div className="sticky top-0 bg-white/80 backdrop-blur border border-gray-200 rounded-2xl p-3 flex flex-wrap items-center gap-3 shadow-sm">
        <input
          className="px-3 py-2 border border-gray-200 rounded-xl w-80 focus:outline-none focus:ring-2 focus:ring-blue-600"
          placeholder="Zoek op naam/tekst…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "submitted" | "missing")}
        >
          <option value="all">Alle reflecties</option>
          <option value="submitted">Ingeleverd</option>
          <option value="missing">Ontbrekend</option>
        </select>
        <select
          className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
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
            className="px-3 py-2 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 text-sm shadow-sm"
            onClick={() => toggleAll(true)}
          >
            Alles uitklappen
          </button>
          <button
            className="px-3 py-2 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 text-sm shadow-sm"
            onClick={() => toggleAll(false)}
          >
            Alles inklappen
          </button>
        </div>
      </div>

      {/* Reflections List */}
      {filtered.length === 0 ? (
        <div className="bg-white border rounded-2xl p-8 text-center text-gray-500">
          <p>Geen reflecties gevonden.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {filtered.map((reflection) => {
            const open = !!expanded[reflection.id];
            const dateLabel = reflection.submitted_at
              ? new Date(reflection.submitted_at).toLocaleString("nl-NL")
              : "—";
            return (
              <li
                key={reflection.id}
                className="border border-gray-200 rounded-2xl bg-white shadow-sm"
              >
                <button
                  className="w-full px-4 py-3 border-b border-gray-200 flex items-center justify-between text-left hover:bg-gray-50"
                  onClick={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [reflection.id]: !open,
                    }))
                  }
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900">{reflection.user_name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ring-1 ${
                        reflection.submitted_at
                          ? "ring-green-200 bg-green-50 text-green-700"
                          : "ring-gray-200 bg-gray-50 text-gray-600"
                      }`}
                    >
                      {reflection.submitted_at ? "ingeleverd" : "ontbreekt"}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full ring-1 ring-gray-200 bg-gray-50 text-gray-700">
                      {reflection.word_count} woorden
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {dateLabel} {open ? "▾" : "▸"}
                  </span>
                </button>

                {open && (
                  <div className="p-4">
                    <p className="whitespace-pre-wrap text-gray-800">
                      {reflection.text || (
                        <em className="text-gray-500">Geen tekst</em>
                      )}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        className="px-2 py-1 border border-gray-200 rounded-xl text-sm bg-white hover:bg-gray-50 shadow-sm"
                        onClick={() =>
                          navigator.clipboard.writeText(reflection.text || "")
                        }
                      >
                        Kopieer tekst
                      </button>
                      <a
                        className="px-2 py-1 border border-gray-200 rounded-xl text-sm bg-white hover:bg-gray-50 shadow-sm"
                        href={`data:text/plain;charset=utf-8,${encodeURIComponent(reflection.text || "")}`}
                        download={`${(reflection.user_name || "student").replace(/\s+/g, "_")}_reflectie.txt`}
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
  );
}
