"use client";

import { useState, useEffect, useCallback } from "react";

// Types for peer overview data
export type OmzaTrendDataPoint = {
  date: string;
  organiseren: number;
  meedoen: number;
  zelfvertrouwen: number;
  autonomie: number;
};

export type StudentHeatmapRow = {
  student_id: number;
  student_name: string;
  class_name: string;
  scores: {
    organiseren: { current: number; trend: "up" | "down" | "neutral" };
    meedoen: { current: number; trend: "up" | "down" | "neutral" };
    zelfvertrouwen: { current: number; trend: "up" | "down" | "neutral" };
    autonomie: { current: number; trend: "up" | "down" | "neutral" };
  };
  self_vs_peer_diff?: number;
};

export type KpiStudent = {
  student_id: number;
  student_name: string;
  value: number;
};

export type KpiData = {
  grootsteStijgers: KpiStudent[];
  grootsteDalers: KpiStudent[];
  structureelLaag: KpiStudent[];
  inconsistenties: KpiStudent[];
};

export type PeerOverviewFilters = {
  courseId?: number;
  projectId?: number;
  period?: "3months" | "6months" | "year";
  studentName?: string;
  evaluationIds?: number[];
};

export type PeerOverviewData = {
  trendData: OmzaTrendDataPoint[];
  heatmapData: StudentHeatmapRow[];
  kpiData: KpiData;
};

// Mock data generator
function generateMockData(): PeerOverviewData {
  const trendData: OmzaTrendDataPoint[] = [
    { date: "Sep 2024", organiseren: 3.2, meedoen: 3.5, zelfvertrouwen: 3.0, autonomie: 2.8 },
    { date: "Okt 2024", organiseren: 3.4, meedoen: 3.6, zelfvertrouwen: 3.2, autonomie: 3.0 },
    { date: "Nov 2024", organiseren: 3.5, meedoen: 3.8, zelfvertrouwen: 3.3, autonomie: 3.2 },
    { date: "Dec 2024", organiseren: 3.7, meedoen: 3.9, zelfvertrouwen: 3.5, autonomie: 3.4 },
  ];

  const heatmapData: StudentHeatmapRow[] = [
    {
      student_id: 1,
      student_name: "Jan de Vries",
      class_name: "4A",
      scores: {
        organiseren: { current: 4.2, trend: "up" },
        meedoen: { current: 3.8, trend: "neutral" },
        zelfvertrouwen: { current: 3.5, trend: "up" },
        autonomie: { current: 3.2, trend: "down" },
      },
      self_vs_peer_diff: 0.4,
    },
    {
      student_id: 2,
      student_name: "Maria Jansen",
      class_name: "4A",
      scores: {
        organiseren: { current: 3.6, trend: "neutral" },
        meedoen: { current: 4.1, trend: "up" },
        zelfvertrouwen: { current: 4.0, trend: "up" },
        autonomie: { current: 3.8, trend: "neutral" },
      },
      self_vs_peer_diff: -0.2,
    },
    {
      student_id: 3,
      student_name: "Peter Bakker",
      class_name: "4B",
      scores: {
        organiseren: { current: 2.8, trend: "down" },
        meedoen: { current: 3.2, trend: "down" },
        zelfvertrouwen: { current: 2.5, trend: "down" },
        autonomie: { current: 2.9, trend: "neutral" },
      },
      self_vs_peer_diff: 0.8,
    },
    {
      student_id: 4,
      student_name: "Sophie van Dam",
      class_name: "4B",
      scores: {
        organiseren: { current: 3.9, trend: "up" },
        meedoen: { current: 4.3, trend: "up" },
        zelfvertrouwen: { current: 3.7, trend: "neutral" },
        autonomie: { current: 4.0, trend: "up" },
      },
      self_vs_peer_diff: -0.1,
    },
    {
      student_id: 5,
      student_name: "Lucas Mulder",
      class_name: "4A",
      scores: {
        organiseren: { current: 3.1, trend: "neutral" },
        meedoen: { current: 3.4, trend: "neutral" },
        zelfvertrouwen: { current: 3.3, trend: "up" },
        autonomie: { current: 3.0, trend: "neutral" },
      },
      self_vs_peer_diff: 0.5,
    },
  ];

  const kpiData: KpiData = {
    grootsteStijgers: [
      { student_id: 4, student_name: "Sophie van Dam", value: 0.8 },
      { student_id: 1, student_name: "Jan de Vries", value: 0.6 },
      { student_id: 2, student_name: "Maria Jansen", value: 0.4 },
    ],
    grootsteDalers: [
      { student_id: 3, student_name: "Peter Bakker", value: -0.5 },
    ],
    structureelLaag: [
      { student_id: 3, student_name: "Peter Bakker", value: 2.6 },
    ],
    inconsistenties: [
      { student_id: 1, student_name: "Jan de Vries", value: 1.2 },
      { student_id: 5, student_name: "Lucas Mulder", value: 0.9 },
    ],
  };

  return { trendData, heatmapData, kpiData };
}

export function usePeerOverview(filters?: PeerOverviewFilters) {
  const [data, setData] = useState<PeerOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Return mock data for now
      const mockData = generateMockData();
      
      // Apply filters if provided
      const filteredData = { ...mockData };
      if (filters?.studentName) {
        const query = filters.studentName.toLowerCase();
        filteredData.heatmapData = filteredData.heatmapData.filter((s) =>
          s.student_name.toLowerCase().includes(query)
        );
      }
      if (filters?.courseId) {
        filteredData.heatmapData = filteredData.heatmapData.filter(
          (s) => true // Will be properly filtered when connected to real API
        );
      }
      
      setData(filteredData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load peer overview data");
    } finally {
      setLoading(false);
    }
  }, [filters?.studentName, filters?.courseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
