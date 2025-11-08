"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { overviewService } from "@/services";
import { OverviewMatrixResponse, MatrixFilters, MatrixCell } from "@/dtos/overview.dto";
import { Loading } from "@/components";
import { formatDate } from "@/utils";

export default function AllItemsTab() {
  const [matrixData, setMatrixData] = useState<OverviewMatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filter state
  const [filters, setFilters] = useState<MatrixFilters>({});
  
  // Separate state for filter inputs
  const [filterInputs, setFilterInputs] = useState({
    course_id: "",
    class_name: "",
    date_from: "",
    date_to: "",
  });

  // Display options
  const [showAverages, setShowAverages] = useState(true);
  const [showTrends, setShowTrends] = useState(false);

  // Load data
  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await overviewService.getMatrix(filters);
      setMatrixData(response);
    } catch (error) {
      console.error("Error loading matrix data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setFilters({
      course_id: filterInputs.course_id ? parseInt(filterInputs.course_id) : undefined,
      class_name: filterInputs.class_name || undefined,
      date_from: filterInputs.date_from || undefined,
      date_to: filterInputs.date_to || undefined,
    });
  };

  const handleResetFilters = () => {
    setFilterInputs({
      course_id: "",
      class_name: "",
      date_from: "",
      date_to: "",
    });
    setFilters({});
  };

  const getScoreColor = (score: number | null | undefined): string => {
    if (score === null || score === undefined) return "bg-gray-100 text-gray-400";
    
    // Assuming 1-5 scale (normalized)
    if (score >= 4.0) return "bg-green-100 text-green-800";
    if (score >= 3.0) return "bg-yellow-100 text-yellow-800";
    if (score >= 2.0) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case "project": return "📊";
      case "peer": return "👥";
      case "competency": return "🎯";
      default: return "📄";
    }
  };

  const renderCell = (cell: MatrixCell | null, studentId: number) => {
    if (!cell) {
      return (
        <td className="px-2 py-2 text-center border-r border-gray-200">
          <div className="w-full h-10 bg-gray-50 rounded flex items-center justify-center text-gray-300 text-xs">
            —
          </div>
        </td>
      );
    }

    const scoreColor = getScoreColor(cell.score);
    const icon = getTypeIcon(cell.type);
    
    return (
      <td className="px-2 py-2 text-center border-r border-gray-200">
        <Link
          href={cell.detail_url}
          className="group block"
          title={`${cell.title}\nScore: ${cell.score?.toFixed(1) || "—"}\nDatum: ${cell.date ? formatDate(cell.date) : "—"}\nDocent: ${cell.teacher_name || "—"}`}
        >
          <div className={`w-full h-10 rounded flex flex-col items-center justify-center ${scoreColor} group-hover:ring-2 group-hover:ring-blue-500 transition-all cursor-pointer`}>
            <div className="text-xs">{icon}</div>
            <div className="font-bold text-sm">
              {cell.score !== null && cell.score !== undefined ? cell.score.toFixed(1) : "—"}
            </div>
          </div>
        </Link>
      </td>
    );
  };

  if (loading) {
    return <Loading />;
  }

  if (!matrixData || matrixData.rows.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg font-medium mb-2">Geen gegevens gevonden</p>
        <p className="text-sm mb-4">Pas de filters aan om resultaten te zien</p>
        <button
          onClick={handleResetFilters}
          className="text-blue-600 hover:underline text-sm"
        >
          Reset filters
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with summary */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {matrixData.total_students} leerlingen • {matrixData.columns.length} evaluaties
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-sm text-gray-700">Filters</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Course ID - placeholder for now */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Vak (ID)</label>
            <input
              type="number"
              placeholder="Course ID..."
              className="w-full px-3 py-2 text-sm border rounded-lg"
              value={filterInputs.course_id}
              onChange={(e) => setFilterInputs({ ...filterInputs, course_id: e.target.value })}
            />
          </div>

          {/* Class */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Klas</label>
            <input
              type="text"
              placeholder="Klas naam..."
              className="w-full px-3 py-2 text-sm border rounded-lg"
              value={filterInputs.class_name}
              onChange={(e) => setFilterInputs({ ...filterInputs, class_name: e.target.value })}
            />
          </div>

          {/* Date From */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Van datum</label>
            <input
              type="date"
              className="w-full px-3 py-2 text-sm border rounded-lg"
              value={filterInputs.date_from}
              onChange={(e) => setFilterInputs({ ...filterInputs, date_from: e.target.value })}
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Tot datum</label>
            <input
              type="date"
              className="w-full px-3 py-2 text-sm border rounded-lg"
              value={filterInputs.date_to}
              onChange={(e) => setFilterInputs({ ...filterInputs, date_to: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <button
            onClick={handleApplyFilters}
            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:opacity-90"
          >
            Toepassen
          </button>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-100"
          >
            Reset
          </button>

          {/* Display options */}
          <div className="ml-4 flex gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showAverages}
                onChange={(e) => setShowAverages(e.target.checked)}
                className="rounded"
              />
              <span className="text-gray-700">Toon gemiddelden</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showTrends}
                onChange={(e) => setShowTrends(e.target.checked)}
                className="rounded"
              />
              <span className="text-gray-700">Toon trends</span>
            </label>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-green-100 rounded"></div>
          <span>Hoog (≥4.0)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-yellow-100 rounded"></div>
          <span>Gemiddeld (3.0-3.9)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-orange-100 rounded"></div>
          <span>Matig (2.0-2.9)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-red-100 rounded"></div>
          <span>Laag (&lt;2.0)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gray-50 rounded"></div>
          <span>Geen data</span>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto border rounded-xl">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {/* Sticky student columns */}
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r-2 border-gray-300 sticky left-0 bg-gray-50 z-20">
                Leerling
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r-2 border-gray-300 sticky left-[150px] bg-gray-50 z-20">
                Klas
              </th>
              
              {/* Dynamic evaluation columns */}
              {matrixData.columns.map((col) => (
                <th
                  key={col.key}
                  className="px-2 py-3 text-center text-xs font-semibold text-gray-700 border-r border-gray-200"
                  style={{ minWidth: "80px" }}
                  title={`${col.title}\n${col.date ? formatDate(col.date) : "Geen datum"}`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span>{getTypeIcon(col.type)}</span>
                    <span className="truncate max-w-[60px]">{col.title}</span>
                    <span className="text-[10px] text-gray-500">
                      {col.date ? formatDate(col.date) : "—"}
                    </span>
                  </div>
                </th>
              ))}
              
              {/* Average column */}
              {showAverages && (
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-l-2 border-gray-300 bg-gray-100 sticky right-0 z-20">
                  Gem.
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {matrixData.rows.map((row) => (
              <tr key={row.student_id} className="hover:bg-gray-50">
                {/* Sticky student info */}
                <td className="px-4 py-2 text-sm font-medium text-gray-900 border-r-2 border-gray-300 sticky left-0 bg-white z-10">
                  {row.student_name}
                </td>
                <td className="px-4 py-2 text-sm text-gray-600 border-r-2 border-gray-300 sticky left-[150px] bg-white z-10">
                  {row.student_class || "—"}
                </td>
                
                {/* Dynamic cells */}
                {matrixData.columns.map((col) => 
                  renderCell(row.cells[col.key], row.student_id)
                )}
                
                {/* Average */}
                {showAverages && (
                  <td className="px-4 py-2 text-center font-bold text-sm border-l-2 border-gray-300 bg-gray-50 sticky right-0 z-10">
                    {row.average !== null && row.average !== undefined ? row.average.toFixed(2) : "—"}
                  </td>
                )}
              </tr>
            ))}
            
            {/* Column averages row */}
            {showAverages && (
              <tr className="bg-gray-100 font-semibold">
                <td className="px-4 py-2 text-sm border-r-2 border-gray-300 sticky left-0 bg-gray-100 z-10">
                  Gem. per evaluatie
                </td>
                <td className="px-4 py-2 border-r-2 border-gray-300 sticky left-[150px] bg-gray-100 z-10"></td>
                
                {matrixData.columns.map((col) => {
                  const avg = matrixData.column_averages[col.key];
                  return (
                    <td key={col.key} className="px-2 py-2 text-center text-sm border-r border-gray-200">
                      {avg !== null && avg !== undefined ? avg.toFixed(2) : "—"}
                    </td>
                  );
                })}
                
                {showAverages && (
                  <td className="px-4 py-2 border-l-2 border-gray-300 bg-gray-100 sticky right-0 z-10"></td>
                )}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Info text */}
      <div className="text-xs text-gray-500">
        💡 <strong>Tip:</strong> Klik op een cel om naar de detailweergave te gaan. Hover voor meer informatie.
      </div>
    </div>
  );
}
