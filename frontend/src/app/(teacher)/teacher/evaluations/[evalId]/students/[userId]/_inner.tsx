"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { dashboardService } from "@/services/dashboard.service";
import { CategoryAverage } from "@/dtos/dashboard.dto";

/* ====================== Types ====================== */
type CommentObj = {
  criterion_id: number | null;
  criterion_name: string | null;
  text: string;
  score?: number | null; // 1–5 uit backend
};
type CommentItem = string | CommentObj;

type ReceivedGroup = {
  reviewer_id?: number | null;
  reviewer_name?: string;
  score_pct?: number | null;
  comments?: CommentItem[];
};

type GivenGroup = {
  reviewee_id?: number | null;
  reviewee_name?: string;
  score_pct?: number | null;
  comments?: CommentItem[];
};

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
    grade: number | null; // raw/handmatig
    final?: number | null; // server-berekend eindcijfer
    suggested?: number | null;
    group_grade?: number | null;
    gcf?: number | null;
    spr?: number | null;
    avg_score?: number | null; // kan 0–10 of 0–100 zijn
  };
  feedback_received: ReceivedGroup[];
  feedback_given: GivenGroup[];
  reflection?: {
    submitted_at?: string | null;
    text?: string | null;
  } | null;
};

/* ====================== Helpers ====================== */
const format1 = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : Number(v).toFixed(1);
const format2 = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : Number(v).toFixed(2);
function normalizePeerScore(v: number | null | undefined) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  const value = n > 10 ? n / 10 : n; // 55.3% -> 5.53
  return Number(value.toFixed(1));
}

/* ====================== UI mini components ====================== */
function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="p-3 rounded-xl border border-gray-200 bg-white">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-base font-medium">{value ?? "—"}</div>
    </div>
  );
}

const Badge = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <span
    className={
      "inline-flex shrink-0 items-center rounded-full border border-gray-200 bg-white/70 px-2 py-0.5 text-[11px] leading-5 text-gray-600 " +
      className
    }
  >
    {children}
  </span>
);

const ScoreBadge = ({ value }: { value: number | null }) => (
  <span className="inline-flex w-[78px] shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white/70 px-2 py-0.5 text-[11px] leading-5 text-gray-600 tabular-nums">
    {value != null ? `Score: ${value}` : "Score: –"}
  </span>
);

/** Eén comment: links badges (criterium + score), rechts tekst (wrapt) */
function CommentRow({ item }: { item: CommentItem }) {
  const isObj = typeof item !== "string";
  const text = isObj ? (item as any).text?.trim() : (item as string);
  const label = isObj ? ((item as any).criterion_name || "").trim() : "";
  const score: number | null = isObj ? ((item as any).score ?? null) : null;

  return (
    <li className="border-t first:border-t-0 border-gray-100 py-2">
      <div className="flex items-start gap-3">
        {/* Left column = 2-column grid: [criterion] [score] */}
        <div className="min-w-[280px] max-w-[55%]">
          <div className="grid grid-cols-[auto_78px] items-start gap-2">
            {label ? <Badge className="mt-0.5">{label}</Badge> : <span />}
            <ScoreBadge value={score} />
          </div>
        </div>

        {/* Right column = feedback text */}
        <p className="text-sm leading-6 text-gray-800">{text || "—"}</p>
      </div>
    </li>
  );
}

/** Per peer: titel + nette lijst onder elkaar */
function PeerGroupBlock({
  title,
  groups,
  nameFromGroup,
}: {
  title: string;
  groups: (ReceivedGroup | GivenGroup)[];
  nameFromGroup: (g: any) => string | undefined;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>

      {!groups || groups.length === 0 ? (
        <p className="text-sm text-gray-500">—</p>
      ) : (
        <ul className="space-y-6">
          {groups.map((g, idx) => {
            const name = nameFromGroup(g) || "—";
            const comments = g.comments ?? [];

            return (
              <li key={idx} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-medium">{name}</h3>
                  {comments.length > 0 && (
                    <span className="text-xs text-gray-500">
                      {comments.length} reactie
                      {comments.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>

                {comments.length === 0 ? (
                  <p className="text-sm text-gray-500">Geen opmerkingen.</p>
                ) : (
                  <ul className="rounded-xl border border-gray-100 bg-white">
                    {comments.map((c, i) => (
                      <CommentRow key={i} item={c} />
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ====================== Page ====================== */
export default function StudentOverviewPageInner() {
  const { evalId, userId } = useParams<{ evalId: string; userId: string }>();
  const [data, setData] = useState<Overview | null>(null);
  const [categoryAverages, setCategoryAverages] = useState<CategoryAverage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const evalIdNum = parseInt(evalId, 10);
        const userIdNum = parseInt(userId, 10);
        
        const [overviewRes, dashboardData] = await Promise.all([
          api.get<Overview>(
            `/evaluations/${encodeURIComponent(evalId)}/students/${encodeURIComponent(
              userId,
            )}/overview`,
          ),
          dashboardService.getDashboard(evalIdNum).catch(() => null),
        ]);
        
        if (!mounted) return;
        setData(overviewRes.data);
        
        // Extract category averages for this student
        if (dashboardData) {
          const studentItem = dashboardData.items.find((item) => item.user_id === userIdNum);
          if (studentItem?.category_averages) {
            setCategoryAverages(studentItem.category_averages);
          }
        }
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
  const finalGrade = data?.grade?.final ?? null;
  const peerNormalized = normalizePeerScore(g?.avg_score);

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Overzicht leerling</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/teacher/evaluations/${evalId}/grades`}
            className="px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
          >
            ← Terug naar cijfers
          </Link>
        </div>
      </header>

      {loading && <div>Laden…</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && data && (
        <>
          <p className="text-gray-600">
            #{data.user.id} · {data.user.name} · {data.user.email}
          </p>

          {/* Meta */}
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

          {/* Cijfers */}
          <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
            <h2 className="font-semibold">Cijfer</h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Stat
                label="Eindcijfer"
                value={
                  finalGrade !== null && finalGrade !== undefined
                    ? format1(finalGrade)
                    : "—"
                }
              />
              <Stat
                label="Suggestie"
                value={g?.suggested != null ? format1(g.suggested) : "—"}
              />
              <Stat
                label="Groepscijfer"
                value={g?.group_grade != null ? format1(g.group_grade) : "—"}
              />
              <Stat label="GCF" value={g?.gcf != null ? format2(g.gcf) : "—"} />
              <Stat
                label="Peer (1–10)"
                value={peerNormalized != null ? peerNormalized : "—"}
              />
              <Stat label="SPR" value={g?.spr != null ? format2(g.spr) : "—"} />
            </div>
          </section>

          {/* OMZA Scores */}
          {categoryAverages.length > 0 && (
            <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
              <h2 className="font-semibold">OMZA Scores</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {categoryAverages.map((cat) => (
                  <div key={cat.category} className="p-3 rounded-xl border border-gray-200 bg-white">
                    <div className="text-xs text-gray-500 mb-1">{cat.category}</div>
                    <div className="space-y-1">
                      <div className="text-sm">
                        <span className="text-gray-500">Peer:</span>{" "}
                        <span className="font-medium">{cat.peer_avg.toFixed(2)}</span>
                      </div>
                      {cat.self_avg !== null && cat.self_avg !== undefined && (
                        <div className="text-sm">
                          <span className="text-gray-500">Zelf:</span>{" "}
                          <span className="font-medium text-blue-600">{cat.self_avg.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Feedback ontvangen */}
          <PeerGroupBlock
            title="Feedback ontvangen (peers → Student)"
            groups={data.feedback_received || []}
            nameFromGroup={(g: ReceivedGroup) => g.reviewer_name}
          />

          {/* Feedback gegeven */}
          <PeerGroupBlock
            title="Feedback gegeven (Student → peers)"
            groups={data.feedback_given || []}
            nameFromGroup={(g: GivenGroup) => g.reviewee_name}
          />

          {/* Reflectie */}
          <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
            <h2 className="font-semibold">Reflectie</h2>
            {data.reflection?.text ? (
              <>
                <p className="text-sm text-gray-500">
                  {data.reflection.submitted_at
                    ? new Date(data.reflection.submitted_at).toLocaleString()
                    : "—"}
                </p>
                <p className="whitespace-pre-wrap">{data.reflection.text}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    className="px-2 py-1 border border-gray-200 rounded text-sm hover:bg-gray-50"
                    onClick={() =>
                      navigator.clipboard.writeText(data.reflection?.text || "")
                    }
                  >
                    Kopieer tekst
                  </button>
                  <a
                    className="px-2 py-1 border border-gray-200 rounded text-sm hover:bg-gray-50"
                    href={`data:text/plain;charset=utf-8,${encodeURIComponent(
                      data.reflection?.text || "",
                    )}`}
                    download={`${(data.user.name || "student")
                      .replace(/\s+/g, "_")
                      .toLowerCase()}_reflectie.txt`}
                  >
                    Download .txt
                  </a>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">Geen reflectie gevonden.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
