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
    <main className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Reflectie Schrijven</h1>
          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/student/evaluation/${evaluationId}`)}
              className="px-4 py-2 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              Terug
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border p-6">
        <ReflectionStep
          evaluationId={evaluationId}
          onSave={saveReflection}
          initialText={reflection?.text || ""}
          submitted={!!reflection?.submitted_at}
        />
      </div>
    </main>
  );
}
