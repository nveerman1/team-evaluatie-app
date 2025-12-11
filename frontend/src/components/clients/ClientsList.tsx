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
        {/* Expertise tags */}
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Expertise-tags</h3>
          {uniqueTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {uniqueTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium cursor-pointer transition-colors ${
                    selectedTag === tag
                      ? "bg-purple-500 border-purple-600 text-white"
                      : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
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
            </div>
          ) : (
            <p className="text-xs text-slate-500">Geen tags gevonden. Tags worden toegevoegd bij het aanmaken van een opdrachtgever.</p>
          )}
        </div>

        {/* Search and Dropdowns */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between pt-2 border-t border-slate-100">
          <div className="flex-1 max-w-md">
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Zoeken</label>
            <input
              type="text"
              placeholder="Zoek op organisatie of contactpersoon..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">Sector</label>
              <select
                value={selectedSector}
                onChange={(e) => {
                  setSelectedSector(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="Alle">Alle sectoren</option>
                {uniqueSectors.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">Niveau</label>
              <select
                value={selectedLevel}
                onChange={(e) => {
                  setSelectedLevel(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="Alle">Alle niveaus</option>
                <option value="Onderbouw">Onderbouw</option>
                <option value="Bovenbouw">Bovenbouw</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="Alle">Alle statussen</option>
                <option value="Actief">Actief</option>
                <option value="Inactief">Inactief</option>
              </select>
            </div>

            <button
              onClick={handleExportCSV}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              📊 CSV
            </button>
          </div>
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
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Organisatie</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Sector</th>
                  <th className="px-4 py-3">Niveau</th>
                  <th className="px-4 py-3">Projecten</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.items.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/teacher/clients/${client.id}`} className="font-medium text-sky-700 hover:underline">
                        {client.organization}
                      </Link>
                      {client.tags && client.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {client.tags.map((tag, idx) => (
                            <span key={idx} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{tag}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">{client.contact_name || "-"}</td>
                    <td className="px-4 py-3">{client.email || "-"}</td>
                    <td className="px-4 py-3">{client.sector || "-"}</td>
                    <td className="px-4 py-3">{client.level || "-"}</td>
                    <td className="px-4 py-3 text-center">{client.projects_this_year}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${client.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100"}`}>
                        {client.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.pages > 1 && (
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
