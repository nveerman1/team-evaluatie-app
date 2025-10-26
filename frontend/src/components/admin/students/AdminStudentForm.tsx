"use client";

import { useState } from "react";
import type { AdminStudentCreate } from "@/dtos/admin_students.dto";

type Props = {
  onSubmit: (payload: AdminStudentCreate) => Promise<void> | void;
  initial?: Partial<AdminStudentCreate>;
  submitLabel?: string;
};

export default function AdminStudentForm({
  onSubmit,
  initial,
  submitLabel = "Opslaan",
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [className, setClassName] = useState(initial?.class_name ?? "");
  const [teamNumber, setTeamNumber] = useState(
    initial?.team_number?.toString() ?? "",
  );
  const [status, setStatus] = useState<"active" | "inactive">(
    (initial?.status as any) ?? "active",
  );
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const payload: AdminStudentCreate = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      class_name: className.trim() || null,
      team_number: teamNumber.trim() ? Number(teamNumber.trim()) : null,
      status,
    };

    setBusy(true);
    await Promise.resolve(onSubmit(payload)).finally(() => setBusy(false));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border rounded-2xl p-5 space-y-4 max-w-xl"
    >
      <Field label="Naam">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
        />
      </Field>
      <Field label="E-mail">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Klas (optioneel)">
          <input
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
          />
        </Field>
        <Field label="Team # (optioneel)">
          <input
            inputMode="numeric"
            value={teamNumber}
            onChange={(e) => setTeamNumber(e.target.value)}
            placeholder="bijv. 1"
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
          >
            <option value="active">Actief</option>
            <option value="inactive">Inactief</option>
          </select>
        </Field>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl px-3 py-2 text-sm bg-black text-white hover:bg-gray-800 disabled:opacity-60"
        >
          {busy ? "Bezig…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-gray-700 mb-1">{label}</div>
      {children}
    </label>
  );
}
