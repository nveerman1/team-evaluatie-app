"use client";

import { useEffect, useMemo, useState } from "react";
import { useNumericEvalId } from "@/lib/id";
import api, { baseURL } from "@/lib/api";
import {
  DashboardResponse,
  FlagsResponse,
  GradePreviewResponse,
} from "@/lib/types";

export default function TeacherDashboardInner() {
  const evaluationId = useNumericEvalId(); // null op create/ongeldig
  const [dash, setDash] = useState<DashboardResponse | undefined>();
  const [flags, setFlags] = useState<FlagsResponse | undefined>();
  const [preview, setPreview] = useState<GradePreviewResponse | undefined>();
  const [error, setError] = useState<string | null>(null);

  const csvUrl = useMemo(
    () =>
      evaluationId != null
        ? `${baseURL}/dashboard/evaluation/${evaluationId}/export.csv`
        : undefined,
    [evaluationId],
  );
  const flagsCsv = useMemo(
    () =>
      evaluationId != null
        ? `${baseURL}/flags/evaluation/${evaluationId}/export.csv`
        : undefined,
    [evaluationId],
  );

  useEffect(() => {
    setError(null);
    // Alleen calls doen als er een geldig numeriek ID is
    if (evaluationId == null) return;

    api
      .get<DashboardResponse>(`/dashboard/evaluation/${evaluationId}`)
      .then((r) => setDash(r.data))
      .catch(() => {
        /* stil houden of setError(...) */
      });

    api
      .get<FlagsResponse>(`/flags/evaluation/${evaluationId}`)
      .then((r) => setFlags(r.data))
      .catch(() => {
        /* stil houden of setError(...) */
      });

    // grades/preview verwacht body → POST met evaluation_id
    api
      .post<GradePreviewResponse>(`/grades/preview`, {
        evaluation_id: evaluationId,
      })
      .then((r) => setPreview(r.data))
      .catch(() => {
        /* stil houden of setError(...) */
      });
  }, [evaluationId]);

  async function publishSuggested() {
    if (!preview || evaluationId == null) return;
    try {
      // overrides leeg → backend gebruikt suggested
      const overrides = Object.fromEntries(
        preview.items.map((it) => [it.user_id, {}]),
      );
      const res = await api.post(`/grades/publish`, {
        evaluation_id: evaluationId,
        overrides,
      });
      alert(
        `Gepubliceerd: ${Array.isArray(res.data) ? res.data.length : "OK"}`,
      );
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.message || "Publiceren mislukt");
    }
  }

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">
          Dashboard — Evaluatie #{evaluationId != null ? evaluationId : "—"}
        </h1>
        {csvUrl && (
          <a
            className="ml-auto px-3 py-2 rounded-xl border"
            href={csvUrl}
            target="_blank"
          >
            Export CSV
          </a>
        )}
        {flagsCsv && (
          <a
            className="px-3 py-2 rounded-xl border"
            href={flagsCsv}
            target="_blank"
          >
            Flags CSV
          </a>
        )}
        <button
          className="px-3 py-2 rounded-xl bg-black text-white disabled:opacity-60"
          onClick={publishSuggested}
          disabled={evaluationId == null || !preview}
        >
          Publish suggested
        </button>
      </header>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700">{error}</div>
      )}

      {dash && (
        <div className="overflow-x-auto border rounded-xl">
          <table className="min-w-[800px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">Leerling</th>
                <th className="p-2">Peer-avg</th>
                <th className="p-2">Self-avg</th>
                <th className="p-2">SPR</th>
                <th className="p-2">GCF</th>
                <th className="p-2">Suggested</th>
              </tr>
            </thead>
            <tbody>
              {dash.items.map((r) => (
                <tr key={r.user_id} className="border-t">
                  <td className="p-2">{r.user_name}</td>
                  <td className="p-2 text-center">
                    {r.peer_avg_overall.toFixed(2)}
                  </td>
                  <td className="p-2 text-center">
                    {r.self_avg_overall ?? "-"}
                  </td>
                  <td className="p-2 text-center">{r.spr.toFixed(2)}</td>
                  <td className="p-2 text-center">{r.gcf.toFixed(2)}</td>
                  <td className="p-2 text-center">
                    {r.suggested_grade.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {flags && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Flags</h2>
          <ul className="space-y-1">
            {flags.items.map((it) => (
              <li
                key={it.user_id}
                className="p-3 border rounded-xl flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">{it.user_name}</div>
                  <div className="text-xs text-gray-500">
                    SPR {it.spr.toFixed(2)} • GCF {it.gcf.toFixed(2)} •
                    reviewers {it.reviewers_count}
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {it.flags.map((f) => (
                    <span
                      key={f.code}
                      className={`text-xs px-2 py-1 rounded-full border
                      ${
                        f.severity === "high"
                          ? "border-red-500 text-red-600"
                          : f.severity === "medium"
                            ? "border-amber-500 text-amber-600"
                            : "border-gray-400 text-gray-600"
                      }`}
                    >
                      {f.code}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Geen calls op create/ongeldig ID → laat een hint zien */}
      {evaluationId == null && (
        <p className="text-sm text-gray-500">
          Geen geldige evaluatie gekozen. Open dit dashboard via een bestaande
          evaluatie.
        </p>
      )}
    </main>
  );
}
