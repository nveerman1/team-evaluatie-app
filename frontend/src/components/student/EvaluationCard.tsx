"use client";

import { StudentEvaluation } from "@/dtos";
import Link from "next/link";

type EvaluationCardProps = {
  evaluation: StudentEvaluation;
};

export function EvaluationCard({ evaluation }: EvaluationCardProps) {
  const getProgressColor = (progress: number) => {
    if (progress === 100) return "bg-green-500";
    if (progress >= 50) return "bg-yellow-500";
    return "bg-gray-300";
  };

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

  const getButtonText = () => {
    if (evaluation.progress === 0) return "Start";
    if (evaluation.progress === 100) return "Bekijk";
    return "Doorgaan";
  };

  const deadline = evaluation.settings?.deadlines?.review || 
                   evaluation.deadlines?.review;

  return (
    <div className="p-4 border rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-lg">{evaluation.title}</h3>
            {getStatusBadge()}
          </div>
          
          <div className="text-sm text-gray-600 space-y-1">
            {deadline && (
              <div>
                <span className="font-medium">Deadline:</span> {deadline}
              </div>
            )}
            
            <div className="flex gap-4">
              <span>
                Zelfbeoordeling: {evaluation.selfCompleted ? "✓" : "−"}
              </span>
              <span>
                Peer-reviews: {evaluation.peersCompleted}/{evaluation.peersTotal}
              </span>
              <span>
                Reflectie: {evaluation.reflectionCompleted ? "✓" : "−"}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center gap-2 text-sm mb-1">
              <span className="text-gray-600">Voortgang:</span>
              <span className="font-medium">{evaluation.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${getProgressColor(
                  evaluation.progress
                )}`}
                style={{ width: `${evaluation.progress}%` }}
              />
            </div>
          </div>
        </div>

        <Link
          href={`/student/${evaluation.id}?step=${evaluation.nextStep || 1}`}
          className="px-4 py-2 rounded-xl bg-black text-white hover:bg-gray-800 transition-colors whitespace-nowrap"
        >
          {getButtonText()}
        </Link>
      </div>
    </div>
  );
}
