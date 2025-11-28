"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { competencyService } from "@/services";
import type { TeacherGoalsList } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import Link from "next/link";

export default function LeerdoelenTabPage() {
  const params = useParams();
  const windowId = Number(params.windowId);

  const [data, setData] = useState<TeacherGoalsList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await competencyService.getWindowGoals(
        windowId,
        undefined,
        statusFilter || undefined
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [windowId, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleRow = (id: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      in_progress: "bg-blue-100 text-blue-700",
      achieved: "bg-green-100 text-green-700",
      not_achieved: "bg-red-100 text-red-700",
    };
    const labels: Record<string, string> = {
      in_progress: "In uitvoering",
      achieved: "Behaald",
      not_achieved: "Niet behaald",
    };
    return (
      <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-700"}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <ErrorMessage message="Data not found" />;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-4 border rounded-xl bg-blue-50/80">
          <div className="text-sm text-gray-600">Totaal leerdoelen</div>
          <div className="text-2xl font-bold">{data.items.length}</div>
        </div>
        <div className="p-4 border rounded-xl bg-green-50/80">
          <div className="text-sm text-gray-600">Behaald</div>
          <div className="text-2xl font-bold">
            {data.items.filter((i) => i.status === "achieved").length}
          </div>
        </div>
        <div className="p-4 border rounded-xl bg-purple-50/80">
          <div className="text-sm text-gray-600">In uitvoering</div>
          <div className="text-2xl font-bold">
            {data.items.filter((i) => i.status === "in_progress").length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 border rounded-xl bg-white shadow-sm">
        <label className="text-sm font-medium text-gray-700">Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Alle</option>
          <option value="in_progress">In uitvoering</option>
          <option value="achieved">Behaald</option>
          <option value="not_achieved">Niet behaald</option>
        </select>
        {statusFilter && (
          <button
            onClick={() => setStatusFilter("")}
            className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
          >
            Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
        {data.items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Geen leerdoelen gevonden voor de geselecteerde filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-4 text-left font-semibold text-sm text-gray-700">
                    Leerling
                  </th>
                  <th className="p-4 text-left font-semibold text-sm text-gray-700">
                    Competentie
                  </th>
                  <th className="p-4 text-left font-semibold text-sm text-gray-700">
                    Leerdoel
                  </th>
                  <th className="p-4 text-left font-semibold text-sm text-gray-700">
                    Status
                  </th>
                  <th className="p-4 text-left font-semibold text-sm text-gray-700">
                    Laatste update
                  </th>
                  <th className="p-4 text-right font-semibold text-sm text-gray-700">
                    Actie
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item) => (
                  <React.Fragment key={item.id}>
                    <tr className="hover:bg-gray-50/50">
                      <td className="p-4 font-medium">
                        <Link
                          href={`/teacher/competencies/windows/${windowId}/student/${item.user_id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {item.user_name}
                        </Link>
                        {item.class_name && (
                          <span className="ml-2 text-xs text-gray-500">
                            ({item.class_name})
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {item.competency_name || "–"}
                      </td>
                      <td className="p-4 text-sm">
                        <div className="max-w-md truncate" title={item.goal_text}>
                          {item.goal_text}
                        </div>
                      </td>
                      <td className="p-4">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {item.updated_at
                          ? new Date(item.updated_at).toLocaleDateString("nl-NL")
                          : "–"}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => toggleRow(item.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          {expandedRows.has(item.id) ? "Inklappen" : "Details"}
                        </button>
                      </td>
                    </tr>
                    {expandedRows.has(item.id) && (
                      <tr key={`${item.id}-details`} className="bg-gray-50">
                        <td colSpan={6} className="p-4">
                          <div className="space-y-3">
                            <div>
                              <span className="text-sm font-medium text-gray-700">
                                Volledig leerdoel:
                              </span>
                              <p className="text-sm text-gray-600 mt-1">
                                {item.goal_text}
                              </p>
                            </div>
                            {item.success_criteria && (
                              <div>
                                <span className="text-sm font-medium text-gray-700">
                                  Succescriteria:
                                </span>
                                <p className="text-sm text-gray-600 mt-1">
                                  {item.success_criteria}
                                </p>
                              </div>
                            )}
                            <div className="flex gap-4 text-sm text-gray-500">
                              {item.submitted_at && (
                                <span>
                                  Ingediend:{" "}
                                  {new Date(item.submitted_at).toLocaleDateString("nl-NL")}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
