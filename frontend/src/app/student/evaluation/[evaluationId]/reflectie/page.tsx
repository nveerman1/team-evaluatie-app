"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loading, ErrorMessage } from "@/components";
import { ReflectionStep } from "@/components/student";
import { studentService } from "@/services";

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
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
                Reflectie Schrijven
              </h1>
              <p className="text-gray-600 mt-1 text-sm">
                Schrijf je reflectie op de evaluatie
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
      <main className="max-w-6xl mx-auto px-6 py-6">
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
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
