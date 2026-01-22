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
import { competencyMonitorService } from "@/services/competency-monitor.service";

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

interface ScanData {
  scanId: number;
  scanLabel: string;
  scanDate: string;
  categoryScores: Record<number, number | null>;
}

interface CategoryScore {
  category_id: number;
  category_name: string;
  avg_score: number | null;
}

export function CompetencyProfileSection({ studentId, courseId }: CompetencyProfileSectionProps) {
  const [scans, setScans] = useState<ScanData[]>([]);
  const [selectedScanId, setSelectedScanId] = useState<number | null>(null);
  const [categoryScores, setCategoryScores] = useState<CategoryScore[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch student historical data
  useEffect(() => {
    async function fetchStudentData() {
      try {
        setLoading(true);
        const data = await competencyMonitorService.getStudentHistoricalScores(
          studentId,
          courseId
        );
        
        if (data && data.scans && data.scans.length > 0) {
          setScans(data.scans);
          // Select latest scan by default
          setSelectedScanId(data.scans[0].scanId);
        } else {
          setScans([]);
          setSelectedScanId(null);
        }
      } catch (error) {
        console.error("Error fetching student competency data:", error);
        setScans([]);
        setSelectedScanId(null);
      } finally {
        setLoading(false);
      }
    }
    fetchStudentData();
  }, [studentId, courseId]);

  // Update category scores when scan is selected - fetch actual category names
  useEffect(() => {
    async function fetchCategoryNames() {
      if (!selectedScanId || scans.length === 0) {
        setCategoryScores([]);
        return;
      }

      const selectedScan = scans.find(s => s.scanId === selectedScanId);
      if (!selectedScan || !selectedScan.categoryScores) {
        setCategoryScores([]);
        return;
      }

      try {
        // Fetch the scan overview to get ALL category names (not just those with scores)
        const overview = await competencyMonitorService.getOverview({ courseId });
        
        // Build a map of category ID to name
        const categoryNameMap = new Map<number, string>();
        if (overview.categorySummaries) {
          overview.categorySummaries.forEach(cat => {
            categoryNameMap.set(cat.id, cat.name);
          });
        }

        // Create array with ALL categories from the overview, including those without scores
        const categories: CategoryScore[] = [];
        if (overview.categorySummaries) {
          overview.categorySummaries.forEach(cat => {
            categories.push({
              category_id: cat.id,
              category_name: cat.name,
              avg_score: selectedScan.categoryScores[cat.id] ?? null,
            });
          });
        } else {
          // Fallback: if overview.categorySummaries is unavailable, only show categories that have scores
          Object.entries(selectedScan.categoryScores).forEach(([catId, score]) => {
            categories.push({
              category_id: Number(catId),
              category_name: categoryNameMap.get(Number(catId)) || `Categorie ${catId}`,
              avg_score: score,
            });
          });
        }

        setCategoryScores(categories);
      } catch (error) {
        console.error("Error fetching category names:", error);
        // Fallback to category IDs if fetch fails
        const categories = Object.entries(selectedScan.categoryScores).map(([catId, score]) => ({
          category_id: Number(catId),
          category_name: `Categorie ${catId}`,
          avg_score: score,
        }));
        setCategoryScores(categories);
      }
    }
    fetchCategoryNames();
  }, [selectedScanId, scans, courseId]);

  // Chart data - include all categories, but use null for missing scores
  // Radar charts handle null values by not drawing a line to that point
  const chartData = {
    labels: categoryScores.map((c) => c.category_name),
    datasets: [
      {
        label: "Score",
        data: categoryScores.map((c) => c.avg_score),
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
        pointLabels: {
          font: {
            size: 11,
          },
          callback: function(label: string) {
            // Allow labels to wrap by splitting on spaces
            const maxCharsPerLine = 15;
            if (label.length <= maxCharsPerLine) return label;
            
            const words = label.split(' ');
            const lines = [];
            let currentLine = '';
            
            words.forEach(word => {
              if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
                currentLine = currentLine ? currentLine + ' ' + word : word;
              } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
              }
            });
            if (currentLine) lines.push(currentLine);
            
            return lines;
          }
        }
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
              <option key={scan.scanId} value={scan.scanId}>
                {scan.scanLabel}
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
        <div className="h-72">
          <Radar data={chartData} options={chartOptions} />
        </div>
      )}
    </div>
  );
}
