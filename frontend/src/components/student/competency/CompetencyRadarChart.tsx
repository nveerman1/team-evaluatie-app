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

  // Add padding around the chart for labels (less on top/bottom)
  const paddingHorizontal = 60; // Extra space for side labels
  const paddingVertical = 35; // Less padding on top/bottom
  const totalWidth = size + paddingHorizontal * 2;
  const totalHeight = size + paddingVertical * 2;
  const centerX = totalWidth / 2;
  const centerY = totalHeight / 2;
  const maxRadius = size / 2; // Use full chart area
  const labelRadius = maxRadius * 1.15; // Position labels outside the chart

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
      className="relative flex items-center justify-center"
      style={{ width: totalWidth, height: totalHeight }}
    >
      <svg
        width={totalWidth}
        height={totalHeight}
        className="overflow-visible"
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

        {/* Category labels at axis endpoints */}
        {items.map((item, index) => {
          const angle = (index / items.length) * Math.PI * 2 - Math.PI / 2;
          const labelX = centerX + labelRadius * Math.cos(angle);
          const labelY = centerY + labelRadius * Math.sin(angle);
          
          // Determine text anchor based on angle for better positioning
          let textAnchor: "start" | "middle" | "end" = "middle";
          if (Math.cos(angle) > 0.3) textAnchor = "start";
          else if (Math.cos(angle) < -0.3) textAnchor = "end";
          
          // Shorten long labels based on specific mappings
          let displayName = item.name;
          if (item.name.includes("Reflectie & Professionele houding")) {
            displayName = "Professionele houding";
          } else if (item.name.includes("Communicatie & Presenteren")) {
            displayName = "Communicatie";
          } else if (item.name.includes("Creatief denken & probleemoplossen")) {
            displayName = "Creatief denken";
          }
          
          // Split label into multiple lines if it's still too long
          const words = displayName.split(" ");
          const lines: string[] = [];
          if (words.length > 2 && displayName.length > 20) {
            // Split into two lines
            const midPoint = Math.ceil(words.length / 2);
            lines.push(words.slice(0, midPoint).join(" "));
            lines.push(words.slice(midPoint).join(" "));
          } else {
            lines.push(displayName);
          }
          
          // Adjust vertical alignment based on position
          const baseY = labelY;
          const lineHeight = 12;
          const startOffset = lines.length > 1 ? -lineHeight / 2 : 0;
          
          return (
            <g key={`label-${index}`}>
              {lines.map((line, lineIndex) => {
                let dy = startOffset + lineIndex * lineHeight;
                if (Math.sin(angle) < -0.5) dy += lineHeight; // Top labels
                else if (Math.sin(angle) > 0.5) dy -= lineHeight / 2; // Bottom labels
                
                return (
                  <text
                    key={`label-${index}-${lineIndex}`}
                    x={labelX}
                    y={baseY + dy}
                    textAnchor={textAnchor}
                    className="text-xs font-medium fill-slate-700"
                    style={{ fontSize: "10px" }}
                  >
                    {line}
                  </text>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default CompetencyRadarChart;
