"use client";

import React, { useEffect, useRef } from "react";
import {
  Chart,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

// Register Chart.js components
Chart.register(
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

type ProjectRadarChartProps = {
  categoryAverages: Record<string, number>;
};

// Define color mapping for categories to match legend
const CATEGORY_COLORS: Record<string, { bg: string; border: string }> = {
  Projectproces: { bg: "rgba(14, 165, 233, 0.2)", border: "#0ea5e9" }, // sky-500
  Eindresultaat: { bg: "rgba(139, 92, 246, 0.2)", border: "#8b5cf6" }, // violet-500
  Communicatie: { bg: "rgba(16, 185, 129, 0.2)", border: "#10b981" }, // emerald-500
  Samenwerking: { bg: "rgba(245, 158, 11, 0.2)", border: "#f59e0b" }, // amber-500
};

// Fallback colors for any additional categories
const FALLBACK_COLORS = [
  { bg: "rgba(239, 68, 68, 0.2)", border: "#ef4444" }, // red-500
  { bg: "rgba(236, 72, 153, 0.2)", border: "#ec4899" }, // pink-500
];

export function ProjectRadarChart({ categoryAverages }: ProjectRadarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !categoryAverages) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const labels = Object.keys(categoryAverages);
    const values = Object.values(categoryAverages);

    // Get colors for each category
    const pointBackgroundColors = labels.map((label, index) => {
      if (CATEGORY_COLORS[label]) {
        return CATEGORY_COLORS[label].border;
      }
      return FALLBACK_COLORS[index % FALLBACK_COLORS.length].border;
    });

    // Use first color for line color (or a neutral color)
    const lineColor = labels.length > 0 && CATEGORY_COLORS[labels[0]] 
      ? CATEGORY_COLORS[labels[0]].border 
      : "#8b5cf6";

    chartRef.current = new Chart(ctx, {
      type: "radar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Gemiddelde score",
            data: values,
            backgroundColor: "rgba(139, 92, 246, 0.1)",
            borderColor: lineColor,
            borderWidth: 2,
            pointBackgroundColor: pointBackgroundColors,
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `Score: ${ctx.parsed.r.toFixed(1)}`,
            },
          },
        },
        scales: {
          r: {
            min: 0,
            max: 5,
            ticks: {
              stepSize: 1,
              font: { size: 11 },
            },
            pointLabels: {
              font: { size: 12, weight: '500' },
            },
            grid: {
              color: "rgba(0, 0, 0, 0.1)",
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [categoryAverages]);

  if (!categoryAverages || Object.keys(categoryAverages).length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Geen data beschikbaar
      </div>
    );
  }

  return <canvas ref={canvasRef} className="max-w-[400px] max-h-[400px]" />;
}
