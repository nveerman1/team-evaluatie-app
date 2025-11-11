"use client";

import { StudentEvaluation } from "@/dtos";
import Link from "next/link";

type EvaluationCardProps = {
  evaluation: StudentEvaluation;
};

export function EvaluationCard({ evaluation }: EvaluationCardProps) {
  const getStatusBadge = () => {
    if (evaluation.progress === 100) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800">
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
          Gesloten
        </span>
      );
    }
    if (evaluation.status === "open") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
          Open
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
        {evaluation.status}
      </span>
    );
  };

  // Get deadlines from evaluation settings
  const reviewDeadline = evaluation.settings?.deadlines?.review || 
                         evaluation.deadlines?.review;
  const reflectionDeadline = evaluation.settings?.deadlines?.reflection ||
                             evaluation.deadlines?.reflection;

  return (
    <div className="rounded-lg shadow-sm p-4 flex flex-col gap-2 bg-white w-full">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-medium flex items-center gap-2">
            {evaluation.title}
            {getStatusBadge()}
          </div>
          {(reviewDeadline || reflectionDeadline) && (
            <div className="text-sm text-gray-500 mt-1">
              {reviewDeadline && `Evaluatie deadline: ${reviewDeadline}`}
              {reviewDeadline && reflectionDeadline && " | "}
              {reflectionDeadline && `Reflectie deadline: ${reflectionDeadline}`}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/student/${evaluation.id}?step=1`}
            className="rounded-lg bg-blue-600 text-white text-sm px-3 py-1.5"
          >
            Evaluatie Invullen
          </Link>
          <Link
            href={`/student/evaluation/${evaluation.id}/overzicht`}
            className="rounded-lg bg-fuchsia-600 text-white text-sm px-3 py-1.5"
          >
            Feedback Overzicht
          </Link>
          <Link
            href={`/student/evaluation/${evaluation.id}/reflectie`}
            className="rounded-lg bg-indigo-600 text-white text-sm px-3 py-1.5"
          >
            Reflectie
          </Link>
        </div>
      </div>
      {/* Progress indicators */}
      <div className="text-sm text-gray-600 flex flex-wrap gap-4">
        <span className={evaluation.selfCompleted ? "text-green-700" : "text-gray-400"}>
          {evaluation.selfCompleted ? "✓" : "○"} Zelfbeoordeling
        </span>
        <span className={evaluation.peersCompleted === evaluation.peersTotal && evaluation.peersTotal > 0 ? "text-green-700" : "text-gray-400"}>
          {evaluation.peersCompleted === evaluation.peersTotal && evaluation.peersTotal > 0 ? "✓" : "○"} Peer-evaluaties ({evaluation.peersCompleted}/{evaluation.peersTotal})
        </span>
        <span className={evaluation.reflectionCompleted ? "text-green-700" : "text-gray-400"}>
          {evaluation.reflectionCompleted ? "✓" : "○"} Reflectie
        </span>
      </div>
    </div>
  );
}
