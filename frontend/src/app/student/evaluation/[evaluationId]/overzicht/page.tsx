"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loading, ErrorMessage } from "@/components";
import { FeedbackSummary, EvaluationReflectionSection } from "@/components/student";
import { AISummarySection } from "@/components/student/AISummarySection";
import { peerFeedbackResultsService, studentService, evaluationService, courseService } from "@/services";
import api from "@/lib/api";
import { canStudentSeeResult } from "@/lib/evaluation-helpers";
import type { EvaluationResult, OmzaKey, MyAllocation, DashboardResponse } from "@/dtos";
import type { Evaluation, EvaluationTeamContext, EvaluationTeam } from "@/dtos/evaluation.dto";
import type { Course } from "@/dtos/course.dto";
import {
  OMZA_LABELS,
  mean,
  round1,
  getOmzaEmoji,
  getOmzaEmojiColorClasses,
  formatDelta,
  getTeamContributionFactor,
  getTeamContributionLabel,
} from "@/components/student/peer-results/helpers";
import { studentStyles } from "@/styles/student-dashboard.styles";

export default function ResultaatPage() {
  const params = useParams();
  const router = useRouter();
  const evaluationId = Number(params.evaluationId);

  const [evaluationData, setEvaluationData] = useState<EvaluationResult | undefined>();
  const [evaluation, setEvaluation] = useState<Evaluation | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamContext, setTeamContext] = useState<EvaluationTeamContext | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // Load current user ID
  useEffect(() => {
    if (!evaluationId) return;
    
    const controller = new AbortController();
    
    async function loadUser() {
      try {
        const response = await api.get("/users/me", { signal: controller.signal });
        setCurrentUserId(response.data.id);
      } catch (e: any) {
        // Silently ignore 404 errors - try fallback method
        if (e.name !== 'AbortError' && e.name !== 'CanceledError' && e.message !== 'canceled') {
          if (e?.response?.status !== 404) {
            console.error("Failed to load current user:", e);
          }
          
          // Fallback: Get student ID from allocations
          try {
            const allocs = await studentService.getAllocations(evaluationId);
            const selfAlloc = allocs.find((a) => a.is_self);
            if (selfAlloc) {
              console.log("Using student ID from allocations:", selfAlloc.reviewee_id);
              setCurrentUserId(selfAlloc.reviewee_id);
            }
          } catch (allocError) {
            console.error("Failed to load student ID from allocations:", allocError);
          }
        }
      }
    }
    loadUser();
    
    return () => controller.abort();
  }, [evaluationId]);

  // Load team context
  useEffect(() => {
    if (!evaluationId) return;
    
    const controller = new AbortController();
    
    async function loadTeams() {
      try {
        const context = await evaluationService.getEvaluationTeams(
          evaluationId,
          controller.signal
        );
        setTeamContext(context);
      } catch (error: any) {
        if (error.name !== 'AbortError' && error.name !== 'CanceledError' && error.message !== 'canceled') {
          console.error('Failed to load team context:', error);
        }
      }
    }
    
    loadTeams();
    
    return () => controller.abort();
  }, [evaluationId]);

  // Load peer feedback results for this evaluation
  useEffect(() => {
    if (!evaluationId) return;

    setLoading(true);
    setError(null);
    
    // Load both evaluation metadata and peer results
    Promise.all([
      evaluationService.getEvaluation(evaluationId),
      peerFeedbackResultsService.getMyPeerResults()
    ])
      .then(async ([evalData, results]) => {
        setEvaluation(evalData);
        
        console.log("Peer results fetched:", results);
        console.log("Looking for evaluation ID:", evaluationId);
        
        // Find the evaluation with matching ID
        // The API returns IDs with "ev-" prefix, so we need to match both formats
        const evalResult = results.find((r) => {
          const match = r.id === String(evaluationId) || r.id === `ev-${evaluationId}`;
          console.log("Comparing:", r.id, "with", evaluationId, "match:", match);
          return match;
        });
        
        if (evalResult) {
          console.log("Found evaluation data:", evalResult);
          setEvaluationData(evalResult);
        } else {
          // Fallback: If not found in peer-results, try to build it from other APIs
          console.log("Evaluation not found in peer-results, trying fallback...");
          console.log("Available IDs:", results.map(r => r.id));
          try {
            const allocs = await studentService.getAllocations(evaluationId);
            
            const course = evalData.course_id 
              ? await courseService.getCourse(evalData.course_id).catch(() => null)
              : null;

            // Build a minimal EvaluationResult from available data
            const fallbackData: EvaluationResult = {
              id: String(evaluationId),
              title: evalData.title,
              course: course?.name || evalData.cluster || "Cursus",
              deadlineISO: evalData.deadlines?.review || evalData.settings?.deadlines?.review,
              status: evalData.status === "open" ? "open" : "closed",
              peers: [], // No peer data available yet
              omzaAverages: [],
            };
            
            console.log("Using fallback data:", fallbackData);
            setEvaluationData(fallbackData);
          } catch (fallbackError) {
            console.error("Fallback failed:", fallbackError);
            setError("Evaluatie niet gevonden of nog niet beschikbaar");
          }
        }
      })
      .catch((e) => {
        console.error("Failed to fetch evaluation or peer results:", e);
        setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
      })
      .finally(() => setLoading(false));
  }, [evaluationId]);

  // Calculate OMZA averages from peer data (if available)
  // Must be before early returns to follow Rules of Hooks
  const averages = useMemo(() => {
    if (!evaluationData || !evaluationData.peers || evaluationData.peers.length === 0) {
      return {
        organiseren: 0,
        meedoen: 0,
        zelfvertrouwen: 0,
        autonomie: 0,
      };
    }
    
    const obj: Record<OmzaKey, number> = {
      organiseren: 0,
      meedoen: 0,
      zelfvertrouwen: 0,
      autonomie: 0,
    };
    (Object.keys(obj) as OmzaKey[]).forEach((k) => {
      const list = evaluationData.peers.map((p) => p.scores[k]).filter(Boolean);
      obj[k] = round1(mean(list));
    });
    return obj;
  }, [evaluationData]);

  // Calculate team contribution factor and label
  // Must be before early returns to follow Rules of Hooks
  const teamContributionFactor = useMemo(() => {
    if (!evaluationData) return null;
    return getTeamContributionFactor(
      evaluationData.teamContributionFactor,
      evaluationData.gcfScore
    );
  }, [evaluationData]);

  const teamContributionLabel = useMemo(() => {
    if (!evaluationData) return null;
    return evaluationData.teamContributionLabel ??
      (teamContributionFactor != null
        ? getTeamContributionLabel(teamContributionFactor)
        : null);
  }, [evaluationData, teamContributionFactor]);

  // Use omzaAverages if provided, otherwise calculate from peers
  const omzaAverages = useMemo(() => {
    if (!evaluationData) return [];
    return evaluationData.omzaAverages ?? [
      { key: "O", label: OMZA_LABELS.organiseren, value: averages.organiseren, delta: 0 },
      { key: "M", label: OMZA_LABELS.meedoen, value: averages.meedoen, delta: 0 },
      { key: "Z", label: OMZA_LABELS.zelfvertrouwen, value: averages.zelfvertrouwen, delta: 0 },
      { key: "A", label: OMZA_LABELS.autonomie, value: averages.autonomie, delta: 0 },
    ];
  }, [evaluationData, averages]);

  // Find the student's team
  const myTeam = useMemo(() => {
    if (!teamContext || !currentUserId) return null;
    
    return teamContext.teams.find((team) => 
      team.members.some((member) => member.user_id === currentUserId)
    );
  }, [teamContext, currentUserId]);

  // Early returns AFTER all hooks
  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!evaluationData) {
    return <ErrorMessage message="Evaluatie niet gevonden" />;
  }

  // Check if student can see results (evaluation must be closed or open for now)
  if (evaluation && !canStudentSeeResult(evaluation.status)) {
    return (
      <div className={studentStyles.layout.pageContainer}>
        <div className={studentStyles.header.container}>
          <header className={studentStyles.header.wrapper}>
            <div className={studentStyles.header.flexContainer}>
              <div className={studentStyles.header.titleSection}>
                <h1 className={studentStyles.header.title}>Resultaat nog niet beschikbaar</h1>
              </div>
            </div>
          </header>
        </div>
        <main className="mx-auto max-w-6xl px-6 py-6">
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
            <div className="mx-auto max-w-md">
              <div className="mb-4 text-4xl">🔒</div>
              <p className="mb-6 text-base text-slate-700">
                Deze evaluatie is nog niet gepubliceerd door de docent.
              </p>
              <button
                onClick={() => router.push("/student")}
                className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Terug naar dashboard
              </button>
            </div>
          </article>
        </main>
      </div>
    );
  }

  return (
    <div className={studentStyles.layout.pageContainer}>
      {/* Header */}
      <div className={studentStyles.header.container}>
        <header className={studentStyles.header.wrapper}>
          <div className={studentStyles.header.flexContainer}>
            <div className={studentStyles.header.titleSection}>
              <h1 className={studentStyles.header.title}>
                Resultaat
              </h1>
              <p className={studentStyles.header.subtitle}>
                Hier zie je je scores, feedback van teamgenoten en docentbeoordeling.
              </p>
            </div>
            <button
              onClick={() => router.push("/student")}
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:self-start"
            >
              Terug
            </button>
          </div>
        </header>
      </div>

      {/* Main Content - Single Card matching EvaluationCard style */}
      <main className="mx-auto max-w-6xl px-6 py-6">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {/* Card header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-slate-900">
                  {evaluationData.title}
                </h2>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                    evaluationData.status === "open"
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                      : "bg-slate-50 text-slate-700 ring-slate-200"
                  }`}
                >
                  {evaluationData.status === "open" ? "Open" : "Afgerond"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {evaluationData.course} • Deadline:{" "}
                {evaluationData.deadlineISO
                  ? new Date(evaluationData.deadlineISO).toLocaleDateString("nl-NL")
                  : "Niet ingesteld"}
              </p>
            </div>
          </div>

          {/* Card content */}
          {/* PEER CARDS SECTION - Feedback Teamgenoten */}
          <div className="mt-6">
            <h3 className="text-base font-semibold text-slate-900 mb-3">Feedback Teamgenoten</h3>
            
            <div className="grid gap-4 md:grid-cols-3">
              {/* AI-samenvatting */}
              <div className="flex flex-col gap-3 md:col-span-2">
                {currentUserId && (
                  <AISummarySection
                    evaluationId={evaluationId}
                    studentId={currentUserId}
                    fallbackSummary={evaluationData.aiSummary}
                    useAsync={true}
                  />
                )}
              </div>

              {/* Right column: Teambeoordeling */}
              <div className="space-y-3">
                {/* Teambeoordeling - Teacher OMZA scores */}
                {evaluationData.teacherOmza && Object.keys(evaluationData.teacherOmza).length > 0 && (
                  <div className="rounded-xl border border-slate-100 bg-indigo-50/60 p-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-3">
                      <span>Teambeoordeling</span>
                    </div>
                    
                    {/* OMZA scores table */}
                    <div className="space-y-2">
                      {Object.entries(evaluationData.teacherOmza).map(([key, value]) => {
                        // Get corresponding peer average and delta for comparison
                        // omzaAverages uses short keys (O, M, Z, A) matching teacherOmza
                        const peerAvg = evaluationData.omzaAverages?.find(avg => avg.key === key);
                        const delta = peerAvg?.delta ?? 0;
                        
                        // Color based on teacher score (1-4 scale)
                        const getOmzaColor = (score: number) => {
                          if (score >= 3.5) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
                          if (score >= 2.5) return "bg-green-50 text-green-700 ring-green-200";
                          if (score >= 1.5) return "bg-amber-50 text-amber-700 ring-amber-200";
                          return "bg-rose-50 text-rose-700 ring-rose-200";
                        };
                        
                        return (
                          <div key={key} className="flex items-center justify-between text-xs">
                            <span className="text-slate-600 font-medium">{key}</span>
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ring-1 text-xs font-semibold ${getOmzaColor(value)}`}>
                                {value.toFixed(1)}
                              </span>
                              {delta !== 0 && (
                                <span className={`text-[10px] font-medium ${
                                  delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-slate-500"
                                }`}>
                                  {delta > 0 ? "↑" : "↓"}{Math.abs(delta).toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Pills row */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {/* GCF pill */}
                      {teamContributionFactor != null && (
                        <span className="inline-flex items-center rounded-full bg-white/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-indigo-600 font-semibold">
                          GCF: {teamContributionFactor.toFixed(2)}
                        </span>
                      )}
                      {/* SPR pill */}
                      {evaluationData.sprScore != null && (
                        <span className="inline-flex items-center rounded-full bg-white/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600 font-semibold">
                          SPR: {evaluationData.sprScore.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Fallback: Show GCF even if no teacher OMZA */}
                {!evaluationData.teacherOmza && teamContributionFactor != null && (
                  <div className="rounded-xl border border-slate-100 bg-indigo-50/60 p-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
                      <span>Team-bijdrage</span>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-indigo-600">
                        Correctiefactor
                      </span>
                    </div>
                    <div className="mt-2">
                      <p className="text-2xl font-semibold text-slate-900">
                        {teamContributionFactor.toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-500">Range 0,90 – 1,10</p>
                    </div>
                  </div>
                )}
              </div>
            </div>


          </div>

          {/* DOCENT CARDS SECTION - Teacher comments and evaluation */}
          {(evaluationData.teacherComments || evaluationData.teacherGrade != null || evaluationData.teacherSuggestedGrade != null || evaluationData.teacherGroupGrade != null || evaluationData.teacherOmza) && (
            <div className="mt-6">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Docentbeoordeling</h3>
              <div className="grid gap-4 md:grid-cols-3">
                {/* Teacher comments */}
                {evaluationData.teacherComments && (
                  <div className="md:col-span-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3 flex flex-col">
                    <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
                      <span>Opmerkingen van de docent</span>
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-indigo-600">
                        Docent
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-700">
                      {evaluationData.teacherComments}
                    </p>
                  </div>
                )}

                {/* Docentbeoordeling cijfers card */}
                {(evaluationData.teacherGrade != null || evaluationData.teacherSuggestedGrade != null || evaluationData.teacherOmza) && (
                  <div className={`rounded-xl border border-slate-100 bg-slate-50/70 p-3 ${!evaluationData.teacherComments ? 'md:col-span-3' : ''}`}>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
                      <span>Docentbeoordeling</span>
                    </div>
                    
                    {/* Display final grade (given or auto-generated) */}
                    {(evaluationData.teacherGrade != null || evaluationData.teacherSuggestedGrade != null) && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Eindcijfer</p>
                        <p className="text-2xl font-semibold text-slate-900">
                          {(evaluationData.teacherGrade ?? evaluationData.teacherSuggestedGrade)?.toFixed(1)}
                        </p>
                        {evaluationData.teacherGrade == null && evaluationData.teacherSuggestedGrade != null && (
                          <p className="text-[10px] text-slate-400 mt-0.5">(automatisch berekend)</p>
                        )}
                      </div>
                    )}

                    {/* Group grade if available */}
                    {evaluationData.teacherGroupGrade != null && (
                      <div className="mt-2 pt-2 border-t border-slate-200">
                        <p className="text-[11px] text-slate-500">
                          Groepscijfer: <span className="font-semibold text-slate-700">{evaluationData.teacherGroupGrade.toFixed(1)}</span>
                        </p>
                      </div>
                    )}

                    {evaluationData.teacherOmza && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {Object.entries(evaluationData.teacherOmza).map(([key, value]) => (
                          <span
                            key={key}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ring-1 ring-slate-200"
                          >
                            <span className="text-[10px] font-semibold text-slate-700 mr-1">{key}</span>
                            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] shadow-sm ${getOmzaEmojiColorClasses(value)}`}>
                              {getOmzaEmoji(value)}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </article>

        {/* Reflection Section */}
        <div className="mt-6">
          <EvaluationReflectionSection evaluationId={evaluationId} />
        </div>
      </main>
    </div>
  );
}
