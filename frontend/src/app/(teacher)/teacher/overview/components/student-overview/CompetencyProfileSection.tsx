"use client";

import React, { useState, useEffect } from "react";
import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import api from "@/lib/api";

// Register Chart.js components
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface CompetencyProfileSectionProps {
  studentId: number;
  courseId: number;
}

interface CompetencyScan {
  id: number;
  title: string;
  created_at: string;
}

interface CategoryScore {
  category_id: number;
  category_name: string;
  avg_score: number | null;
}

export function CompetencyProfileSection({ studentId, courseId }: CompetencyProfileSectionProps) {
  const [scans, setScans] = useState<CompetencyScan[]>([]);
  const [selectedScanId, setSelectedScanId] = useState<number | null>(null);
  const [categoryScores, setCategoryScores] = useState<CategoryScore[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch available scans
  useEffect(() => {
    async function fetchScans() {
      try {
        const response = await api.get("/competencies/windows/", {
          params: { course_id: courseId, status: "all" },
        });
        const scansData = response.data || [];
        setScans(scansData);
        
        // Select latest scan by default
        if (scansData.length > 0) {
          setSelectedScanId(scansData[0].id);
        }
      } catch (error) {
        console.error("Error fetching scans:", error);
        setScans([]);
      }
    }
    fetchScans();
  }, [courseId]);

  // Fetch scan data when scan is selected
  useEffect(() => {
    async function fetchScanData() {
      if (!selectedScanId) {
        setCategoryScores([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Fetch heatmap data for the scan
        const response = await api.get(`/competencies/windows/${selectedScanId}/heatmap`);
        const heatmapData = response.data;
        
        // Find student data
        const studentRow = heatmapData.students?.find((s: any) => s.user_id === studentId);
        
        if (studentRow && studentRow.category_scores) {
          // Build category scores
          const categories = Object.keys(studentRow.category_scores).map((catId) => {
            const score = studentRow.category_scores[catId];
            // Try to get category name from competencies
            const categoryName = heatmapData.categories?.find((c: any) => c.id === Number(catId))?.name || `Cat ${catId}`;
            
            return {
              category_id: Number(catId),
              category_name: categoryName,
              avg_score: score?.average || null,
            };
          });
          
          setCategoryScores(categories);
        } else {
          setCategoryScores([]);
        }
      } catch (error) {
        console.error("Error fetching scan data:", error);
        setCategoryScores([]);
      } finally {
        setLoading(false);
      }
    }
    fetchScanData();
  }, [selectedScanId, studentId]);

  // Chart data
  const chartData = {
    labels: categoryScores.map((c) => c.category_name),
    datasets: [
      {
        label: "Score",
        data: categoryScores.map((c) => c.avg_score || 0),
        backgroundColor: "rgba(59, 130, 246, 0.2)",
        borderColor: "rgba(59, 130, 246, 1)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(59, 130, 246, 1)",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: "rgba(59, 130, 246, 1)",
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        min: 0,
        max: 4,
        ticks: {
          stepSize: 1,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
    },
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Competentieprofiel</h3>
        <div className="animate-pulse h-64 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Competentieprofiel</h3>
        
        {scans.length > 0 && (
          <select
            value={selectedScanId || ""}
            onChange={(e) => setSelectedScanId(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-1.5 text-sm border rounded-lg"
          >
            {scans.map((scan) => (
              <option key={scan.id} value={scan.id}>
                {scan.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {scans.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Geen competentiescans gevonden</p>
      ) : categoryScores.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Geen data beschikbaar voor deze scan</p>
      ) : (
        <div className="h-64">
          <Radar data={chartData} options={chartOptions} />
        </div>
      )}
    </div>
  );
}
