// src/components/admin/students/AdminStudentForm.tsx
"use client";

import { useCallback, useMemo, useState } from "react";

type Status = "active" | "inactive";

export type AdminStudentFormPayload = {
  name: string;
  email: string;
  class_name?: string | null;
  course_name?: string | null;
  team_number?: number | null;
  status: Status;
};

export default function AdminStudentForm({
  initial,
  submitLabel = "Opslaan",
  onSubmit,
}: {
  initial?: Partial<AdminStudentFormPayload>;
  submitLabel?: string;
  onSubmit: (payload: AdminStudentFormPayload) => Promise<void> | void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    class_name: initial?.class_name ?? "",
    course_name: initial?.course_name ?? "",
    team_number:
      typeof initial?.team_number === "number" &&
      !Number.isNaN(initial.team_number)
        ? String(initial.team_number)
        : "",
    status: (initial?.status as Status) ?? "active",
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return form.name.trim() !== "" && /\S+@\S+\.\S+/.test(form.email);
  }, [form.name, form.email]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit || busy) return;

      setBusy(true);
      setError(null);
      try {
        const payload: AdminStudentFormPayload = {
          name: form.name.trim(),
          email: form.email.trim(),
          class_name: form.class_name.trim() || null,
          course_name: form.course_name.trim() || null,
          team_number:
            form.team_number.trim() === "" ? null : Number(form.team_number),
          status: form.status,
        };
        await onSubmit(payload);
      } catch (err: any) {
        setError(
          err?.response?.data?.detail || err?.message || "Opslaan mislukt",
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, canSubmit, form, onSubmit],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl mx-auto bg-white border rounded-2xl p-6 space-y-5 shadow-sm"
    >
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Grid layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextInput
          label="Naam"
          name="name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
        <TextInput
          label="Email"
          type="email"
          name="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          required
        />

        <TextInput
          label="Vak/Course"
          name="course_name"
          placeholder="Bijv. GA2"
          value={form.course_name}
          onChange={(e) =>
            setForm((f) => ({ ...f, course_name: e.target.value }))
          }
        />

        <TextInput
          label="Klas"
          name="class_name"
          placeholder="Bijv. V2A"
          value={form.class_name}
          onChange={(e) =>
            setForm((f) => ({ ...f, class_name: e.target.value }))
          }
        />

        <TextInput
          label="Team #"
          name="team_number"
          inputMode="numeric"
          placeholder="Bijv. 1"
          value={form.team_number}
          onChange={(e) =>
            setForm((f) => ({ ...f, team_number: e.target.value }))
          }
        />

        <Select
          label="Status"
          name="status"
          value={form.status}
          onChange={(e) =>
            setForm((f) => ({ ...f, status: e.target.value as Status }))
          }
        >
          <option value="active">Actief</option>
          <option value="inactive">Inactief</option>
        </Select>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" variant="primary" disabled={!canSubmit || busy}>
          {busy ? "Opslaan…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/* ---------- UI helpers ---------- */

function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string },
) {
  const { label, className, ...rest } = props;
  return (
    <label className={`block ${className ?? ""}`}>
      {label && (
        <div className="text-xs font-semibold text-gray-700 mb-1">{label}</div>
      )}
      <input
        {...rest}
        className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
      />
    </label>
  );
}

function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string },
) {
  const { label, className, children, ...rest } = props;
  return (
    <label className={`block ${className ?? ""}`}>
      {label && (
        <div className="text-xs font-semibold text-gray-700 mb-1">{label}</div>
      )}
      <select
        {...rest}
        className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
      >
        {children}
      </select>
    </label>
  );
}

function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "outline" | "danger" | "ghost";
  },
) {
  const { variant = "outline", className, children, ...rest } = props;
  const base = "rounded-xl px-4 py-2 text-sm font-medium transition";
  const style =
    variant === "primary"
      ? "bg-black text-white hover:bg-gray-800"
      : variant === "danger"
        ? "border border-red-300 text-red-600 hover:bg-red-50"
        : variant === "ghost"
          ? "hover:bg-gray-100"
          : "border hover:bg-gray-50";
  return (
    <button {...rest} className={`${base} ${style} ${className ?? ""}`}>
      {children}
    </button>
  );
}
