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

type OmzaAverages = {
  O?: number | null;
  M?: number | null;
  Z?: number | null;
  A?: number | null;
};

type ReceivedGroup = {
  reviewer_id?: number | null;
  reviewer_name?: string;
  score_pct?: number | null;
  comments?: CommentItem[];
  omza_averages?: OmzaAverages | null;
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

/* ====================== UI components ====================== */

/** Single grade stat tile used in Cijferoverzicht */
function GradeItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

/** One competency row inside a reviewer card */
function FeedbackRow({ item }: { item: CommentItem }) {
  const obj = typeof item !== "string" ? (item as CommentObj) : null;
  const text = obj ? obj.text?.trim() : (item as string);
  const label = obj ? (obj.criterion_name || "").trim() : "";
  const score: number | null = obj ? (obj.score ?? null) : null;

  return (
    <div className="grid gap-3 px-4 py-4 lg:grid-cols-[220px_92px_1fr] lg:items-start lg:gap-4">
      <div className="text-sm font-medium text-slate-700">{label || "—"}</div>
      <div>
        <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
          Score: {score ?? "–"}
        </span>
      </div>
      <div className="text-sm leading-6 text-slate-700">{text || "—"}</div>
    </div>
  );
}

const OMZA_LABELS: { code: keyof OmzaAverages; label: string }[] = [
  { code: "O", label: "Organiseren" },
  { code: "M", label: "Meedoen" },
  { code: "Z", label: "Zelfvertrouwen" },
  { code: "A", label: "Autonomie" },
];

/** Card for a single reviewer (feedback received) or reviewee (feedback given) */
function PeerFeedbackCard({
  name,
  comments,
  omzaAverages,
}: {
  name: string;
  comments: CommentItem[];
  omzaAverages?: OmzaAverages | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const showOmzaRow =
    omzaAverages &&
    OMZA_LABELS.some((o) => omzaAverages[o.code] != null);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 ring-1 ring-slate-200">
      {/* Reviewer header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="text-lg font-semibold text-slate-900">{name}</div>
        {comments.length > 0 && (
          <div className="rounded-full bg-white px-3 py-1 text-sm text-slate-600 ring-1 ring-slate-200">
            {comments.length} reactie{comments.length === 1 ? "" : "s"}
          </div>
        )}
      </div>

      {/* OMZA averages mini-row */}
      {showOmzaRow && (
        <div className="mb-4 grid grid-cols-4 gap-2">
          {OMZA_LABELS.map(({ code, label }) => {
            const val = omzaAverages![code];
            return (
              <div
                key={code}
                className="rounded-xl bg-white p-3 ring-1 ring-slate-200 text-center"
              >
                <div className="text-xs font-medium text-slate-500">{code}</div>
                <div
                  className="mt-1 text-lg font-semibold text-slate-900"
                  title={label}
                >
                  {val != null ? Number(val).toFixed(2) : "—"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Collapsible details */}
      {comments.length === 0 ? (
        <p className="text-sm text-slate-500">Geen opmerkingen.</p>
      ) : (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <span
              className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}
            >
              ▶
            </span>
            {expanded ? "Verberg details" : "Toon details per onderdeel"}
          </button>

          {expanded && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {/* Column headers — hidden on small screens */}
              <div className="hidden grid-cols-[220px_92px_1fr] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid">
                <div>Onderdeel</div>
                <div>Score</div>
                <div>Toelichting</div>
              </div>
              <div className="divide-y divide-slate-200">
                {comments.map((c, i) => (
                  <FeedbackRow key={i} item={c} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ====================== Page ====================== */
export default function StudentOverviewPageInner() {
  const { evalId, userId } = useParams<{ evalId: string; userId: string }>();
  const [data, setData] = useState<Overview | null>(null);
  const [categoryAverages, setCategoryAverages] = useState<CategoryAverage[]>(
    [],
  );
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
          const studentItem = dashboardData.items.find(
            (item) => item.user_id === userIdNum,
          );
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
      {/* SECTION 1 — Student header */}
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Overzicht leerling
          </h2>
          {data && (
            <div className="mt-5">
              <div className="text-lg font-medium text-slate-900">
                #{data.user.id} · {data.user.name}
              </div>
              <div className="mt-1 text-sm text-slate-500">{data.user.email}</div>
            </div>
          )}
        </div>
        <Link
          href={`/teacher/evaluations/${evalId}/assessment`}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <span>←</span>
          <span>Terug naar beoordeling</span>
        </Link>
      </section>

      {loading && <div>Laden…</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && data && (
        <>
          {/* SECTION 2 — Cijferoverzicht */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">
                Cijferoverzicht
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Alle kernscores compact in één overzicht.
              </p>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <GradeItem
                label="Eindcijfer"
                value={
                  finalGrade !== null && finalGrade !== undefined
                    ? format1(finalGrade)
                    : "—"
                }
              />
              <GradeItem
                label="Suggestie"
                value={g?.suggested != null ? format1(g.suggested) : "—"}
              />
              <GradeItem
                label="Groepscijfer"
                value={g?.group_grade != null ? format1(g.group_grade) : "—"}
              />
              <GradeItem
                label="GCF"
                value={g?.gcf != null ? format2(g.gcf) : "—"}
              />
              <GradeItem
                label="Peer (1–10)"
                value={peerNormalized != null ? String(peerNormalized) : "—"}
              />
              <GradeItem
                label="SPR"
                value={g?.spr != null ? format2(g.spr) : "—"}
              />
            </div>
          </section>

          {/* SECTION 3 — OMZA scores */}
          {categoryAverages.length > 0 && (
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  OMZA scores
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Gemiddelde peer-scores per categorie.
                </p>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                {categoryAverages.map((cat) => (
                  <div
                    key={cat.category}
                    className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200"
                  >
                    <div className="text-sm font-medium text-slate-700">
                      {cat.category}
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">
                      Peer: {cat.peer_avg.toFixed(2)}
                    </div>
                    {cat.self_avg !== null && cat.self_avg !== undefined && (
                      <div className="mt-1 text-sm text-slate-500">
                        Zelf:{" "}
                        <span className="font-medium text-blue-600">
                          {cat.self_avg.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* SECTION 4 — Peer feedback ontvangen */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  Feedback ontvangen
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Feedback van peers aan deze leerling, overzichtelijk per
                  beoordelaar.
                </p>
              </div>
              <div className="text-sm text-slate-500">Peers → student</div>
            </div>

            {!data.feedback_received || data.feedback_received.length === 0 ? (
              <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500 ring-1 ring-slate-200">
                Geen feedback ontvangen gevonden.
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                {data.feedback_received.map((group, idx) => (
                  <PeerFeedbackCard
                    key={idx}
                    name={group.reviewer_name || "—"}
                    comments={group.comments ?? []}
                    omzaAverages={group.omza_averages}
                  />
                ))}
              </div>
            )}
          </section>

          {/* SECTION 5 — Feedback gegeven */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">
                Feedback gegeven
              </h3>
              <p className="mt-1 text-sm text-slate-500">Student → peers</p>
            </div>

            {!data.feedback_given || data.feedback_given.length === 0 ? (
              <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500 ring-1 ring-slate-200">
                Geen feedback gegeven gevonden.
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                {data.feedback_given.map((group, idx) => (
                  <PeerFeedbackCard
                    key={idx}
                    name={group.reviewee_name || "—"}
                    comments={group.comments ?? []}
                  />
                ))}
              </div>
            )}
          </section>

          {/* SECTION 6 — Reflectie */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">
                Reflectie
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Inzichten en eigen reflectie van de leerling.
              </p>
            </div>

            {data.reflection?.text ? (
              <div className="mt-5 space-y-3">
                <p className="text-sm text-slate-500">
                  {data.reflection.submitted_at
                    ? new Date(data.reflection.submitted_at).toLocaleString()
                    : "—"}
                </p>
                <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {data.reflection.text}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() =>
                      navigator.clipboard.writeText(data.reflection?.text || "")
                    }
                  >
                    Kopieer tekst
                  </button>
                  <a
                    className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50"
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
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500 ring-1 ring-slate-200">
                Geen reflectie gevonden.
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
