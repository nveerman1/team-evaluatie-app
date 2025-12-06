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
} from "chart.js";

// Register Chart.js components
Chart.register(
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip
);

type OMZARadarChartProps = {
  data: { [key: string]: number };
};

export function OMZARadarChart({ data }: OMZARadarChartProps) {
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

    const labels = ["Organiseren", "Meedoen", "Zelfvertrouwen", "Autonomie"];
    const values = [data.O, data.M, data.Z, data.A];

    chartRef.current = new Chart(ctx, {
      type: "radar",
      data: {
        labels,
        datasets: [
          {
            label: "Laatste scan",
            data: values,
            borderColor: "#4f46e5",
            backgroundColor: "rgba(79,70,229,0.15)",
            pointRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          r: {
            min: 0,
            max: 4,
            ticks: { stepSize: 1, backdropColor: "transparent" },
            grid: { color: "#e5e7eb" },
            angleLines: { color: "#e5e7eb" },
            pointLabels: { font: { size: 10 } },
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
