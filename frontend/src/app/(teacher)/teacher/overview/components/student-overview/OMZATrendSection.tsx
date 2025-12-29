"use client";

import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { peerEvaluationOverviewService } from "@/services/peer-evaluation-overview.service";
import type { OmzaTrendDataPoint } from "@/services/peer-evaluation-overview.service";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface OMZATrendSectionProps {
  studentId: number;
  courseId: number;
}

export function OMZATrendSection({ studentId, courseId }: OMZATrendSectionProps) {
  const [trendData, setTrendData] = useState<OmzaTrendDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await peerEvaluationOverviewService.getDashboard({
          courseId,
        });
        
        setTrendData(response.trendData);
      } catch (error) {
        console.error("Error fetching OMZA trend data:", error);
        setTrendData([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [studentId, courseId]);

  // Chart configuration
  const chartData = {
    labels: trendData.map((d) => d.date) || [],
    datasets: [
      {
        label: "Organiseren",
        data: trendData.map((d) => d.organiseren) || [],
        borderColor: "#3b82f6",
        backgroundColor: "#3b82f680",
        tension: 0.3,
      },
      {
        label: "Meedoen",
        data: trendData.map((d) => d.meedoen) || [],
        borderColor: "#10b981",
        backgroundColor: "#10b98180",
        tension: 0.3,
      },
      {
        label: "Zelfvertrouwen",
        data: trendData.map((d) => d.zelfvertrouwen) || [],
        borderColor: "#f59e0b",
        backgroundColor: "#f59e0b80",
        tension: 0.3,
      },
      {
        label: "Autonomie",
        data: trendData.map((d) => d.autonomie) || [],
        borderColor: "#8b5cf6",
        backgroundColor: "#8b5cf680",
        tension: 0.3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
      },
    },
    scales: {
      y: {
        min: 1,
        max: 5,
        ticks: {
          stepSize: 0.5,
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">OMZA Trend</h3>
        <div className="animate-pulse h-64 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">OMZA Trend</h3>
      {trendData.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Geen trend data beschikbaar</p>
      ) : (
        <div className="h-64">
          <Line data={chartData} options={chartOptions} />
        </div>
      )}
    </div>
  );
}
