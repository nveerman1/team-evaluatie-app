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
        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
          Voltooid
        </span>
      );
    }
    if (evaluation.status === "open") {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
          Open
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
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
    <div className="p-5 border rounded-xl bg-white shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h4 className="text-lg font-semibold mb-2">{evaluation.title}</h4>
          <div className="text-sm text-gray-600 space-y-1">
            {reviewDeadline && (
              <p className="text-sm text-gray-500">
                Evaluatie deadline: {reviewDeadline}
              </p>
            )}
            {reflectionDeadline && (
              <p className="text-sm text-gray-500">
                Reflectie deadline: {reflectionDeadline}
              </p>
            )}
          </div>
        </div>
        {getStatusBadge()}
      </div>

      <div className="flex gap-3 flex-wrap">
        <Link
          href={`/student/${evaluation.id}?step=1`}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          Evaluatie Invullen
        </Link>
        <Link
          href={`/student/${evaluation.id}?step=3`}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
        >
          Feedback Overzicht
        </Link>
        <Link
          href={`/student/${evaluation.id}?step=4`}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
        >
          Reflectie
        </Link>
      </div>
    </div>
  );
}
