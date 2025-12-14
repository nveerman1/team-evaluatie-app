"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useNumericEvalId } from "@/lib/id";
import {
  MyAllocation,
  Criterion,
  ScoreItem,
} from "@/dtos";
import {
  WizardProgress,
  SelfEvaluationStep,
  PeerReviewStep,
} from "@/components/student";
import { Loading, ErrorMessage } from "@/components";
import { studentService } from "@/services";
import { studentStyles } from "@/styles/student-dashboard.styles";

export default function StudentWizardInner() {
  const evaluationIdNum = useNumericEvalId();
  const sp = useSearchParams();
  const step = Number(sp.get("step") ?? 1);
  const router = useRouter();

  const [allocs, setAllocs] = useState<MyAllocation[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [rubricId, setRubricId] = useState<number | undefined>();
  const [sending, setSending] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loadingAlloc, setLoadingAlloc] = useState(false);

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



  const selfAlloc = useMemo(() => allocs.find((a) => a.is_self), [allocs]);
  const peerAllocs = useMemo(() => allocs.filter((a) => !a.is_self), [allocs]);

  const selfCompleted = selfAlloc?.completed ?? false;
  const peersCompleted = peerAllocs.filter((a) => a.completed).length;

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
    <div className={studentStyles.layout.pageContainer}>
      {/* Header */}
      <div className={studentStyles.header.container}>
        <header className={studentStyles.header.wrapper}>
          <div className="mb-4 flex items-center justify-between">
            <div className={studentStyles.header.titleSection}>
              <h1 className={studentStyles.header.title}>
                Evaluatie Invullen
              </h1>
              <p className={studentStyles.header.subtitle}>
                Evaluatie #{evaluationId}
              </p>
            </div>
            <button
              onClick={() => router.push("/student")}
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Terug
            </button>
          </div>

          <WizardProgress
            currentStep={step}
            steps={steps}
            onStepClick={goStep}
          />
        </header>
      </div>

      {/* Main Content */}
      <main className={studentStyles.layout.contentWrapper}>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Step 1: Self Evaluation */}
        {step === 1 && (
          <>
            <h2 className={studentStyles.typography.sectionTitle + " mb-6"}>
              Stap 1: Zelfbeoordeling
            </h2>
            {!selfAlloc && (
              <div className="py-8 text-center">
                <div className="mx-auto max-w-md rounded-xl border border-amber-200 bg-amber-50 p-6">
                  <p className="mb-4 text-amber-800">
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
                    className={studentStyles.buttons.primary + " px-4 py-2 text-white"}
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
            <h2 className={studentStyles.typography.sectionTitle + " mb-6"}>
              Stap 2: Peer-reviews
            </h2>
            {!selfCompleted && (
              <div className="mb-6 rounded-xl bg-amber-50 p-4">
                <p className="text-sm text-amber-800">
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
        </div>
      </main>
    </div>
  );
}
