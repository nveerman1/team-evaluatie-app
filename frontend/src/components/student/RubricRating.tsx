"use client";

import { Criterion } from "@/dtos";

type RubricRatingProps = {
  criterion: Criterion;
  value: number;
  comment: string;
  onChange: (value: number) => void;
  onCommentChange: (comment: string) => void;
};

export function RubricRating({
  criterion,
  value,
  comment,
  onChange,
  onCommentChange,
}: RubricRatingProps) {
  const levels = [1, 2, 3, 4, 5];

  return (
    <div className="p-4 border rounded-lg bg-white space-y-4">
      {/* Criterion Name */}
      <h4 className="font-medium text-lg">{criterion.name}</h4>

      {/* Rubric Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {levels.map((level) => (
                <th
                  key={level}
                  className="border border-gray-300 p-2 bg-gray-50 text-center font-semibold"
                >
                  {level}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {levels.map((level) => {
                const isSelected = value === level;
                const descriptor = criterion.descriptors[`level${level}`] || "";

                return (
                  <td
                    key={level}
                    className={`border border-gray-300 p-3 text-sm cursor-pointer transition-all ${
                      isSelected
                        ? "bg-blue-100 border-blue-500 border-2"
                        : "bg-white hover:bg-gray-50"
                    }`}
                    onClick={() => onChange(level)}
                  >
                    <div className="flex flex-col items-center gap-2">
                      {/* Radio Button / Check Icon */}
                      <div className="flex items-center justify-center w-6 h-6">
                        {isSelected ? (
                          <svg
                            className="w-6 h-6 text-blue-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                        )}
                      </div>

                      {/* Descriptor Text */}
                      {descriptor && (
                        <p className="text-xs text-gray-600 text-center">
                          {descriptor}
                        </p>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Comments Field */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Opmerkingen
        </label>
        <textarea
          className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Optionele opmerking..."
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}
