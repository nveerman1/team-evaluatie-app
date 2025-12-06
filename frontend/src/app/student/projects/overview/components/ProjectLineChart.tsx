"use client";

import React, { useEffect, useRef } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
} from "chart.js";

// Register Chart.js components
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend
);

export type ProjectGradeTrendPoint = {
  label: string;
  grade: number;
  date: string;
};

type ProjectLineChartProps = {
  data: ProjectGradeTrendPoint[];
};

export function ProjectLineChart({ data }: ProjectLineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !data || data.length === 0) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.map((d) => d.label),
        datasets: [
          {
            label: "Eindcijfer",
            data: data.map((d) => d.grade),
            borderColor: "#9333ea",
            backgroundColor: "rgba(147, 51, 234, 0.1)",
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: "#9333ea",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `Cijfer: ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(1) : 'N/A'}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { 
              font: { size: 10 },
              maxRotation: 45,
              minRotation: 0,
            },
          },
          y: {
            min: 1,
            max: 10,
            ticks: { 
              stepSize: 1,
              font: { size: 11 },
            },
            grid: {
              color: "rgba(0, 0, 0, 0.05)",
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
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Geen data beschikbaar
      </div>
    );
  }

  return <canvas ref={canvasRef} className="h-full w-full" />;
}
