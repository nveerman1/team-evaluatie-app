"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { competencyService } from "@/services";
import type { TeacherReflectionsList } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import Link from "next/link";

export default function ReflectiesTabPage() {
  const params = useParams();
  const windowId = Number(params.windowId);

  const [data, setData] = useState<TeacherReflectionsList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await competencyService.getWindowReflections(windowId);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [windowId]);

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

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <ErrorMessage message="Data not found" />;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-4 border rounded-xl bg-blue-50/80">
          <div className="text-sm text-gray-600">Totaal reflecties</div>
          <div className="text-2xl font-bold">{data.items.length}</div>
        </div>
        <div className="p-4 border rounded-xl bg-green-50/80">
          <div className="text-sm text-gray-600">Met behaald doel</div>
          <div className="text-2xl font-bold">
            {data.items.filter((i) => i.goal_achieved === true).length}
          </div>
        </div>
        <div className="p-4 border rounded-xl bg-purple-50/80">
          <div className="text-sm text-gray-600">Met gekoppeld leerdoel</div>
          <div className="text-2xl font-bold">
            {data.items.filter((i) => i.goal_id).length}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
        {data.items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Geen reflecties gevonden.
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
                    Datum
                  </th>
                  <th className="p-4 text-left font-semibold text-sm text-gray-700">
                    Reflectie
                  </th>
                  <th className="p-4 text-left font-semibold text-sm text-gray-700">
                    Gekoppeld leerdoel
                  </th>
                  <th className="p-4 text-left font-semibold text-sm text-gray-700">
                    Doel behaald
                  </th>
                  <th className="p-4 text-right font-semibold text-sm text-gray-700">
                    Actie
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item) => (
                  <>
                    <tr key={item.id} className="hover:bg-gray-50/50">
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
                        {item.submitted_at
                          ? new Date(item.submitted_at).toLocaleDateString("nl-NL")
                          : "–"}
                      </td>
                      <td className="p-4 text-sm">
                        <div className="max-w-md">
                          {truncateText(item.text)}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {item.goal_text ? truncateText(item.goal_text, 50) : "–"}
                      </td>
                      <td className="p-4">
                        {item.goal_achieved !== null && item.goal_achieved !== undefined ? (
                          <span
                            className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                              item.goal_achieved
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {item.goal_achieved ? "Ja" : "Nee"}
                          </span>
                        ) : (
                          <span className="text-gray-400">–</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => toggleRow(item.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          {expandedRows.has(item.id) ? "Inklappen" : "Bekijken"}
                        </button>
                      </td>
                    </tr>
                    {expandedRows.has(item.id) && (
                      <tr key={`${item.id}-details`} className="bg-gray-50">
                        <td colSpan={6} className="p-4">
                          <div className="space-y-4">
                            <div>
                              <span className="text-sm font-medium text-gray-700">
                                Volledige reflectie:
                              </span>
                              <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">
                                {item.text}
                              </p>
                            </div>
                            {item.goal_text && (
                              <div>
                                <span className="text-sm font-medium text-gray-700">
                                  Gekoppeld leerdoel:
                                </span>
                                <p className="text-sm text-gray-600 mt-1">
                                  {item.goal_text}
                                </p>
                              </div>
                            )}
                            {item.evidence && (
                              <div>
                                <span className="text-sm font-medium text-gray-700">
                                  Bewijs / voorbeelden:
                                </span>
                                <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">
                                  {item.evidence}
                                </p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
