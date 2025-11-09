"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useNumericEvalId } from "@/lib/id";
import {
  MyAllocation,
  Criterion,
  ScoreItem,
  DashboardResponse,
} from "@/dtos";
import {
  WizardProgress,
  SelfEvaluationStep,
  PeerReviewStep,
  ReflectionStep,
  FeedbackSummary,
} from "@/components/student";
import { Loading, ErrorMessage } from "@/components";
import { studentService } from "@/services";
import api from "@/lib/api";

export default function StudentWizardInner() {
  const evaluationIdNum = useNumericEvalId();
  const sp = useSearchParams();
  const step = Number(sp.get("step") ?? 1);
  const router = useRouter();

  const [allocs, setAllocs] = useState<MyAllocation[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [rubricId, setRubricId] = useState<number | undefined>();
  const [sending, setSending] = useState(false);
  const [dash, setDash] = useState<DashboardResponse | undefined>();
  const [reflection, setReflection] = useState<{
    text: string;
    submitted_at?: string;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loadingAlloc, setLoadingAlloc] = useState(false);
  const [loadingDash, setLoadingDash] = useState(false);

  const evaluationId = evaluationIdNum != null ? String(evaluationIdNum) : "—";

  // Load allocations and criteria
  useEffect(() => {
    setError(null);

    if (evaluationIdNum == null) {
      setAllocs([]);
      setCriteria([]);
      setRubricId(undefined);
      return;
    }

    setLoadingAlloc(true);
    studentService
      .getAllocations(evaluationIdNum)
      .then(async (data) => {
        setAllocs(data);

        const rid = data?.[0]?.rubric_id;
        setRubricId(rid);

        if (rid) {
          try {
            const criteriaData = await studentService.getCriteria(rid);
            setCriteria(criteriaData);
          } catch (e: any) {
            // Silent fail for criteria
          }
        } else {
          setCriteria([]);
        }
      })
      .catch((e) => {
        setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
      })
      .finally(() => setLoadingAlloc(false));
  }, [evaluationIdNum]);

  // Load dashboard data for step 3
  useEffect(() => {
    if (evaluationIdNum == null || step !== 3) {
      setDash(undefined);
      return;
    }
    setLoadingDash(true);
    api
      .get<DashboardResponse>(`/dashboard/evaluation/${evaluationIdNum}`, {
        params: { include_breakdown: true },
      })
      .then((r) => setDash(r.data))
      .catch(() => {
        // Silent fail
      })
      .finally(() => setLoadingDash(false));
  }, [evaluationIdNum, step]);

  // Load reflection for step 4
  useEffect(() => {
    if (evaluationIdNum == null || step !== 4) {
      return;
    }
    studentService
      .getReflection(evaluationIdNum)
      .then((data) => setReflection(data))
      .catch(() => setReflection(null));
  }, [evaluationIdNum, step]);

  const selfAlloc = useMemo(() => allocs.find((a) => a.is_self), [allocs]);
  const peerAllocs = useMemo(() => allocs.filter((a) => !a.is_self), [allocs]);

  const selfCompleted = selfAlloc?.completed ?? false;
  const peersCompleted = peerAllocs.filter((a) => a.completed).length;
  const reflectionSubmitted = !!reflection?.submitted_at;

  async function submitScores(allocationId: number, items: ScoreItem[]) {
    setSending(true);
    try {
      await studentService.submitScores(allocationId, items);
      alert("Ingeleverd ✔");
      // Refresh allocations to update completion status
      if (evaluationIdNum) {
        const updated = await studentService.getAllocations(evaluationIdNum);
        setAllocs(updated);
        // Auto-advance from step 1 to step 2 after submitting self-evaluation
        if (step === 1) {
          router.replace(`/student/${evaluationIdNum}?step=2`);
        }
      }
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.message || "Inleveren mislukt");
    } finally {
      setSending(false);
    }
  }

  async function saveReflection(text: string, submit: boolean) {
    if (evaluationIdNum == null) return;
    await studentService.submitReflection(evaluationIdNum, { text, submit });
    // Refresh reflection
    const updated = await studentService.getReflection(evaluationIdNum);
    setReflection(updated);
  }

  function goStep(n: number) {
    if (evaluationIdNum == null) return;
    router.replace(`/student/${evaluationIdNum}?step=${n}`);
  }

  const steps = [
    {
      number: 1,
      label: "Zelfbeoordeling",
      completed: selfCompleted,
    },
    {
      number: 2,
      label: "Peer-reviews",
      completed: peerAllocs.length > 0 && peersCompleted === peerAllocs.length,
    },
    {
      number: 3,
      label: "Overzicht",
      completed: true, // Always accessible
    },
    {
      number: 4,
      label: "Reflectie",
      completed: reflectionSubmitted,
    },
  ];

  if (loadingAlloc) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (evaluationIdNum == null) {
    return (
      <ErrorMessage message="Geen geldige evaluatie. Open deze wizard via een bestaande evaluatie." />
    );
  }

  const selfCriteria = selfAlloc
    ? selfAlloc.criterion_ids
        .map((id) => criteria.find((c) => c.id === id))
        .filter((c): c is Criterion => c !== undefined)
    : [];

  const peerCriteria = criteria;

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Evaluatie Wizard</h1>
          <div className="flex gap-2 items-center">
            <span className="text-sm text-gray-500">
              Evaluatie #{evaluationId}
            </span>
            <button
              onClick={() => router.push("/student")}
              className="px-4 py-2 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              Terug
            </button>
          </div>
        </div>

        <WizardProgress
          currentStep={step}
          steps={steps}
          onStepClick={goStep}
        />
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-xl border p-6">
        {/* Step 1: Self Evaluation */}
        {step === 1 && (
          <>
            <h2 className="text-2xl font-semibold mb-6">
              Stap 1: Zelfbeoordeling
            </h2>
            {!selfAlloc && (
              <div className="text-center py-8">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md mx-auto">
                  <p className="text-yellow-800 mb-4">
                    Je zelfbeoordeling wordt klaargezet. Probeer het zo opnieuw.
                  </p>
                  <button
                    onClick={() => {
                      if (evaluationIdNum) {
                        setLoadingAlloc(true);
                        studentService
                          .getAllocations(evaluationIdNum)
                          .then((data) => setAllocs(data))
                          .catch((e) => setError(e?.message || "Laden mislukt"))
                          .finally(() => setLoadingAlloc(false));
                      }
                    }}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                  >
                    Opnieuw proberen
                  </button>
                </div>
              </div>
            )}
            {selfAlloc && selfCriteria.length > 0 && (
              <SelfEvaluationStep
                allocationId={selfAlloc.allocation_id}
                criteria={selfCriteria}
                onSubmit={submitScores}
                sending={sending}
              />
            )}
          </>
        )}

        {/* Step 2: Peer Reviews */}
        {step === 2 && (
          <>
            <h2 className="text-2xl font-semibold mb-6">
              Stap 2: Peer-reviews
            </h2>
            {!selfCompleted && (
              <div className="bg-yellow-50 p-4 rounded-lg mb-6">
                <p className="text-sm text-yellow-800">
                  ⚠️ Voltooi eerst je zelfbeoordeling voordat je peers kunt
                  beoordelen.
                </p>
              </div>
            )}
            {selfCompleted && peerCriteria.length > 0 && (
              <PeerReviewStep
                peerAllocations={peerAllocs}
                criteria={peerCriteria}
                onSubmit={submitScores}
              />
            )}
          </>
        )}

        {/* Step 3: Overview */}
        {step === 3 && (
          <>
            <h2 className="text-2xl font-semibold mb-6">Stap 3: Overzicht</h2>
            <p className="text-gray-600 mb-6">
              Hier zie je een overzicht van je scores en een samenvatting van de
              ontvangen peer-feedback.
            </p>

            {loadingDash && <Loading />}

            {!loadingDash && dash && (
              <div className="space-y-6">
                {/* Scores Overview */}
                <div className="bg-white rounded-xl border p-6">
                  <h3 className="text-lg font-semibold mb-4">Jouw scores</h3>
                  
                  {/* Find current user in dashboard */}
                  {(() => {
                    const selfUserId = selfAlloc?.reviewee_id;
                    const myRow = dash.items.find((r) => r.user_id === selfUserId);
                    if (!myRow) {
                      return (
                        <p className="text-sm text-gray-500">
                          Nog geen scores beschikbaar.
                        </p>
                      );
                    }

                    // Extract categories from criteria
                    const categories = Array.from(
                      new Set(
                        dash.criteria
                          .map((c) => c.category)
                          .filter((c): c is string => !!c)
                      )
                    );

                    return (
                      <div className="space-y-6">
                        {/* GCF and SPR */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-blue-50 rounded-lg p-4">
                            <div className="text-sm text-blue-600 font-medium mb-1">
                              GCF (Group Contribution Factor)
                            </div>
                            <div className="flex items-baseline gap-2">
                              <div className="text-3xl font-bold text-blue-900">
                                {myRow.gcf.toFixed(2)}
                              </div>
                              <div className="text-sm text-blue-600">
                                Peer: {myRow.peer_avg_overall.toFixed(2)}
                              </div>
                            </div>
                            <p className="text-xs text-blue-700 mt-2">
                              Je bijdrage ten opzichte van teamgemiddelde
                            </p>
                          </div>

                          <div className="bg-green-50 rounded-lg p-4">
                            <div className="text-sm text-green-600 font-medium mb-1">
                              SPR (Self-Peer Ratio)
                            </div>
                            <div className="flex items-baseline gap-2">
                              <div className="text-3xl font-bold text-green-900">
                                {myRow.spr.toFixed(2)}
                              </div>
                              <div className="text-sm text-green-600">
                                Self: {myRow.self_avg_overall?.toFixed(2) ?? "−"}
                              </div>
                            </div>
                            <p className="text-xs text-green-700 mt-2">
                              Verhouding zelf- vs peer-beoordeling
                            </p>
                          </div>
                        </div>

                        {/* OMZA Scores (Category breakdown) */}
                        {categories.length > 0 && myRow.category_averages && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">
                              OMZA Scores per Categorie
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {categories.map((category) => {
                                const catAvg = myRow.category_averages?.find(
                                  (ca) => ca.category === category
                                );
                                if (!catAvg) return null;

                                return (
                                  <div
                                    key={category}
                                    className="bg-gray-50 border border-gray-200 rounded-lg p-3"
                                  >
                                    <div className="text-xs text-gray-600 font-medium mb-1">
                                      {category}
                                    </div>
                                    <div className="flex items-baseline gap-3">
                                      <div className="text-lg font-bold text-gray-900">
                                        Peer: {catAvg.peer_avg.toFixed(2)}
                                      </div>
                                      {catAvg.self_avg !== null && (
                                        <div className="text-sm text-blue-600">
                                          Self: {catAvg.self_avg.toFixed(2)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* AI Feedback Summary */}
                {(() => {
                  // Get current user ID from self allocation
                  const selfUserId = selfAlloc?.reviewee_id;
                  
                  if (selfUserId) {
                    return (
                      <FeedbackSummary
                        evaluationId={evaluationIdNum}
                        studentId={selfUserId}
                      />
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            {!loadingDash && !dash && (
              <div className="text-center py-8 text-gray-500">
                Nog geen overzicht beschikbaar.
              </div>
            )}
          </>
        )}

        {/* Step 4: Reflection */}
        {step === 4 && (
          <>
            <h2 className="text-2xl font-semibold mb-6">Stap 4: Reflectie</h2>
            <ReflectionStep
              evaluationId={evaluationIdNum}
              onSave={saveReflection}
              initialText={reflection?.text || ""}
              submitted={!!reflection?.submitted_at}
            />
          </>
        )}
      </div>
    </main>
  );
}
