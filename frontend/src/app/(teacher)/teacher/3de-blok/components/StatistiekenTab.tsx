"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, TrendingDown } from "lucide-react";
import api from "@/lib/api";
import {
  attendanceService,
  type Course,
  type StatsSummary,
  type WeeklyStats,
  type DailyStats,
  type HeatmapData,
  type SignalsData,
  type TopBottomData,
} from "@/services/attendance.service";
import { toast } from "@/lib/toast";
import { Doughnut, Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Register Chart.js components
ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function StatistiekenTab() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("4w");
  const [courseId, setCourseId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [onlyLast4Weeks, setOnlyLast4Weeks] = useState(true);

  const [courses, setCourses] = useState<Course[]>([]);
  const [projects, setProjects] = useState<{ id: number; title: string }[]>([]);
  
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [weekly, setWeekly] = useState<WeeklyStats[]>([]);
  const [daily, setDaily] = useState<DailyStats[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [signals, setSignals] = useState<SignalsData | null>(null);
  const [topBottom, setTopBottom] = useState<TopBottomData | null>(null);

  useEffect(() => {
    fetchDropdownData();
  }, []);

  useEffect(() => {
    fetchStatistics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, courseId, projectId, onlyLast4Weeks]);

  const fetchDropdownData = async () => {
    try {
      const [coursesData, projectsResponse] = await Promise.all([
        attendanceService.listCourses(),
        api.get("/projects", { params: { status: "active,completed" } }),
      ]);
      setCourses(coursesData);
      // ProjectListResponse has an 'items' field, not a direct array
      const projectsData = projectsResponse.data?.items || projectsResponse.data || [];
      setProjects(Array.isArray(projectsData) ? projectsData : []);
    } catch (err) {
      console.error("Error fetching dropdown data:", err);
      toast.error("Kon filters niet laden");
    }
  };

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      
      const params = {
        period,
        ...(courseId && { course_id: courseId }),
        ...(projectId && { project_id: projectId }),
      };

      const topBottomMode = onlyLast4Weeks ? "4w" : "scope";

      const [summaryData, weeklyData, dailyData, heatmapData, signalsData, topBottomData] =
        await Promise.all([
          attendanceService.getStatsSummary(params),
          attendanceService.getStatsWeekly(params),
          attendanceService.getStatsDaily(params),
          attendanceService.getStatsHeatmap(params),
          attendanceService.getStatsSignals(params),
          attendanceService.getStatsTopBottom({ ...params, mode: topBottomMode }),
        ]);

      setSummary(summaryData);
      setWeekly(weeklyData);
      setDaily(dailyData);
      setHeatmap(heatmapData);
      setSignals(signalsData);
      setTopBottom(topBottomData);
    } catch (err) {
      console.error("Error fetching statistics:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Kon statistieken niet ophalen: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    // Simple CSV export combining available data
    const header = ["Type", "Value"].join(",");
    const lines = [
      `School Minutes,${summary?.school_minutes || 0}`,
      `Extern Minutes,${summary?.extern_approved_minutes || 0}`,
      `Total Blocks,${summary?.total_blocks || 0}`,
    ];
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statistieken.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV geëxporteerd");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Statistieken laden...</p>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const donutData = {
    labels: ["School", "Extern (goedgekeurd)"],
    datasets: [
      {
        data: [summary?.school_blocks || 0, summary?.extern_approved_blocks || 0],
        backgroundColor: ["#3b82f6", "#f59e0b"],
        borderWidth: 0,
      },
    ],
  };

  const weeklyChartData = {
    labels: weekly.map((w) => {
      const date = new Date(w.week_start);
      return `${date.getDate()}/${date.getMonth() + 1}`;
    }),
    datasets: [
      {
        label: "Totaal blokken",
        data: weekly.map((w) => w.total_blocks),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        tension: 0.3,
      },
    ],
  };

  const dailyChartData = {
    labels: daily.map((d) => {
      const date = new Date(d.date);
      return `${date.getDate()}/${date.getMonth() + 1}`;
    }),
    datasets: [
      {
        label: "Aanwezigen",
        data: daily.map((d) => d.unique_students),
        backgroundColor: "#3b82f6",
      },
    ],
  };

  // Heatmap rendering
  const weekdayLabels = ["Ma", "Di", "Wo", "Do", "Vr"];
  const hours = Array.from({ length: 11 }, (_, i) => i + 8); // 8-18

  // Build heatmap matrix
  const heatmapMatrix: number[][] = Array(5)
    .fill(0)
    .map(() => Array(11).fill(0));
  
  if (heatmap) {
    heatmap.cells.forEach((cell) => {
      if (cell.weekday >= 0 && cell.weekday < 5 && cell.hour >= 8 && cell.hour <= 18) {
        heatmapMatrix[cell.weekday][cell.hour - 8] = cell.avg_students;
      }
    });
  }

  // Find max for color scaling
  const maxStudents = Math.max(...heatmapMatrix.flat(), 1);

  const getHeatmapColor = (value: number) => {
    if (value === 0) return "bg-slate-50";
    const intensity = Math.min(value / maxStudents, 1);
    // Cool blue-gray palette
    if (intensity < 0.2) return "bg-blue-100/50";
    if (intensity < 0.4) return "bg-blue-200/60";
    if (intensity < 0.6) return "bg-blue-300/70";
    if (intensity < 0.8) return "bg-blue-400/80";
    return "bg-blue-500/90";
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="4w">Laatste 4 weken</option>
              <option value="8w">Laatste 8 weken</option>
              <option value="all">Alles</option>
            </select>

            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
              value={courseId || ""}
              onChange={(e) => setCourseId(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">Alle vakken</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
              value={projectId || ""}
              onChange={(e) => setProjectId(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">Alle projecten</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <Button variant="secondary" onClick={exportCsv} className="gap-2">
            <Download className="h-4 w-4" />
            Download CSV
          </Button>
        </div>
      </div>

      {/* Charts Row 1: Donut + Weekly Trend */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Donut Chart */}
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">School vs Extern</h3>
            <p className="text-xs text-slate-500">Verdeling van blokken</p>
          </div>
          <div className="flex items-center justify-center" style={{ height: "250px" }}>
            <Doughnut
              data={donutData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: "bottom",
                  },
                  tooltip: {
                    callbacks: {
                      label: (context) => {
                        const label = context.label || "";
                        const value = context.parsed || 0;
                        const pct =
                          label === "School"
                            ? summary?.school_percentage
                            : summary?.extern_percentage;
                        return `${label}: ${value.toFixed(1)} blokken (${pct?.toFixed(1)}%)`;
                      },
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Weekly Trend */}
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Totale aanwezigheid per week</h3>
            <p className="text-xs text-slate-500">School + goedgekeurd extern</p>
          </div>
          <div style={{ height: "250px" }}>
            <Line
              data={weeklyChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false,
                  },
                  tooltip: {
                    callbacks: {
                      title: (items) => {
                        const idx = items[0]?.dataIndex;
                        if (idx !== undefined && weekly[idx]) {
                          return `Week van ${weekly[idx].week_start}`;
                        }
                        return "";
                      },
                      label: (context) => {
                        return `Totaal: ${(context.parsed.y ?? 0).toFixed(1)} blokken`;
                      },
                    },
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: "Blokken",
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Charts Row 2: Daily Bar Chart */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Aantal aanwezigen per dag</h3>
          <p className="text-xs text-slate-500">Unieke leerlingen met school check-in</p>
        </div>
        <div style={{ height: "250px" }}>
          <Bar
            data={dailyChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: false,
                },
                tooltip: {
                  callbacks: {
                    title: (items) => {
                      const idx = items[0]?.dataIndex;
                      if (idx !== undefined && daily[idx]) {
                        return daily[idx].date;
                      }
                      return "";
                    },
                    label: (context) => {
                      return `Aanwezigen: ${context.parsed.y}`;
                    },
                  },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: "Aantal leerlingen",
                  },
                },
              },
            }}
          />
        </div>
      </div>

      {/* Heatmap */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Aanwezigheidsheatmap (gemiddeld)</h3>
          <p className="text-xs text-slate-500">
            School check-ins geaggregeerd over laatste 4 weken
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-slate-200 bg-slate-50 p-2 text-xs font-semibold text-slate-600"></th>
                {weekdayLabels.map((day, i) => (
                  <th
                    key={i}
                    className="border border-slate-200 bg-slate-50 p-2 text-xs font-semibold text-slate-600"
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hours.map((hour, hIdx) => (
                <tr key={hour}>
                  <td className="border border-slate-200 bg-slate-50 p-2 text-xs font-semibold text-slate-600 text-center">
                    {hour}:00
                  </td>
                  {weekdayLabels.map((_, wIdx) => {
                    const value = heatmapMatrix[wIdx][hIdx];
                    const colorClass = getHeatmapColor(value);
                    return (
                      <td
                        key={wIdx}
                        className={`border border-slate-200 p-3 text-center text-xs ${colorClass}`}
                        title={`${weekdayLabels[wIdx]} ${hour}:00 – gem. ${value.toFixed(1)} aanwezigen`}
                      >
                        {value > 0 ? value.toFixed(1) : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signals Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Signal 1: Veel extern, weinig school */}
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex items-center gap-2">
            <div className="rounded-lg bg-amber-100 p-2">
              <TrendingDown className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Veel extern, weinig school</h4>
              <p className="text-xs text-slate-500">Extern ≥4u, school ≤2 blokken</p>
            </div>
          </div>
          <div className="space-y-2">
            {signals?.extern_low_school && signals.extern_low_school.length > 0 ? (
              signals.extern_low_school.map((s) => (
                <div
                  key={s.student_id}
                  className="rounded-lg bg-slate-50 p-2 text-xs ring-1 ring-slate-200"
                >
                  <div className="font-medium text-slate-900">{s.student_name}</div>
                  <div className="text-slate-600">
                    {s.course && <span className="mr-2">{s.course}</span>}
                    <span className="text-amber-700">{s.value_text}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">Geen signalen</p>
            )}
          </div>
        </div>

        {/* Signal 2: Veel pending */}
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex items-center gap-2">
            <div className="rounded-lg bg-blue-100 p-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Veel in afwachting</h4>
              <p className="text-xs text-slate-500">≥3 pending extern registraties</p>
            </div>
          </div>
          <div className="space-y-2">
            {signals?.many_pending && signals.many_pending.length > 0 ? (
              signals.many_pending.map((s) => (
                <div
                  key={s.student_id}
                  className="rounded-lg bg-slate-50 p-2 text-xs ring-1 ring-slate-200"
                >
                  <div className="font-medium text-slate-900">{s.student_name}</div>
                  <div className="text-slate-600">
                    {s.course && <span className="mr-2">{s.course}</span>}
                    <span className="text-blue-700">{s.value_text}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">Geen signalen</p>
            )}
          </div>
        </div>

        {/* Signal 3: Lange open check-ins */}
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex items-center gap-2">
            <div className="rounded-lg bg-rose-100 p-2">
              <TrendingDown className="h-4 w-4 text-rose-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Lange open check-ins</h4>
              <p className="text-xs text-slate-500">Open ≥12 uur zonder check-out</p>
            </div>
          </div>
          <div className="space-y-2">
            {signals?.long_open && signals.long_open.length > 0 ? (
              signals.long_open.map((s) => (
                <div
                  key={s.student_id}
                  className="rounded-lg bg-slate-50 p-2 text-xs ring-1 ring-slate-200"
                >
                  <div className="font-medium text-slate-900">{s.student_name}</div>
                  <div className="text-slate-600">
                    {s.course && <span className="mr-2">{s.course}</span>}
                    <span className="text-rose-700">{s.value_text}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">Geen signalen</p>
            )}
          </div>
        </div>
      </div>

      {/* Top & Bottom Engagement */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Top & Bottom betrokkenheid</h3>
            <p className="text-xs text-slate-500">Gerangschikt op totaal blokken</p>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={onlyLast4Weeks}
              onChange={(e) => setOnlyLast4Weeks(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="text-slate-700">Alleen laatste 4 weken</span>
          </label>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Top 5 */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Top 5
            </h4>
            <div className="space-y-2">
              {topBottom?.top && topBottom.top.length > 0 ? (
                topBottom.top.map((s, i) => (
                  <div
                    key={s.student_id}
                    className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2 text-xs ring-1 ring-emerald-200"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">{s.student_name}</div>
                      <div className="text-slate-600">{s.course}</div>
                    </div>
                    <div className="shrink-0 font-semibold text-emerald-700">
                      {s.total_blocks.toFixed(1)}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500">Geen data</p>
              )}
            </div>
          </div>

          {/* Bottom 5 */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Bottom 5
            </h4>
            <div className="space-y-2">
              {topBottom?.bottom && topBottom.bottom.length > 0 ? (
                topBottom.bottom.map((s, i) => (
                  <div
                    key={s.student_id}
                    className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-xs ring-1 ring-slate-200"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-400 text-xs font-bold text-white">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">{s.student_name}</div>
                      <div className="text-slate-600">{s.course}</div>
                    </div>
                    <div className="shrink-0 font-semibold text-slate-700">
                      {s.total_blocks.toFixed(1)}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500">Geen data</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
