"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { peerEvaluationOverviewService } from "@/services/peer-evaluation-overview.service";
import { competencyMonitorService } from "@/services/competency-monitor.service";
import type { ReflectionItem } from "@/services/peer-evaluation-overview.service";
import type { ReflectionSummary } from "@/dtos/competency-monitor.dto";

interface ReflectionsSectionProps {
  studentId: number;
  courseId: number;
}

interface CombinedReflection {
  id: number | string;
  type: "Peer" | "Competentie";
  project_name: string;
  date: string;
  reflection_text: string;
  word_count: number;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function ReflectionsSection({ studentId, courseId }: ReflectionsSectionProps) {
  const [reflections, setReflections] = useState<CombinedReflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<number | string>>(new Set());

  useEffect(() => {
    async function fetchReflections() {
      try {
        setLoading(true);
        
        // Fetch peer evaluation reflections
        const peerResponse = await peerEvaluationOverviewService.getReflections({
          courseId,
        });
        
        const peerReflections: CombinedReflection[] = peerResponse.reflectionItems
          .filter((r) => r.student_id === studentId)
          .map((r) => ({
            id: `peer-${r.id}`,
            type: "Peer" as const,
            project_name: r.project_name,
            date: r.date,
            reflection_text: r.reflection_text,
            word_count: r.word_count,
          }));
        
        // Fetch competency reflections
        const competencyReflections = await competencyMonitorService.getReflections({
          courseId,
        });
        
        const compReflections: CombinedReflection[] = competencyReflections
          .filter((r) => r.studentId === studentId)
          .map((r) => ({
            id: `comp-${r.id}`,
            type: "Competentie" as const,
            project_name: r.scanLabel,
            date: r.createdAt,
            reflection_text: r.reflectionText,
            word_count: r.reflectionText.split(/\s+/).filter(Boolean).length,
          }));
        
        // Combine and sort by date (newest first)
        const combined = [...peerReflections, ...compReflections].sort((a, b) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        
        setReflections(combined);
      } catch (error) {
        console.error("Error fetching reflections:", error);
        setReflections([]);
      } finally {
        setLoading(false);
      }
    }
    fetchReflections();
  }, [studentId, courseId]);

  const toggleRow = (id: number | string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Reflecties</h3>
        <div className="animate-pulse space-y-2">
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Reflecties</h3>
      
      {reflections.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Geen reflecties gevonden</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Type
                </th>
                <th className="w-[18%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Project/Scan
                </th>
                <th className="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Datum
                </th>
                <th className="w-[50%] px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Reflectie
                </th>
                <th className="w-[8%] px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Woorden
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reflections.map((reflection) => {
                const isExpanded = expandedRows.has(reflection.id);
                return (
                  <React.Fragment key={reflection.id}>
                    <tr 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleRow(reflection.id)}
                    >
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            reflection.type === "Peer"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {reflection.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="line-clamp-2">
                          {reflection.project_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {formatDate(reflection.date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="flex items-start gap-2">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="line-clamp-3 whitespace-normal break-words flex-1">
                            {reflection.reflection_text}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-center">
                        {reflection.word_count}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={5} className="px-4 py-4">
                          <div className="ml-6">
                            <span className="text-xs font-medium text-gray-500 uppercase">Volledige reflectie:</span>
                            <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap break-words">
                              {reflection.reflection_text}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
