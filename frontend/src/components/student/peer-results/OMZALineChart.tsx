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
} from "chart.js";

// Register Chart.js components
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip
);

export type OmzaTrendPoint = {
  label: string;
  O: number;
  M: number;
  Z: number;
  A: number;
};

type OMZALineChartProps = {
  data: OmzaTrendPoint[];
};

export function OMZALineChart({ data }: OMZALineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
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
            label: "Organiseren",
            data: data.map((d) => d.O),
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59,130,246,0.1)",
            tension: 0.3,
            pointRadius: 2,
          },
          {
            label: "Meedoen",
            data: data.map((d) => d.M),
            borderColor: "#10b981",
            backgroundColor: "rgba(16,185,129,0.1)",
            tension: 0.3,
            pointRadius: 2,
          },
          {
            label: "Zelfvertrouwen",
            data: data.map((d) => d.Z),
            borderColor: "#8b5cf6",
            backgroundColor: "rgba(139,92,246,0.1)",
            tension: 0.3,
            pointRadius: 2,
          },
          {
            label: "Autonomie",
            data: data.map((d) => d.A),
            borderColor: "#f97316",
            backgroundColor: "rgba(249,115,22,0.1)",
            tension: 0.3,
            pointRadius: 2,
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
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 10 } },
          },
          y: {
            min: 0,
            max: 4,
            ticks: { stepSize: 1 },
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

  return <canvas ref={canvasRef} className="h-full w-full" />;
}
