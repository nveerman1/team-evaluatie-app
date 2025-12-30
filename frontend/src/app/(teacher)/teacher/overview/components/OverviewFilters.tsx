"use client";

import React from "react";
import { Search } from "lucide-react";

export interface OverviewFilterValues {
  academicYear?: string;
  courseId?: string;
  period?: string;
  classId?: string;
  searchQuery?: string;
}

interface OverviewFiltersProps {
  filters: OverviewFilterValues;
  onFiltersChange: (filters: OverviewFilterValues) => void;
  academicYears?: Array<{ id: number; label: string }>;
  courses?: Array<{ id: number; name: string }>;
  periods?: Array<{ value: string; label: string }>;
  classes?: Array<{ id: string; name: string }>;
  loading?: boolean;
  showAcademicYear?: boolean;
  showPeriod?: boolean;
  showClass?: boolean;
  showSearch?: boolean;
  children?: React.ReactNode;
}

export default function OverviewFilters({
  filters,
  onFiltersChange,
  academicYears = [],
  courses = [],
  periods = [],
  classes = [],
  loading = false,
  showAcademicYear = true,
  showPeriod = true,
  showClass = false,
  showSearch = true,
  children,
}: OverviewFiltersProps) {
  const handleChange = (key: keyof OverviewFilterValues, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Academic Year */}
        {showAcademicYear && (
          <div>
            <label className="block text-xs text-gray-600 mb-1">Academisch Jaar</label>
            <select
              className="w-full px-3 py-2 text-sm border rounded-lg"
              value={filters.academicYear || ""}
              onChange={(e) => handleChange("academicYear", e.target.value)}
              disabled={loading}
            >
              <option value="">Alle jaren</option>
              {academicYears.map((year) => (
                <option key={year.id} value={year.label}>
                  {year.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Course (Vak) - Required */}
        <div>
          <label className="block text-xs text-gray-600 mb-1">
            Vak <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full px-3 py-2 text-sm border rounded-lg"
            value={filters.courseId || ""}
            onChange={(e) => handleChange("courseId", e.target.value)}
            disabled={loading}
          >
            <option value="">Kies een vak...</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </div>

        {/* Period */}
        {showPeriod && (
          <div>
            <label className="block text-xs text-gray-600 mb-1">Periode</label>
            <select
              className="w-full px-3 py-2 text-sm border rounded-lg"
              value={filters.period || ""}
              onChange={(e) => handleChange("period", e.target.value)}
              disabled={loading}
            >
              {periods.length === 0 ? (
                <>
                  <option value="">Alle periodes</option>
                  <option value="P1">P1</option>
                  <option value="P2">P2</option>
                  <option value="P3">P3</option>
                  <option value="P4">P4</option>
                </>
              ) : (
                periods.map((period) => (
                  <option key={period.value} value={period.value}>
                    {period.label}
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        {/* Class */}
        {showClass && (
          <div>
            <label className="block text-xs text-gray-600 mb-1">Klas</label>
            <select
              className="w-full px-3 py-2 text-sm border rounded-lg"
              value={filters.classId || ""}
              onChange={(e) => handleChange("classId", e.target.value)}
              disabled={loading}
            >
              <option value="">Alle klassen</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Search Student */}
        {showSearch && (
          <div>
            <label className="block text-xs text-gray-600 mb-1">Zoek leerling</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Zoek op naam..."
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg"
                value={filters.searchQuery || ""}
                onChange={(e) => handleChange("searchQuery", e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Additional controls (e.g., toggles for AllItemsTab) */}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
