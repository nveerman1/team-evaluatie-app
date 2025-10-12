"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function Home() {
  const [email, setEmail] = useState("");
  const router = useRouter();
  useEffect(() => {
    const e = localStorage.getItem("x_user_email");
    if (e) setEmail(e);
  }, []);
  const go = (path: string) => router.push(path);

  return (
    <main className="p-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Team Evaluatie App — MVP</h1>
      <div className="p-4 border rounded-xl space-y-3">
        <label className="block text-sm">Dev-login (X-User-Email)</label>
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="student1@example.com of docent@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          className="px-4 py-2 rounded-xl bg-black text-white"
          onClick={() => {
            localStorage.setItem("x_user_email", email);
          }}
        >
          Opslaan
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          className="px-4 py-3 rounded-xl border"
          onClick={() => go("/student")}
        >
          Student
        </button>
        <button
          className="px-4 py-3 rounded-xl border"
          onClick={() => go("/teacher")}
        >
          Teacher
        </button>
      </div>
    </main>
  );
}
