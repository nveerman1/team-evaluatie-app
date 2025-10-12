"use client";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import {
  DashboardResponse,
  FlagsResponse,
  GradePreviewResponse,
} from "@/lib/types";

export default function TeacherDashboard() {
  const { evaluationId } = useParams<{ evaluationId: string }>();
  const [dash, setDash] = useState<DashboardResponse | undefined>();
  const [flags, setFlags] = useState<FlagsResponse | undefined>();
  const [preview, setPreview] = useState<GradePreviewResponse | undefined>();
  const csvUrl = useMemo(
    () =>
      `${process.env.NEXT_PUBLIC_API_URL}/dashboard/evaluation/${evaluationId}/export.csv`,
    [evaluationId],
  );
  const flagsCsv = useMemo(
    () =>
      `${process.env.NEXT_PUBLIC_API_URL}/flags/evaluation/${evaluationId}/export.csv`,
    [evaluationId],
  );

  useEffect(() => {
    api
      .get<DashboardResponse>(`/dashboard/evaluation/${evaluationId}`)
      .then((r) => setDash(r.data));
    api
      .get<FlagsResponse>(`/flags/evaluation/${evaluationId}`)
      .then((r) => setFlags(r.data));
    api
      .get<GradePreviewResponse>(`/grades/preview`, {
        params: { evaluation_id: evaluationId },
      })
      .then((r) => setPreview(r.data));
  }, [evaluationId]);

  async function publishSuggested() {
    if (!preview) return;
    // overrides leeg → backend gebruikt suggested (zie publish-logica in fase 3). :contentReference[oaicite:5]{index=5}
    const overrides = Object.fromEntries(
      preview.items.map((it) => [it.user_id, {}]),
    );
    const res = await api.post(`/grades/publish`, {
      evaluation_id: Number(evaluationId),
      overrides,
    });
    alert(`Gepubliceerd: ${Array.isArray(res.data) ? res.data.length : "OK"}`);
  }

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">
          Dashboard — Evaluatie #{evaluationId}
        </h1>
        <a
          className="ml-auto px-3 py-2 rounded-xl border"
          href={csvUrl}
          target="_blank"
        >
          Export CSV
        </a>
        <a
          className="px-3 py-2 rounded-xl border"
          href={flagsCsv}
          target="_blank"
        >
          Flags CSV
        </a>
        <button
          className="px-3 py-2 rounded-xl bg-black text-white"
          onClick={publishSuggested}
        >
          Publish suggested
        </button>
      </header>

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
    </main>
  );
}
