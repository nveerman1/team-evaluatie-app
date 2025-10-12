"use client";
import api from "@/lib/api";
import { useEffect, useState } from "react";

type Evaluation = {
  id: number;
  title: string;
  status: string;
  rubric_id: number;
  course_id: number;
};

export default function StudentStart() {
  const [evals, setEvals] = useState<Evaluation[]>([]);
  useEffect(() => {
    api.get<Evaluation[]>("/evaluations").then((r) => {
      // simpele MVP: toon alleen OPEN evaluaties
      setEvals((r.data || []).filter((e) => e.status === "open"));
    });
  }, []);
  return (
    <main className="p-6 max-w-3xl mx-auto space-y-4">
      <h2 className="text-xl font-semibold">Kies je evaluatie</h2>
      <ul className="space-y-2">
        {evals.map((e) => (
          <li
            key={e.id}
            className="p-3 border rounded-xl flex items-center justify-between"
          >
            <div>
              <div className="font-medium">{e.title}</div>
              <div className="text-sm text-gray-500">
                #{e.id} • status: {e.status}
              </div>
            </div>
            <a
              className="px-3 py-2 rounded-xl bg-black text-white"
              href={`/student/${e.id}`}
            >
              Openen
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
