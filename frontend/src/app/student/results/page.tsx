"use client";

import { useEffect, useState } from "react";
import { StudentResult } from "@/dtos";
import { ResultsView } from "@/components/student";
import { Loading, ErrorMessage } from "@/components";
import { studentService } from "@/services";
import Link from "next/link";

// Mock user ID - in a real app, this would come from auth context
const MOCK_USER_ID = 1;

export default function StudentResults() {
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<number | null>(null);

  useEffect(() => {
    studentService
      .getAllResults(MOCK_USER_ID)
      .then((data) => {
        setResults(data);
        if (data.length > 0) {
          setSelectedResultId(data[0].evaluation_id);
        }
      })
      .catch((e) => {
        setError(
          e?.response?.data?.detail || e?.message || "Kon resultaten niet laden"
        );
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;

  const selectedResult = results.find(
    (r) => r.evaluation_id === selectedResultId
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
                Mijn Resultaten
              </h1>
              <p className="text-gray-600 mt-1 text-sm">
                Bekijk je cijfers, feedback en reflecties
              </p>
            </div>
            <Link
              href="/student"
              className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              ← Terug naar Dashboard
            </Link>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-6">
        {results.length === 0 ? (
        <div className="p-12 border rounded-xl bg-gray-50 text-center">
          <p className="text-gray-500 text-lg">
            Je hebt nog geen voltooide evaluaties met resultaten.
          </p>
          <Link
            href="/student"
            className="mt-4 inline-block px-6 py-3 rounded-xl bg-black text-white hover:bg-gray-800 transition-colors"
          >
            Ga naar Open Evaluaties
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-4 gap-6">
          {/* Sidebar - Evaluation List */}
          <div className="md:col-span-1 space-y-2">
            <h2 className="text-sm font-semibold text-gray-600 mb-3">
              EVALUATIES ({results.length})
            </h2>
            {results.map((result) => (
              <button
                key={result.evaluation_id}
                onClick={() => setSelectedResultId(result.evaluation_id)}
                className={`
                  w-full text-left p-3 rounded-lg border transition-all
                  ${
                    selectedResultId === result.evaluation_id
                      ? "bg-black text-white border-black"
                      : "bg-white hover:bg-gray-50 border-gray-200"
                  }
                `}
              >
                <div className="font-medium text-sm truncate">
                  {result.evaluation_title}
                </div>
                {result.final_grade !== undefined &&
                  result.final_grade !== null && (
                    <div className="text-2xl font-bold mt-1">
                      {result.final_grade.toFixed(1)}
                    </div>
                  )}
              </button>
            ))}
          </div>

          {/* Main Content - Result Detail */}
          <div className="md:col-span-3">
            {selectedResult ? (
              <>
                <h2 className="text-2xl font-bold mb-6">
                  {selectedResult.evaluation_title}
                </h2>
                <ResultsView result={selectedResult} />
              </>
            ) : (
              <div className="p-8 border rounded-xl bg-gray-50 text-center">
                <p className="text-gray-500">
                  Selecteer een evaluatie om de resultaten te bekijken.
                </p>
              </div>
            )}
          </div>
        </div>
        )}
      </main>
    </div>
  );
}
