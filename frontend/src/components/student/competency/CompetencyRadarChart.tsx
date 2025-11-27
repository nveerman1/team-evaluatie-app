"use client";

import React from "react";

type RadarChartItem = {
  name: string;
  value: number;
};

type CompetencyRadarChartProps = {
  items: RadarChartItem[];
  size?: number;
  maxValue?: number;
};

// Colors for each category (index-based mapping)
export const CATEGORY_COLORS = [
  "#3b82f6", // Samenwerken
  "#10b981", // Plannen & Organiseren
  "#8b5cf6", // Creatief denken & probleemoplossen
  "#f59e0b", // Technische vaardigheden
  "#ef4444", // Communicatie & Presenteren
  "#0ea5e9", // Reflectie & Professionele houding
];

/**
 * Reusable radar chart component for competency profiles
 * Renders an SVG radar chart with concentric circles, axes, and data points
 */
export function CompetencyRadarChart({
  items,
  size = 256,
  maxValue = 5,
}: CompetencyRadarChartProps) {
  if (!items || items.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-400 text-sm"
        style={{ width: size, height: size }}
      >
        Geen data beschikbaar
      </div>
    );
  }

  const centerX = size / 2;
  const centerY = size / 2;
  const maxRadius = (size / 2) * 0.85; // Leave some padding

  // Calculate polygon points for the data
  const radarPoints = items.map((item, index) => {
    const angle = (index / items.length) * Math.PI * 2 - Math.PI / 2; // Start from top
    const radius = (item.value / maxValue) * maxRadius;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    return { x, y, angle, radius };
  });

  const polygonPointsStr = radarPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // Generate concentric circles (3 levels)
  const circles = [0.33, 0.66, 1].map((ratio) => maxRadius * ratio);

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="absolute inset-0"
      >
        {/* Concentric circles */}
        {circles.map((radius, idx) => (
          <circle
            key={idx}
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={1}
            strokeDasharray="4 2"
          />
        ))}

        {/* Axes from center to each category */}
        {items.map((_, index) => {
          const angle = (index / items.length) * Math.PI * 2 - Math.PI / 2;
          const x2 = centerX + maxRadius * Math.cos(angle);
          const y2 = centerY + maxRadius * Math.sin(angle);
          return (
            <line
              key={index}
              x1={centerX}
              y1={centerY}
              x2={x2}
              y2={y2}
              stroke="#e5e7eb"
              strokeWidth={1}
              strokeDasharray="4 2"
            />
          );
        })}

        {/* Data polygon */}
        <polygon
          points={polygonPointsStr}
          fill="rgba(37, 99, 235, 0.12)"
          stroke="rgba(37, 99, 235, 0.8)"
          strokeWidth={1.5}
        />

        {/* Lines from center to data points */}
        {radarPoints.map((point, index) => (
          <line
            key={`line-${index}`}
            x1={centerX}
            y1={centerY}
            x2={point.x}
            y2={point.y}
            stroke="rgba(37, 99, 235, 0.4)"
            strokeWidth={1.5}
          />
        ))}

        {/* Data points */}
        {radarPoints.map((point, index) => (
          <circle
            key={`point-${index}`}
            cx={point.x}
            cy={point.y}
            r={5}
            fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
            stroke="white"
            strokeWidth={1}
          />
        ))}

        {/* Center point */}
        <circle
          cx={centerX}
          cy={centerY}
          r={3}
          fill="#3b82f6"
        />
      </svg>
    </div>
  );
}

export default CompetencyRadarChart;
