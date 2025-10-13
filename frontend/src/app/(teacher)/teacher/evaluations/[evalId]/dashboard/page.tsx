"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useNumericEvalId } from "@/lib/id";
import Link from "next/link";

/** Helpers & types **/
function toArray<T = any>(x: any): T[] {
  if (Array.isArray(x)) return x;
  if (x?.items && Array.isArray(x.items)) return x.items;
  return [];
}

type Kpis = {
  self_count: number;
  peer_count: number; // som van reviewers_count
  reflection_count: number; // nu 0 (geen veld in API)
  total_students: number;
};

function computeKpisFromItems(items: any[]): Kpis {
  const total_students = items.length;
  const self_count = items.filter(
    (it) => it.self_avg_overall !== null && it.self_avg_overall !== undefined,
  ).length;
  const peer_count = items.reduce(
    (acc, it) => acc + (Number(it.reviewers_count) || 0),
    0,
  );
  const reflection_count = 0; // nog geen reflecties in deze endpoint
  return { self_count, peer_count, reflection_count, total_students };
}

type UiFlag = { type: string; message: string; student?: string };

function flattenFlags(flagResData: any): UiFlag[] {
  const out: UiFlag[] = [];
  const items = toArray<any>(flagResData);
  for (const it of items) {
    const student = it.user_name || it.name || `#${it.user_id ?? "?"}`;
    const fs = Array.isArray(it.flags) ? it.flags : [];
    for (const f of fs) {
      out.push({
        type: f.code || f.severity || "flag",
        message: f.message || JSON.stringify(f),
        student,
      });
    }
  }
  return out;
}

/** Page **/
export default function EvaluationDashboardPage() {
  const evalIdNum = useNumericEvalId(); // null op /create of ongeldige id

  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [flags, setFlags] = useState<UiFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);
    setLoading(true);

    // Geen requests doen zonder geldig numeriek ID
    if (evalIdNum == null) {
      setKpis(null);
      setFlags([]);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const [kpiRes, flagRes] = await Promise.all([
          api.get(`/dashboard/evaluation/${evalIdNum}`),
          api.get(`/flags/evaluation/${evalIdNum}`),
          // preview: POST met body, maar we negeren het resultaat hier
          api
            .post(`/grades/preview`, { evaluation_id: evalIdNum })
            .catch(() => null),
        ]);

        const items = toArray<any>(kpiRes.data);
        setKpis(computeKpisFromItems(items));
        setFlags(flattenFlags(flagRes.data));
      } catch (e: any) {
        setErr(e?.response?.data?.detail || e?.message || "Laden mislukt");
      } finally {
        setLoading(false);
      }
    })();
  }, [evalIdNum]);

  const evalId = evalIdNum?.toString() ?? "";

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Evaluatie — Dashboard</h1>
        <div className="flex gap-2">
          {evalIdNum != null ? (
            <>
              <Link
                href={`/teacher/evaluations/${evalId}/grades`}
                className="px-3 py-2 rounded-xl border"
              >
                Cijfers
              </Link>
              <Link
                href={`/teacher/evaluations/${evalId}/feedback`}
                className="px-3 py-2 rounded-xl border"
              >
                Feedback
              </Link>
              <Link
                href={`/teacher/evaluations/${evalId}/reflections`}
                className="px-3 py-2 rounded-xl border"
              >
                Reflecties
              </Link>
              <Link
                href={`/teacher/evaluations/${evalId}/settings`}
                className="px-3 py-2 rounded-xl border"
              >
                Instellingen
              </Link>
            </>
          ) : (
            <>
              <span className="px-3 py-2 rounded-xl border opacity-60 cursor-not-allowed">
                Cijfers
              </span>
              <span className="px-3 py-2 rounded-xl border opacity-60 cursor-not-allowed">
                Feedback
              </span>
              <span className="px-3 py-2 rounded-xl border opacity-60 cursor-not-allowed">
                Reflecties
              </span>
              <span className="px-3 py-2 rounded-xl border opacity-60 cursor-not-allowed">
                Instellingen
              </span>
            </>
          )}
        </div>
      </header>

      {loading && <div className="text-gray-500">Laden…</div>}
      {err && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700">{err}</div>
      )}

      {!loading && !err && (
        <>
          {/* KPI tiles */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Tile label="Self-reviews" value={kpis?.self_count ?? 0} />
            <Tile label="Peer-reviews" value={kpis?.peer_count ?? 0} />
            <Tile label="Reflecties" value={kpis?.reflection_count ?? 0} />
            <Tile label="Totaal studenten" value={kpis?.total_students ?? 0} />
          </section>

          {/* Flags */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Signalen / Flags</h2>
            {!flags || flags.length === 0 ? (
              <div className="text-gray-500">Geen signalen.</div>
            ) : (
              <ul className="space-y-2">
                {flags.map((f, idx) => (
                  <li key={idx} className="p-3 border rounded-xl">
                    <div className="text-sm text-gray-500">{f.type}</div>
                    <div className="font-medium">{f.message}</div>
                    {f.student && (
                      <div className="text-sm text-gray-600">
                        Student: {f.student}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {evalIdNum == null && (
        <p className="text-sm text-gray-500">
          Geen geldige evaluatie geselecteerd. Open het dashboard via een
          bestaande evaluatie.
        </p>
      )}
    </main>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4 border rounded-2xl bg-white">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
