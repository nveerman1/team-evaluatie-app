"use client";

import { useMemo } from "react";
import type { ScanSummary } from "@/dtos/competency-monitor.dto";

interface SpreadChartCompactProps {
  scans: ScanSummary[];
  mode: "average" | "spread" | "growth";
  width?: number;
  height?: number;
}

export function SpreadChartCompact({
  scans,
  mode,
  width = 380,
  height = 180,
}: SpreadChartCompactProps) {
  const chartData = useMemo(() => {
    if (scans.length === 0) return null;

    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Y-axis: fixed scale 1-5
    const yMin = 1;
    const yMax = 5;
    const yScale = (value: number) => {
      return chartHeight - ((value - yMin) / (yMax - yMin)) * chartHeight;
    };

    // X-axis: distribute scans evenly
    const xScale = (index: number) => {
      return (index / (scans.length - 1)) * chartWidth;
    };

    return {
      padding,
      chartWidth,
      chartHeight,
      yScale,
      xScale,
      yMin,
      yMax,
    };
  }, [scans, width, height]);

  if (!chartData || scans.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        Geen data beschikbaar
      </div>
    );
  }

  const { padding, chartWidth, chartHeight, yScale, xScale, yMin, yMax } = chartData;

  // Generate paths
  const averageLine = scans.map((scan, i) => {
    const x = xScale(i);
    const y = yScale(scan.overallAverage);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const medianLine = scans.map((scan, i) => {
    const x = xScale(i);
    const y = yScale(scan.median);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Generate spread areas (P10-P90 and P25-P75)
  const p1090Area = (() => {
    const topPath = scans.map((scan, i) => `${xScale(i)},${yScale(scan.p90)}`).join(' ');
    const bottomPath = scans.map((scan, i) => `${xScale(scans.length - 1 - i)},${yScale(scans[scans.length - 1 - i].p10)}`).join(' ');
    return `M ${topPath} L ${bottomPath} Z`;
  })();

  const p2575Area = (() => {
    const topPath = scans.map((scan, i) => `${xScale(i)},${yScale(scan.p75)}`).join(' ');
    const bottomPath = scans.map((scan, i) => `${xScale(scans.length - 1 - i)},${yScale(scans[scans.length - 1 - i].p25)}`).join(' ');
    return `M ${topPath} L ${bottomPath} Z`;
  })();

  return (
    <svg width={width} height={height} className="text-slate-600">
      <g transform={`translate(${padding.left},${padding.top})`}>
        {/* Y-axis */}
        <line
          x1={0}
          y1={0}
          x2={0}
          y2={chartHeight}
          stroke="currentColor"
          strokeOpacity={0.2}
        />
        {[1, 2, 3, 4, 5].map((tick) => {
          const y = yScale(tick);
          return (
            <g key={tick}>
              <line
                x1={0}
                y1={y}
                x2={chartWidth}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.1}
                strokeDasharray="2,2"
              />
              <text
                x={-8}
                y={y}
                textAnchor="end"
                alignmentBaseline="middle"
                className="text-xs fill-slate-400"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* X-axis */}
        <line
          x1={0}
          y1={chartHeight}
          x2={chartWidth}
          y2={chartHeight}
          stroke="currentColor"
          strokeOpacity={0.2}
        />
        {scans.map((scan, i) => {
          const x = xScale(i);
          return (
            <g key={scan.scanId}>
              <line
                x1={x}
                y1={chartHeight}
                x2={x}
                y2={chartHeight + 4}
                stroke="currentColor"
                strokeOpacity={0.3}
              />
              <text
                x={x}
                y={chartHeight + 16}
                textAnchor="middle"
                className="text-[10px] fill-slate-500"
              >
                {scan.label.length > 12 ? scan.label.substring(0, 10) + '...' : scan.label}
              </text>
            </g>
          );
        })}

        {/* Spread bands (only in spread mode) */}
        {mode === "spread" && (
          <>
            <path
              d={p1090Area}
              fill="#3b82f6"
              fillOpacity={0.1}
            />
            <path
              d={p2575Area}
              fill="#3b82f6"
              fillOpacity={0.15}
            />
          </>
        )}

        {/* Median line (dashed) */}
        <path
          d={medianLine}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={1.5}
          strokeDasharray="4,4"
        />

        {/* Average line (solid with dots) */}
        <path
          d={averageLine}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
        />
        {scans.map((scan, i) => {
          const x = xScale(i);
          const y = yScale(scan.overallAverage);
          return (
            <circle
              key={scan.scanId}
              cx={x}
              cy={y}
              r={3}
              fill="#3b82f6"
              stroke="white"
              strokeWidth={2}
            />
          );
        })}
      </g>
    </svg>
  );
}
