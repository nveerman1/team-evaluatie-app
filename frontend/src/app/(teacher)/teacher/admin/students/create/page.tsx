"use client";

import api from "@/lib/api";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateStudentPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [className, setClassName] = useState("");
  const [cluster, setCluster] = useState("");
  const [teamNumber, setTeamNumber] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Naam is verplicht");
      return;
    }
    if (!email.trim()) {
      setError("Email is verplicht");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        class_name: className.trim() || null,
        cluster: cluster.trim() || null,
        team_number: teamNumber.trim() === "" ? null : Number(teamNumber),
        status,
      };

      await api.post("/admin/students", payload);
      router.push("/teacher/admin/students");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(
        err?.response?.data?.detail || err?.message || "Aanmaken mislukt"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Nieuwe leerling</h1>
        <p className="text-gray-600">
          Voeg een nieuwe leerling toe aan het systeem.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 bg-white p-5 rounded-2xl border"
      >
        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium">
              Naam <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bijv. Jan Jansen"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              className="w-full border rounded-lg px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Bijv. jan.jansen@school.nl"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium">
              Cluster (optioneel)
            </label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={cluster}
              onChange={(e) => setCluster(e.target.value)}
              placeholder="Bijv. A"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium">
              Klas (optioneel)
            </label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="Bijv. 4A"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium">
              Team # (optioneel)
            </label>
            <input
              type="number"
              className="w-full border rounded-lg px-3 py-2"
              value={teamNumber}
              onChange={(e) => setTeamNumber(e.target.value)}
              placeholder="Bijv. 1"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium">Status</label>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={status}
              onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
            >
              <option value="active">Actief</option>
              <option value="inactive">Inactief</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
          >
            {saving ? "Aanmaken…" : "Aanmaken"}
          </button>
          <a
            href="/teacher/admin/students"
            className="px-4 py-2 rounded-xl border"
          >
            Annuleer
          </a>
        </div>
      </form>
    </main>
  );
}
