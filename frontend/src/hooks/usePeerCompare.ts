"use client";

import { useState, useEffect, useCallback } from "react";

// Types for peer comparison
export type OmzaScore = {
  organiseren: number | null;
  meedoen: number | null;
  zelfvertrouwen: number | null;
  autonomie: number | null;
};

export type StudentCompareItem = {
  student_id: number;
  student_name: string;
  class_name: string;
  scores: OmzaScore;
  self_scores: OmzaScore;
  peer_scores: OmzaScore;
  evaluations_count: number;
};

export type PeerCompareFilters = {
  studentIds?: number[];
  classId?: string;
};

export type PeerCompareData = {
  students: StudentCompareItem[];
  averages: OmzaScore;
};

// Mock data generator
function generateMockPeerCompareData(): PeerCompareData {
  const students: StudentCompareItem[] = [
    {
      student_id: 1,
      student_name: "Jan de Vries",
      class_name: "4A",
      scores: { organiseren: 4.2, meedoen: 3.8, zelfvertrouwen: 3.5, autonomie: 3.2 },
      self_scores: { organiseren: 4.0, meedoen: 4.0, zelfvertrouwen: 3.8, autonomie: 3.5 },
      peer_scores: { organiseren: 4.4, meedoen: 3.6, zelfvertrouwen: 3.2, autonomie: 2.9 },
      evaluations_count: 4,
    },
    {
      student_id: 2,
      student_name: "Maria Jansen",
      class_name: "4A",
      scores: { organiseren: 3.6, meedoen: 4.1, zelfvertrouwen: 4.0, autonomie: 3.8 },
      self_scores: { organiseren: 3.5, meedoen: 4.0, zelfvertrouwen: 3.8, autonomie: 3.6 },
      peer_scores: { organiseren: 3.7, meedoen: 4.2, zelfvertrouwen: 4.2, autonomie: 4.0 },
      evaluations_count: 4,
    },
    {
      student_id: 3,
      student_name: "Peter Bakker",
      class_name: "4B",
      scores: { organiseren: 2.8, meedoen: 3.2, zelfvertrouwen: 2.5, autonomie: 2.9 },
      self_scores: { organiseren: 3.2, meedoen: 3.5, zelfvertrouwen: 3.0, autonomie: 3.2 },
      peer_scores: { organiseren: 2.4, meedoen: 2.9, zelfvertrouwen: 2.0, autonomie: 2.6 },
      evaluations_count: 4,
    },
    {
      student_id: 4,
      student_name: "Sophie van Dam",
      class_name: "4B",
      scores: { organiseren: 3.9, meedoen: 4.3, zelfvertrouwen: 3.7, autonomie: 4.0 },
      self_scores: { organiseren: 3.8, meedoen: 4.2, zelfvertrouwen: 3.5, autonomie: 3.8 },
      peer_scores: { organiseren: 4.0, meedoen: 4.4, zelfvertrouwen: 3.9, autonomie: 4.2 },
      evaluations_count: 4,
    },
    {
      student_id: 5,
      student_name: "Lucas Mulder",
      class_name: "4A",
      scores: { organiseren: 3.1, meedoen: 3.4, zelfvertrouwen: 3.3, autonomie: 3.0 },
      self_scores: { organiseren: 3.5, meedoen: 3.8, zelfvertrouwen: 3.6, autonomie: 3.4 },
      peer_scores: { organiseren: 2.7, meedoen: 3.0, zelfvertrouwen: 3.0, autonomie: 2.6 },
      evaluations_count: 4,
    },
  ];

  // Calculate averages
  const averages: OmzaScore = {
    organiseren: students.reduce((sum, s) => sum + (s.scores.organiseren || 0), 0) / students.length,
    meedoen: students.reduce((sum, s) => sum + (s.scores.meedoen || 0), 0) / students.length,
    zelfvertrouwen: students.reduce((sum, s) => sum + (s.scores.zelfvertrouwen || 0), 0) / students.length,
    autonomie: students.reduce((sum, s) => sum + (s.scores.autonomie || 0), 0) / students.length,
  };

  return {
    students,
    averages,
  };
}

export function usePeerCompare(filters?: PeerCompareFilters) {
  const [data, setData] = useState<PeerCompareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Get mock data
      const mockData = generateMockPeerCompareData();
      
      // Apply filters
      let filteredStudents = [...mockData.students];
      
      if (filters?.classId) {
        filteredStudents = filteredStudents.filter((s) => s.class_name === filters.classId);
      }
      if (filters?.studentIds && filters.studentIds.length > 0) {
        filteredStudents = filteredStudents.filter((s) =>
          filters.studentIds!.includes(s.student_id)
        );
      }
      
      // Recalculate averages
      const averages: OmzaScore = {
        organiseren: filteredStudents.length > 0
          ? filteredStudents.reduce((sum, s) => sum + (s.scores.organiseren || 0), 0) / filteredStudents.length
          : null,
        meedoen: filteredStudents.length > 0
          ? filteredStudents.reduce((sum, s) => sum + (s.scores.meedoen || 0), 0) / filteredStudents.length
          : null,
        zelfvertrouwen: filteredStudents.length > 0
          ? filteredStudents.reduce((sum, s) => sum + (s.scores.zelfvertrouwen || 0), 0) / filteredStudents.length
          : null,
        autonomie: filteredStudents.length > 0
          ? filteredStudents.reduce((sum, s) => sum + (s.scores.autonomie || 0), 0) / filteredStudents.length
          : null,
      };
      
      setData({
        students: filteredStudents,
        averages,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load comparison data");
    } finally {
      setLoading(false);
    }
  }, [filters?.classId, filters?.studentIds]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
