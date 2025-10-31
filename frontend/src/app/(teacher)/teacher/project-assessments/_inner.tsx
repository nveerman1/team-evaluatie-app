"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiAuthError } from "@/lib/api";
import { projectAssessmentService } from "@/services";
import { ProjectAssessmentListItem } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";

export default function ProjectAssessmentsListInner() {
  const [data, setData] = useState<ProjectAssessmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  async function fetchList(status?: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await projectAssessmentService.getProjectAssessments(
        undefined,
        status === "all" ? undefined : status
      );
      setData(response.items || []);
    } catch (e: any) {
      if (e instanceof ApiAuthError) {
        setError(e.originalMessage);
      } else {
        setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchList(statusFilter === "all" ? undefined : statusFilter);
  }, [statusFilter]);

  const handleDelete = async (id: number) => {
    if (!confirm("Weet je zeker dat je deze projectbeoordeling wilt verwijderen?"))
      return;
    try {
      await projectAssessmentService.deleteProjectAssessment(id);
      fetchList(statusFilter === "all" ? undefined : statusFilter);
    } catch (e: any) {
      if (e instanceof ApiAuthError) {
        alert(e.originalMessage);
      } else {
        alert(e?.response?.data?.detail || e?.message || "Verwijderen mislukt");
      }
    }
  };

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Projectbeoordelingen</h1>
          <p className="text-gray-600">
            Beheer projectbeoordelingen per team met vaste criteria.
          </p>
        </div>
        <Link
          href="/teacher/project-assessments/create"
          className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90"
        >
          + Nieuwe projectbeoordeling
        </Link>
      </header>

      {/* Status Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Status:</label>
        <select
          className="border rounded-lg px-3 py-2"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Alle</option>
          <option value="draft">Concept</option>
          <option value="published">Gepubliceerd</option>
        </select>
      </div>

      <section className="bg-white border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_160px_140px_120px_200px] gap-0 px-4 py-3 bg-gray-50 text-sm font-medium text-gray-600">
          <div>Titel</div>
          <div>Team</div>
          <div>Versie</div>
          <div>Status</div>
          <div className="text-right pr-2">Acties</div>
        </div>
        {loading && (
          <div className="p-6">
            <Loading />
          </div>
        )}
        {error && !loading && (
          <div className="p-6">
            <ErrorMessage message={`Fout: ${error}`} />
          </div>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="p-6 text-gray-500">
            Geen projectbeoordelingen gevonden.
          </div>
        )}
        {!loading &&
          !error &&
          data.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[1fr_160px_140px_120px_200px] items-start gap-0 px-4 py-3 border-t text-sm"
            >
              <div>
                <div className="font-medium">{item.title}</div>
              </div>
              <div className="text-gray-600">{item.group_name || "-"}</div>
              <div className="text-gray-600">{item.version || "-"}</div>
              <div>
                {item.status === "published" ? (
                  <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs">
                    Gepubliceerd
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                    Concept
                  </span>
                )}
              </div>
              <div className="flex justify-end gap-2 pr-2">
                <Link
                  href={`/teacher/project-assessments/${item.id}/edit`}
                  className="px-2 py-1 rounded-lg border hover:bg-gray-50"
                >
                  Bewerken
                </Link>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="px-2 py-1 rounded-lg border hover:bg-red-50 hover:border-red-300 text-red-600"
                >
                  Verwijder
                </button>
              </div>
            </div>
          ))}
      </section>
    </main>
  );
}
