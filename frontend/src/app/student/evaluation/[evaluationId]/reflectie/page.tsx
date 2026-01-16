"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loading } from "@/components";

export default function ReflectiePage() {
  const params = useParams();
  const router = useRouter();
  const evaluationId = Number(params.evaluationId);

  useEffect(() => {
    // Redirect to the new Resultaat page
    if (evaluationId) {
      router.replace(`/student/evaluation/${evaluationId}/overzicht`);
    }
  }, [evaluationId, router]);

  return <Loading />;
}
