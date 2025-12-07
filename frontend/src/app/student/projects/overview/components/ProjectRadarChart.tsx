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

    chartRef.current = new Chart(ctx, {
      type: "radar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Gemiddelde score",
            data: values,
            backgroundColor: "rgba(147, 51, 234, 0.2)",
            borderColor: "#9333ea",
            borderWidth: 2,
            pointBackgroundColor: "#9333ea",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
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
              font: { size: 10 },
            },
            pointLabels: {
              font: { size: 11 },
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

  return <canvas ref={canvasRef} className="max-w-[300px] max-h-[300px]" />;
}
