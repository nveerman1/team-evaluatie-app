"use client";

import React, { useState, useEffect } from "react";
import { skillTrainingService } from "@/services/skill-training.service";
import type { SkillTraining, SkillTrainingStatus } from "@/dtos/skill-training.dto";
import { STATUS_META } from "@/dtos/skill-training.dto";

interface SkillTrainingsSectionProps {
  studentId: number;
  courseId: number;
}

const VISIBLE_STATUSES: SkillTrainingStatus[] = [
  "planned",
  "in_progress",
  "submitted",
  "completed",
  "mastered",
];

interface TrainingRow {
  training: SkillTraining;
  status: SkillTrainingStatus;
}

export function SkillTrainingsSection({ studentId, courseId }: SkillTrainingsSectionProps) {
  const [rows, setRows] = useState<TrainingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const matrix = await skillTrainingService.getProgressMatrix(courseId);

        const studentRow = matrix.students.find((s) => s.student_id === studentId);
        const progress = studentRow?.progress ?? {};

        const visibleRows: TrainingRow[] = matrix.trainings
          .filter((t) => {
            const status = progress[t.id] as SkillTrainingStatus | undefined;
            return status !== undefined && VISIBLE_STATUSES.includes(status);
          })
          .map((t) => ({
            training: t,
            status: progress[t.id] as SkillTrainingStatus,
          }));

        setRows(visibleRows);
      } catch (error) {
        console.error("Error fetching skill trainings:", error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [studentId, courseId]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Vaardigheidstrainingen</h3>
        <div className="animate-pulse space-y-2">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Vaardigheidstrainingen</h3>

      {rows.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Geen vaardigheidstrainingen gevonden</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-[30%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Training
                </th>
                <th className="w-[20%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Competentie
                </th>
                <th className="w-[25%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Leerdoel
                </th>
                <th className="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Niveau
                </th>
                <th className="w-[15%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map(({ training, status }) => {
                const meta = STATUS_META[status];
                return (
                  <tr key={training.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="line-clamp-2 whitespace-normal break-words">
                        {training.title}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="line-clamp-1">
                        {training.competency_category_name || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="line-clamp-2 whitespace-normal break-words">
                        {training.learning_objective_title || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {training.level || "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${meta.colorClass}`}
                      >
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
