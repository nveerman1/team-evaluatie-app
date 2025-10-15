"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";

type Overview = {
  evaluation_id: number;
  user: {
    id: number;
    name: string;
    email: string;
    class_name?: string | null;
    team_id?: number | null;
    team_name?: string | null;
    team_number?: number | null;
    cluster_id?: number | null;
    cluster_name?: string | null;
  };
  grade: {
    grade: number | null;
    reason?: string | null;
    suggested?: number | null;
    group_grade?: number | null;
    gcf?: number | null;
    spr?: number | null;
    avg_score?: number | null;
    meta?: any;
  };
  feedback_received: Array<{
    reviewer_id?: number | null;
    reviewer_name?: string;
    score_pct?: number | null;
    comments?: string[];
  }>;
  feedback_given: Array<{
    reviewee_id?: number | null;
    reviewee_name?: string;
    score_pct?: number | null;
    comments?: string[];
  }>;
  reflection?: {
    submitted_at?: string | null;
    text?: string | null;
  } | null;
};

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="p-3 rounded-xl border bg-white">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-base font-medium">{value ?? "—"}</div>
    </div>
  );
}

export default function StudentOverviewPage() {
  const { evalId, userId } = useParams<{ evalId: string; userId: string }>();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<Overview>(
          `/evaluations/${encodeURIComponent(evalId)}/students/${encodeURIComponent(userId)}/overview`,
        );
        if (!mounted) return;
        setData(res.data);
      } catch (e: any) {
        setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [evalId, userId]);

  const g = data?.grade;
  const final = g?.grade ?? g?.suggested ?? null;

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Overzicht leerling</h1>
          {data && (
            <p className="text-gray-600">
              #{data.user.id} · {data.user.name} · {data.user.email}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/teacher/evaluations/${evalId}/grades`}
            className="px-3 py-2 rounded-xl border"
          >
            ← Terug naar cijfers
          </Link>
        </div>
      </header>

      {loading && <div>Laden…</div>}
      {error && <div className="text-red-600">{error}</div>}
      {!loading && !error && data && (
        <>
          {/* User meta */}
          <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Stat label="Klas" value={data.user.class_name ?? "—"} />
            <Stat
              label="Cluster"
              value={
                data.user.cluster_name ??
                (data.user.cluster_id ? `Course ${data.user.cluster_id}` : "—")
              }
            />
            <Stat
              label="Team"
              value={
                data.user.team_name ??
                (data.user.team_number != null
                  ? `Team ${data.user.team_number}`
                  : "—")
              }
            />
            <Stat label="Team #" value={data.user.team_number ?? "—"} />
          </section>

          {/* Cijfer */}
          <section className="bg-white border rounded-2xl p-4 space-y-3">
            <h2 className="font-semibold">Cijfer</h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Stat
                label="Eindcijfer"
                value={final != null ? Number(final).toFixed(1) : "—"}
              />
              <Stat
                label="Suggestie"
                value={
                  g?.suggested != null ? Number(g.suggested).toFixed(1) : "—"
                }
              />
              <Stat
                label="Groepscijfer"
                value={
                  g?.group_grade != null
                    ? Number(g.group_grade).toFixed(1)
                    : "—"
                }
              />
              <Stat
                label="GCF"
                value={g?.gcf != null ? Number(g.gcf).toFixed(2) : "—"}
              />
              <Stat
                label="Peer % (avg)"
                value={
                  g?.avg_score != null
                    ? Number(g.avg_score).toFixed(0) + "%"
                    : "—"
                }
              />
              <Stat
                label="SPR"
                value={g?.spr != null ? Number(g.spr).toFixed(2) : "—"}
              />
            </div>
            {g?.reason && (
              <div className="text-sm text-gray-700">
                <div className="text-gray-500">Motivatie docent:</div>
                <div className="whitespace-pre-wrap">{g.reason}</div>
              </div>
            )}
          </section>

          {/* Feedback ontvangen */}
          <section className="bg-white border rounded-2xl p-4 space-y-3">
            <h2 className="font-semibold">
              Feedback ontvangen (peers → {data.user.name})
            </h2>
            {data.feedback_received.length === 0 ? (
              <div className="text-gray-500 text-sm">Geen items gevonden.</div>
            ) : (
              <ul className="divide-y">
                {data.feedback_received.map((f, i) => (
                  <li key={i} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="font-medium">
                        {f.reviewer_name ?? "—"}
                      </div>
                      <div className="text-sm text-gray-600">
                        {f.score_pct != null
                          ? `${Math.round(f.score_pct)}%`
                          : "—"}
                      </div>
                    </div>
                    {f.comments && f.comments.length > 0 && (
                      <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 space-y-1">
                        {f.comments.map((c, j) => (
                          <li key={j} className="whitespace-pre-wrap">
                            {c}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Feedback gegeven */}
          <section className="bg-white border rounded-2xl p-4 space-y-3">
            <h2 className="font-semibold">
              Feedback gegeven ({data.user.name} → peers)
            </h2>
            {data.feedback_given.length === 0 ? (
              <div className="text-gray-500 text-sm">Geen items gevonden.</div>
            ) : (
              <ul className="divide-y">
                {data.feedback_given.map((f, i) => (
                  <li key={i} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="font-medium">
                        {f.reviewee_name ?? "—"}
                      </div>
                      <div className="text-sm text-gray-600">
                        {f.score_pct != null
                          ? `${Math.round(f.score_pct)}%`
                          : "—"}
                      </div>
                    </div>
                    {f.comments && f.comments.length > 0 && (
                      <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 space-y-1">
                        {f.comments.map((c, j) => (
                          <li key={j} className="whitespace-pre-wrap">
                            {c}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Reflectie */}
          <section className="bg-white border rounded-2xl p-4 space-y-2">
            <h2 className="font-semibold">Reflectie</h2>
            {!data.reflection?.text ? (
              <div className="text-gray-500 text-sm">
                Geen reflectie gevonden.
              </div>
            ) : (
              <>
                {data.reflection?.submitted_at && (
                  <div className="text-xs text-gray-500">
                    Ingediend:{" "}
                    {new Date(data.reflection.submitted_at).toLocaleString()}
                  </div>
                )}
                <div className="whitespace-pre-wrap text-sm">
                  {data.reflection.text}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
