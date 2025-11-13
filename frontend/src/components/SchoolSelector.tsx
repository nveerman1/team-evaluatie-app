"use client";

import { useState, useEffect } from "react";
import { School } from "@/dtos/user.dto";

interface SchoolSelectorProps {
  schools: School[];
  selectedSchoolId?: number;
  onSchoolChange: (school: School) => void;
}

export default function SchoolSelector({
  schools,
  selectedSchoolId,
  onSchoolChange,
}: SchoolSelectorProps) {
  const [selected, setSelected] = useState<number | undefined>(selectedSchoolId);

  useEffect(() => {
    // Auto-select first school if none selected
    if (!selected && schools.length > 0) {
      setSelected(schools[0].id);
      onSchoolChange(schools[0]);
    }
  }, [schools, selected, onSchoolChange]);

  // Don't show selector if user only has one school
  if (schools.length <= 1) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const schoolId = parseInt(e.target.value);
    setSelected(schoolId);
    const school = schools.find((s) => s.id === schoolId);
    if (school) {
      onSchoolChange(school);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-3 border border-blue-200">
      <div className="flex items-center gap-2">
        <svg
          className="h-5 w-5 text-blue-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        <label htmlFor="school-select" className="text-sm font-medium text-blue-900">
          School:
        </label>
      </div>
      <select
        id="school-select"
        value={selected || ""}
        onChange={handleChange}
        className="flex-1 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
      >
        {schools.map((school) => (
          <option key={school.id} value={school.id}>
            {school.name}
          </option>
        ))}
      </select>
    </div>
  );
}
