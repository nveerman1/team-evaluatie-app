"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loading, ErrorMessage } from "@/components";
import { FeedbackSummary } from "@/components/student";
import { studentService, evaluationService, courseService } from "@/services";
import api from "@/lib/api";
import type { MyAllocation, DashboardResponse } from "@/dtos";
import type { Evaluation } from "@/dtos/evaluation.dto";
import type { Course } from "@/dtos/course.dto";

type TabKey = "summary" | "peers" | "reflection";

export default function OverzichtPage() {
  const params = useParams();
  const router = useRouter();
  const evaluationId = Number(params.evaluationId);

  const [allocs, setAllocs] = useState<MyAllocation[]>([]);
  const [dash, setDash] = useState<DashboardResponse | undefined>();
  const [evaluation, setEvaluation] = useState<Evaluation | undefined>();
  const [course, setCourse] = useState<Course | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingDash, setLoadingDash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("summary");

  // Load allocations
  useEffect(() => {
    if (!evaluationId) return;

    setLoading(true);
    studentService
      .getAllocations(evaluationId)
      .then((data) => setAllocs(data))
      .catch((e) => {
        setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
      })
      .finally(() => setLoading(false));
  }, [evaluationId]);

  // Load evaluation metadata
  useEffect(() => {
    if (!evaluationId) return;

    evaluationService
      .getEvaluation(evaluationId)
      .then((data) => {
        setEvaluation(data);
        // Load course info
        if (data.course_id) {
          courseService
            .getCourse(data.course_id)
            .then((courseData) => setCourse(courseData))
            .catch(() => {
              // Silent fail for course
            });
        }
      })
      .catch(() => {
        // Silent fail for evaluation
      });
  }, [evaluationId]);

  // Load dashboard data
  useEffect(() => {
    if (!evaluationId) return;

    setLoadingDash(true);
    api
      .get<DashboardResponse>(`/dashboard/evaluation/${evaluationId}`, {
        params: { include_breakdown: true },
      })
      .then((r) => setDash(r.data))
      .catch(() => {
        // Silent fail
      })
      .finally(() => setLoadingDash(false));
  }, [evaluationId]);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;

  const selfAlloc = allocs.find((a) => a.is_self);
  const selfUserId = selfAlloc?.reviewee_id;
  const myRow = dash?.items.find((r) => r.user_id === selfUserId);

  // Extract OMZA categories in order
  const omzaCategories = ["Organiseren", "Meedoen", "Zelfvertrouwen", "Autonomie"];

  // Format deadline
  const deadlineText = evaluation?.deadlines?.review
    ? new Date(evaluation.deadlines.review).toLocaleDateString("nl-NL")
    : "Niet ingesteld";

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
                Evaluatie Overzicht
              </h1>
              <p className="text-gray-600 mt-1 text-sm">
                Hier zie je een overzicht van je scores en een samenvatting van de
                ontvangen peer-feedback.
              </p>
            </div>
            <button
              onClick={() => router.push("/student")}
              className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Terug
            </button>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-6 py-6">
        {loadingDash && <Loading />}

        {!loadingDash && dash && (
          <div className="space-y-4">
            {/* Title Card - matching EvaluationCard header */}
            <article className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-semibold text-slate-900">
                      {evaluation?.title || `Evaluatie ${evaluationId}`}
                    </h2>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                        evaluation?.status === "open"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                          : "bg-slate-50 text-slate-700 ring-slate-200"
                      }`}
                    >
                      {evaluation?.status === "open" ? "Open" : "Afgerond"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {course?.name || evaluation?.cluster || "Cursus"} • Deadline: {deadlineText}
                  </p>
                </div>
              </div>
            </article>

            {/* Tabs - matching DetailModal tabs */}
            <div className="rounded-2xl border border-slate-200 bg-white/80 shadow-sm">
              <div className="border-b border-slate-200 px-6 pt-3">
                <div className="flex gap-2">
                  {(
                    [
                      { key: "summary", label: "Samenvatting" },
                      { key: "peers", label: "Feedback per teamgenoot" },
                      { key: "reflection", label: "Eigen reflectie" },
                    ] as { key: TabKey; label: string }[]
                  ).map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        tab === t.key
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="px-6 py-4">
                {tab === "summary" && (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      {/* AI-samenvatting + docent-opmerkingen */}
                      <div className="space-y-3 md:col-span-2">
                        {/* AI Summary using FeedbackSummary component */}
                        {selfUserId && (
                          <FeedbackSummary
                            evaluationId={evaluationId}
                            studentId={selfUserId}
                          />
                        )}

                        {/* Teacher Comments placeholder */}
                        <div className="rounded-xl border border-slate-100 bg-white p-4">
                          <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
                            <span>Opmerkingen van de docent</span>
                            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-indigo-600">
                              Docent
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">
                            Geen opmerkingen toegevoegd.
                          </p>
                        </div>
                      </div>

                      {/* Right column: GCF/SPR + Teacher Grade */}
                      <div className="space-y-3">
                        {/* GCF - Team contribution */}
                        {myRow && (
                          <div className="rounded-xl border border-slate-100 bg-indigo-50/70 p-3">
                            <p className="text-xs font-semibold text-slate-700">
                              Team-bijdrage (GCF)
                            </p>
                            <div className="mt-2 flex items-baseline justify-between">
                              <p className="text-2xl font-semibold text-slate-900">
                                {myRow.gcf.toFixed(2)}
                              </p>
                              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700">
                                {myRow.gcf >= 1.05
                                  ? "Boven verwachting"
                                  : myRow.gcf >= 0.95
                                  ? "Naar verwachting"
                                  : "Onder verwachting"}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500">
                              Range 0,90 – 1,10
                            </p>
                          </div>
                        )}

                        {/* SPR */}
                        {myRow && (
                          <div className="rounded-xl border border-slate-100 bg-green-50/70 p-3">
                            <p className="text-xs font-semibold text-slate-700">
                              SPR (Self-Peer Ratio)
                            </p>
                            <div className="mt-2">
                              <p className="text-2xl font-semibold text-slate-900">
                                {myRow.spr.toFixed(2)}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                Self: {myRow.self_avg_overall?.toFixed(2) ?? "−"}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Teacher grade placeholder */}
                        <div className="rounded-xl border border-slate-100 bg-white p-3">
                          <p className="text-xs font-semibold text-slate-700">Docentbeoordeling</p>
                          <div className="mt-2">
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">
                              Eindcijfer sprint
                            </p>
                            <p className="text-2xl font-semibold text-slate-900">
                              {myRow?.suggested_grade.toFixed(1) ?? "−"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* OMZA Scores - 4 cards matching DetailModal style */}
                    {myRow?.category_averages && myRow.category_averages.length > 0 && (
                      <div className="grid gap-3 md:grid-cols-4">
                        {omzaCategories.map((category) => {
                          const catAvg = myRow.category_averages?.find(
                            (ca) => ca.category === category
                          );
                          if (!catAvg) return null;

                          return (
                            <div
                              key={category}
                              className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                            >
                              <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>{category}</span>
                                <div className="text-right">
                                  <span className="block font-medium text-slate-700">
                                    Gem.: {catAvg.peer_avg.toFixed(1)}
                                  </span>
                                  <span className="block text-[11px] text-slate-500">
                                    Δ 0,0 t.o.v. vorige scan
                                  </span>
                                </div>
                              </div>
                              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200">
                                <div
                                  className="h-1.5 rounded-full bg-indigo-500"
                                  style={{
                                    width: `${(catAvg.peer_avg / (dash.rubric_scale_max || 4)) * 100}%`,
                                  }}
                                />
                              </div>
                              <p className="mt-1 text-[11px] text-slate-500">
                                Gebaseerd op scores van je teamgenoten.
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {tab === "peers" && (
                  <div className="space-y-3">
                    {allocs
                      .filter((a) => !a.is_self)
                      .map((allocation, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-slate-100 bg-slate-50/70 p-4"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-900">
                              {allocation.reviewee_name}
                            </h3>
                          </div>

                          {/* OMZA scores for this peer */}
                          {myRow?.category_averages && (
                            <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                              {omzaCategories.map((category) => {
                                const catAvg = myRow.category_averages?.find(
                                  (ca) => ca.category === category
                                );

                                return (
                                  <div
                                    key={category}
                                    className="rounded-lg border border-slate-200 bg-white p-2"
                                  >
                                    <p className="text-[10px] uppercase tracking-wide text-slate-500">
                                      {category}
                                    </p>
                                    <p className="mt-1 text-lg font-semibold text-slate-900">
                                      {catAvg?.peer_avg.toFixed(1) ?? "—"}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Feedback notes placeholder */}
                          <div className="rounded-lg border border-slate-200 bg-white p-3">
                            <p className="text-xs font-medium text-slate-500 mb-1">
                              Kernfeedback
                            </p>
                            <p className="text-sm leading-relaxed text-slate-700">
                              Nog geen feedback beschikbaar voor deze teamgenoot.
                            </p>
                          </div>
                        </div>
                      ))}

                    {allocs.filter((a) => !a.is_self).length === 0 && (
                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-sm text-slate-600">
                        Nog geen feedback van teamgenoten beschikbaar.
                      </div>
                    )}
                  </div>
                )}

                {tab === "reflection" && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                    <p className="text-sm text-slate-600">
                      Je hebt nog geen reflectie ingediend voor deze evaluatie.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!loadingDash && !dash && (
          <div className="rounded-2xl border border-slate-200 bg-white/80 shadow-sm p-6">
            <div className="text-center py-8 text-slate-500">
              Nog geen overzicht beschikbaar.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
