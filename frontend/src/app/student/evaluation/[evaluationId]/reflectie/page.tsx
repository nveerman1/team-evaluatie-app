"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loading, ErrorMessage } from "@/components";
import { ReflectionStep } from "@/components/student";
import { studentService } from "@/services";
import { studentStyles } from "@/styles/student-dashboard.styles";

export default function ReflectiePage() {
  const params = useParams();
  const router = useRouter();
  const evaluationId = Number(params.evaluationId);

  const [reflection, setReflection] = useState<{
    text: string;
    submitted_at?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!evaluationId) return;

    setLoading(true);
    studentService
      .getReflection(evaluationId)
      .then((data) => setReflection(data))
      .catch(() => setReflection(null))
      .finally(() => setLoading(false));
  }, [evaluationId]);

  async function saveReflection(text: string, submit: boolean) {
    await studentService.submitReflection(evaluationId, { text, submit });
    // Refresh reflection
    const updated = await studentService.getReflection(evaluationId);
    setReflection(updated);
  }

  if (loading) return <Loading />;

  return (
    <div className={studentStyles.layout.pageContainer}>
      {/* Header */}
      <div className={studentStyles.header.container}>
        <header className={studentStyles.header.wrapper}>
          <div className={studentStyles.header.flexContainer}>
            <div className={studentStyles.header.titleSection}>
              <h1 className={studentStyles.header.title}>
                Reflectie Schrijven
              </h1>
              <p className={studentStyles.header.subtitle}>
                Schrijf je reflectie op de evaluatie
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

      {/* Main Content */}
      <main className={studentStyles.layout.contentWrapper}>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <ReflectionStep
          evaluationId={evaluationId}
          onSave={saveReflection}
          initialText={reflection?.text || ""}
          submitted={!!reflection?.submitted_at}
        />
        </div>
      </main>
    </div>
  );
}
