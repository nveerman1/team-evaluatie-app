"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useClients } from "@/hooks/useClients";
import { clientService } from "@/services";

interface ClientsListProps {
  refreshKey?: number;
}

export function ClientsList({ refreshKey }: ClientsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<string>("Alle");
  const [selectedStatus, setSelectedStatus] = useState<string>("Alle");
  const [selectedSector, setSelectedSector] = useState<string>("Alle");
  const [selectedTag, setSelectedTag] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Use the custom hook with debounced search
  const { data, loading, error } = useClients({
    page,
    per_page: perPage,
    level: selectedLevel !== "Alle" ? selectedLevel : undefined,
    status: selectedStatus !== "Alle" ? selectedStatus : undefined,
    search: searchQuery || undefined,
    tags: selectedTag,
    refreshKey,
  });

  // Reset page to 1 when search query changes
  useEffect(() => {
    if (searchQuery) {
      setPage(1);
    }
  }, [searchQuery]);

  const handleExportCSV = async () => {
    try {
      const blob = await clientService.exportClientsCSV({
        level: selectedLevel !== "Alle" ? selectedLevel : undefined,
        status: selectedStatus !== "Alle" ? selectedStatus : undefined,
        search: searchQuery || undefined,
        tags: selectedTag,
      });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `opdrachtgevers_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Failed to export CSV:", err);
      alert("Fout bij exporteren naar CSV");
    }
  };

  const handleTagClick = (tag: string) => {
    if (selectedTag === tag) {
      // Deselect if already selected
      setSelectedTag(undefined);
    } else {
      // Select the new tag
      setSelectedTag(tag);
      // Reset to page 1 when changing filter
      setPage(1);
    }
  };

  // Memoize unique tags calculation to avoid unnecessary recalculations
  const uniqueTags = useMemo(() => {
    return data?.items
      ? Array.from(new Set(data.items.flatMap((client) => client.tags || [])))
          .sort()
      : [];
  }, [data]);

  // Memoize unique sectors calculation to avoid unnecessary recalculations
  const uniqueSectors = useMemo(() => {
    return data?.items
      ? Array.from(new Set(data.items.map((client) => client.sector).filter((s): s is string => !!s)))
          .sort()
      : [];
  }, [data]);

  // Memoize filtered data to avoid unnecessary recalculations
  const filteredData = useMemo(() => {
    return data ? {
      ...data,
      items: selectedSector !== "Alle" 
        ? data.items.filter(client => client.sector === selectedSector)
        : data.items
    } : null;
  }, [data, selectedSector]);

  return (
    <div className="space-y-4">
      {/* Combined Filters Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        {/* Expertise tags - inline with label */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Expertise-tags</span>
          {uniqueTags.length > 0 ? (
            <>
              {uniqueTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ring-1 ${
                    selectedTag === tag
                      ? "bg-violet-500 text-white ring-violet-600"
                      : "bg-violet-50 text-violet-700 ring-violet-100 hover:bg-violet-100"
                  }`}
                >
                  {tag}
                  {selectedTag === tag && <span className="ml-1.5">✓</span>}
                </button>
              ))}
              {selectedTag && (
                <button
                  onClick={() => setSelectedTag(undefined)}
                  className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                >
                  ✕ Wis filter
                </button>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-500">Geen tags gevonden. Tags worden toegevoegd bij het aanmaken van een opdrachtgever.</p>
          )}
        </div>

        {/* Search and Dropdowns - all in one row */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Zoek op organisatie of contactpersoon..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Zoeken op organisatie of contactpersoon"
            className="flex-1 min-w-[240px] rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          <select
            value={selectedSector}
            onChange={(e) => {
              setSelectedSector(e.target.value);
              setPage(1);
            }}
            aria-label="Sector selecteren"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:outline-none"
          >
            <option value="Alle">Alle sectoren</option>
            {uniqueSectors.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
          </select>

          <select
            value={selectedLevel}
            onChange={(e) => {
              setSelectedLevel(e.target.value);
              setPage(1);
            }}
            aria-label="Niveau selecteren"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:outline-none"
          >
            <option value="Alle">Alle niveaus</option>
            <option value="Onderbouw">Onderbouw</option>
            <option value="Bovenbouw">Bovenbouw</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            aria-label="Status selecteren"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:outline-none"
          >
            <option value="Alle">Alle statussen</option>
            <option value="Actief">Actief</option>
            <option value="Inactief">Inactief</option>
          </select>

          <button
            onClick={handleExportCSV}
            aria-label="Exporteer naar CSV"
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /> CSV
          </button>
        </div>
      </section>

      {loading && <div className="text-center py-8">Laden...</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Fout: {error}</div>}

      {filteredData && (
        <>
          <div className="text-sm text-slate-600">
            {filteredData.items.length} opdrachtgever(s) {selectedSector !== "Alle" ? "getoond" : "gevonden"}
            {data && selectedSector !== "Alle" && data.total !== filteredData.items.length && (
              <span className="text-slate-500"> (van {data.total} totaal)</span>
            )}
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Organisatie</th>
                  <th className="px-4 py-3 text-left font-medium">Contact</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Sector</th>
                  <th className="px-4 py-3 text-left font-medium">Niveau</th>
                  <th className="px-4 py-3 text-left font-medium">Projecten</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.items.map((client) => (
                  <tr key={client.id} className="hover:bg-indigo-50/60 transition">
                    <td className="px-4 py-3">
                      <Link href={`/teacher/clients/${client.id}`} className="font-semibold text-slate-900 hover:underline">
                        {client.organization}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{client.contact_name || "-"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{client.email || "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{client.sector || "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{client.level || "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{client.projects_this_year}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                        client.active 
                          ? "bg-emerald-100 text-emerald-700 ring-emerald-200" 
                          : "bg-slate-100 text-slate-700 ring-slate-200"
                      }`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                        {client.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.pages > 1 && (
            <div className="flex items-center justify-between">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Vorige</button>
              <span className="text-sm">Pagina {page} van {data.pages}</span>
              <button onClick={() => setPage(Math.min(data.pages, page + 1))} disabled={page === data.pages} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Volgende</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
