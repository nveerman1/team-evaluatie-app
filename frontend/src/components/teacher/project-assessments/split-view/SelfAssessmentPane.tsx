'use client';

import React, { useState, useEffect } from 'react';
import { projectAssessmentService } from '@/services';
import { ProjectAssessmentSelfOverview } from '@/dtos';
import { Loading, ErrorMessage } from '@/components';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface SelfAssessmentPaneProps {
  assessmentId: number;
  teamNumber: number;
}

// Convert score to grade using curved mapping (matches backend calculation)
// grade = 1 + (normalized ** 0.85) * 9
function scoreToGrade(score: number, scaleMin: number, scaleMax: number): number {
  const scaleRange = scaleMax - scaleMin;
  if (scaleRange <= 0) return 1.0;
  const clampedScore = Math.max(scaleMin, Math.min(scaleMax, score));
  const normalized = (clampedScore - scaleMin) / scaleRange;
  const exponent = 0.85;
  const curved = 1 + Math.pow(normalized, exponent) * 9;
  return Math.round(curved * 10) / 10;
}

export function SelfAssessmentPane({ assessmentId, teamNumber }: SelfAssessmentPaneProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProjectAssessmentSelfOverview | null>(null);
  const [expandedStudents, setExpandedStudents] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const result = await projectAssessmentService.getSelfAssessmentOverview(assessmentId);
        if (!cancelled) setData(result);
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.detail || e?.message || 'Laden mislukt');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, [assessmentId]);

  if (loading) return (
    <div className="border-x border-b border-slate-200 bg-white h-full flex items-center justify-center">
      <Loading />
    </div>
  );
  if (error) return (
    <div className="border-x border-b border-slate-200 bg-white h-full flex items-center justify-center p-4">
      <ErrorMessage message={error} />
    </div>
  );
  if (!data) return (
    <div className="border-x border-b border-slate-200 bg-white h-full flex items-center justify-center p-4">
      <ErrorMessage message="Geen data gevonden" />
    </div>
  );

  const team = data.team_overviews.find((t) => t.team_number === teamNumber);

  if (!team) return (
    <div className="border-x border-b border-slate-200 bg-white h-full flex items-center justify-center p-4 text-sm text-slate-500">
      Geen zelfbeoordeling gevonden voor team {teamNumber}.
    </div>
  );

  // Group criteria by category
  const groupedCriteria: Record<string, typeof data.criteria> = {};
  const categories: string[] = [];
  data.criteria.forEach((c) => {
    const cat = c.category || 'Overig';
    if (!groupedCriteria[cat]) {
      groupedCriteria[cat] = [];
      categories.push(cat);
    }
    groupedCriteria[cat].push(c);
  });

  // Calculate weighted average scores per category for the team
  const getTeamCategoryAverages = (t: typeof data.team_overviews[0]) => {
    const categoryAverages: Record<string, number> = {};
    categories.forEach((category) => {
      const categoryCriteria = groupedCriteria[category];
      let totalWeight = 0;
      let weightedSum = 0;
      categoryCriteria.forEach((criterion) => {
        const criterionScore = t.avg_criterion_scores.find(
          (cs) => cs.criterion_id === criterion.id
        );
        if (criterionScore?.score !== null && criterionScore?.score !== undefined) {
          const weight = criterion.weight || 1.0;
          weightedSum += criterionScore.score * weight;
          totalWeight += weight;
        }
      });
      if (totalWeight > 0) {
        const avgScore = weightedSum / totalWeight;
        categoryAverages[category] = scoreToGrade(avgScore, data.rubric_scale_min, data.rubric_scale_max);
      }
    });
    return categoryAverages;
  };

  const categoryAverages = getTeamCategoryAverages(team);

  const toggleStudent = (studentId: number) => {
    setExpandedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  return (
    <div className="border-x border-b border-slate-200 bg-white shadow-sm flex flex-col h-full overflow-hidden">
      {/* Sub-header */}
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="text-sm font-semibold text-slate-900">
          Zelfbeoordeling — Team {teamNumber}
        </div>
        <div className="mt-0.5 text-xs text-slate-500">
          {team.completed_count} van {team.members.length} ingevuld
        </div>
      </div>

      {/* Category averages */}
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="flex flex-wrap gap-3">
          {categories.map((cat) => (
            <div key={cat} className="flex items-center gap-1 text-xs">
              <span className="text-slate-500">{cat}:</span>
              <span className="font-semibold text-slate-900">
                {categoryAverages[cat] ? categoryAverages[cat].toFixed(1) : '—'}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500">Eindcijfer:</span>
            <span className="font-semibold text-blue-600">
              {team.avg_grade ? team.avg_grade.toFixed(1) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Per-student accordion */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="divide-y divide-slate-100">
          {team.student_details.map((student) => {
            const isExpanded = expandedStudents.has(student.student_id);
            return (
              <div key={student.student_id}>
                {/* Student row (collapsed) */}
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                  onClick={() => toggleStudent(student.student_id)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                    )}
                    <span className="text-sm font-medium text-slate-900">
                      {student.student_name}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-700">
                    {student.has_self_assessment
                      ? student.grade != null
                        ? student.grade.toFixed(1)
                        : '—'
                      : <span className="text-slate-400 font-normal">Niet ingevuld</span>
                    }
                  </div>
                </button>

                {/* Expanded: criteria table */}
                {isExpanded && student.has_self_assessment && (
                  <div className="bg-slate-50 px-4 pb-3">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead>
                        <tr>
                          <th className="py-2 text-left font-semibold text-slate-600 uppercase tracking-wider">
                            Criterium
                          </th>
                          <th className="py-2 text-center font-semibold text-slate-600 uppercase tracking-wider w-16">
                            Score
                          </th>
                          <th className="py-2 text-left font-semibold text-slate-600 uppercase tracking-wider">
                            Opmerking
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {student.criterion_scores.map((cs) => (
                          <tr key={cs.criterion_id} className="hover:bg-white">
                            <td className="py-1.5 pr-3 text-slate-900">{cs.criterion_name}</td>
                            <td className="py-1.5 text-center font-semibold text-slate-900">
                              {cs.score ?? '—'}
                            </td>
                            <td className="py-1.5 text-slate-600">{cs.comment || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Expanded: not filled in */}
                {isExpanded && !student.has_self_assessment && (
                  <div className="bg-slate-50 px-4 pb-3 pt-1 text-xs text-slate-400">
                    Deze student heeft de zelfbeoordeling niet ingevuld.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
