"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { createPortal } from "react-dom";

type Student = {
  id: number;
  name: string;
  email: string;
  class_name?: string | null;
  course_name?: string | null; // <— nieuw, vervangt cluster
  status?: "active" | "inactive" | null;
  team_number?: number | null;
};

export default function StudentsAdminInner() {
  const [rows, setRows] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<
    "name" | "class_name" | "course_name" | "team_number"
  >("name");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [edit, setEdit] = useState<Student | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, limit, sort, dir };
      if (q) params.q = q;
      params.status_filter = status;

      const r = await api.get("/admin/students", { params });
      const data = Array.isArray(r.data) ? r.data : (r.data.items ?? []);
      setRows(data);
      // probeer X-Total-Count header, val terug op lengte
      const headerTotal = Number(r.headers?.["x-total-count"]);
      setTotal(
        Number.isFinite(headerTotal)
          ? headerTotal
          : Array.isArray(r.data)
            ? r.data.length
            : (r.data.total ?? data.length),
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, limit, q, status, sort, dir]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const toggleSort = (col: typeof sort) => {
    if (sort === col) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(col);
      setDir("asc");
    }
    setPage(1);
  };

  const pageCount = Math.max(1, Math.ceil(total / limit));
  const canPrev = page > 1;
  const canNext = page < pageCount;

  const updateRowLocal = useCallback((id: number, patch: Partial<Student>) => {
    setRows((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  // CSV export
  const onExport = useCallback(async () => {
    try {
      const params: Record<string, any> = { sort, dir };
      if (q) params.q = q;
      if (status) params.status = status;

      const r = await api.get("/admin/students/export.csv", {
        params,
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "students.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.message || "Export mislukt");
    }
  }, [dir, q, sort, status]);

  // CSV import
  const onImport = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setImportBusy(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        await api.post("/admin/students/import.csv", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        await fetchRows();
        alert("CSV geïmporteerd.");
      } catch (e: any) {
        alert(e?.response?.data?.detail || e?.message || "Import mislukt");
      } finally {
        setImportBusy(false);
      }
    },
    [fetchRows],
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin • Leerlingen</h1>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onImport(e.target.files?.[0] ?? null)}
              disabled={importBusy}
            />
            <Button as="span" aria-label="Importeer CSV" disabled={importBusy}>
              {importBusy ? "Importeren…" : "Importeer CSV"}
            </Button>
          </label>
          <Button onClick={onExport}>Exporteer CSV</Button>
          <Link href="/teacher/admin/students/create">
            <Button variant="primary">+ Nieuwe leerling</Button>
          </Link>
        </div>
      </div>

      {/* Filterbalk */}
      <div className="flex flex-wrap items-end gap-3 bg-white border rounded-2xl p-3">
        <TextInput
          label="Zoek (naam/email/klas/course)"
          value={q}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setPage(1);
            setQ(e.target.value);
          }}
          className="w-80"
        />
        <Select
          label="Status"
          value={status}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="w-40"
        >
          <option value="active">Actief</option>
          <option value="inactive">Inactief</option>
          <option value="">Alle</option>
        </Select>
      </div>

      {/* Tabel */}
      <div className="overflow-hidden border rounded-2xl bg-white">
        <table className="w-full table-auto border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <SortableTh
                label="Naam"
                col="name"
                sort={sort}
                dir={dir}
                onClick={toggleSort}
                className="w-[18%]"
              />
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 w-[20%]">
                Email
              </th>
              <SortableTh
                label="Vak/Course"
                col="course_name"
                sort={sort}
                dir={dir}
                onClick={toggleSort}
                className="w-[12%]"
              />
              <SortableTh
                label="Klas"
                col="class_name"
                sort={sort}
                dir={dir}
                onClick={toggleSort}
                className="w-[10%]"
              />
              <SortableTh
                label="Team #"
                col="team_number"
                sort={sort}
                dir={dir}
                onClick={toggleSort}
                className="w-[8%]"
                center
              />
              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 w-[10%]">
                Status
              </th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 w-[18%]">
                Acties
              </th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {loading && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-sm text-gray-500 text-center"
                >
                  Laden…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-sm text-gray-500 text-center"
                >
                  Geen leerlingen gevonden.
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((s) => (
                <tr
                  key={s.id}
                  className="text-sm hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-2 truncate">{s.name || "-"}</td>
                  <td className="px-4 py-2 truncate">
                    <a href={`mailto:${s.email}`} className="hover:underline">
                      {s.email}
                    </a>
                  </td>
                  <td className="px-4 py-2 text-left">
                    {s.course_name || "-"}
                  </td>
                  <td className="px-4 py-2 text-left">{s.class_name || "-"}</td>

                  {/* Inline Team # edit */}
                  <td className="px-4 py-2 text-center">
                    <TeamNumberCell
                      value={s.team_number}
                      onChange={async (next) => {
                        const old = s.team_number ?? null;
                        updateRowLocal(s.id, { team_number: next }); // optimistic
                        try {
                          await api.put(`/admin/students/${s.id}`, {
                            team_number: next,
                          });
                        } catch (e: any) {
                          updateRowLocal(s.id, { team_number: old }); // rollback
                          alert(
                            e?.response?.data?.detail ||
                              e?.message ||
                              "Teamnummer opslaan mislukt",
                          );
                        }
                      }}
                    />
                  </td>

                  <td className="px-4 py-2 text-center">
                    {s.status === "inactive" ? "Inactief" : "Actief"}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex justify-center gap-3">
                      <Button onClick={() => setEdit(s)}>Bewerken</Button>
                      <DeleteStudentButton id={s.id} onDone={fetchRows} />
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Paginatie */}
      <div className="flex items-center justify-between text-sm">
        <div>
          Totaal: <b>{total}</b> • Pagina <b>{page}</b> / <b>{pageCount}</b>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!canPrev}
          >
            ← Vorige
          </Button>
          <Select
            value={String(limit)}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value="10">10 / p</option>
            <option value="25">25 / p</option>
            <option value="50">50 / p</option>
            <option value="100">100 / p</option>
          </Select>
          <Button
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={!canNext}
          >
            Volgende →
          </Button>
        </div>
      </div>

      {/* Edit-modal */}
      {edit && (
        <EditStudentModal
          student={edit}
          onClose={() => setEdit(null)}
          onSaved={async () => {
            await fetchRows(); // reload zodat Vak/Course direct zichtbaar is
          }}
        />
      )}
    </div>
  );
}

/* ---------- Components ---------- */

function SortableTh({
  label,
  col,
  sort,
  dir,
  onClick,
  className,
  center,
}: {
  label: string;
  col: any;
  sort: string;
  dir: string;
  onClick: (c: any) => void;
  className?: string;
  center?: boolean;
}) {
  const active = sort === col;
  const arrow = active ? (dir === "asc" ? "↑" : "↓") : "↕";
  return (
    <th
      className={`px-4 py-2 text-xs font-semibold text-gray-700 cursor-pointer select-none ${
        center ? "text-center" : "text-left"
      } ${className ?? ""}`}
      onClick={() => onClick(col)}
    >
      {label} <span className="opacity-60">{arrow}</span>
    </th>
  );
}

function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    as?: "button" | "span";
    variant?: "primary" | "outline" | "ghost" | "danger";
  },
) {
  const {
    variant = "outline",
    className,
    children,
    as = "button",
    ...rest
  } = props;
  const base = "rounded-xl px-3 py-1.5 text-sm transition";
  const style =
    variant === "primary"
      ? "bg-black text-white hover:bg-gray-800"
      : variant === "danger"
        ? "border border-red-300 text-red-600 hover:bg-red-50"
        : variant === "ghost"
          ? "hover:bg-gray-100"
          : "border hover:bg-gray-50";

  if (as === "span") {
    return (
      <span
        className={`${base} ${style} ${className ?? ""}`}
        {...(rest as any)}
      >
        {children}
      </span>
    );
  }
  return (
    <button {...rest} className={`${base} ${style} ${className ?? ""}`}>
      {children}
    </button>
  );
}

function TextInput(props: any) {
  const { label, className, ...rest } = props;
  return (
    <label className={`block ${className ?? ""}`}>
      {label && (
        <div className="text-xs font-medium text-gray-700 mb-1">{label}</div>
      )}
      <input
        {...rest}
        className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
      />
    </label>
  );
}

function Select(props: any) {
  const { label, className, children, ...rest } = props;
  return (
    <label className={`block ${className ?? ""}`}>
      {label && (
        <div className="text-xs font-medium text-gray-700 mb-1">{label}</div>
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

/* --- Inline Team # editor --- */
function TeamNumberCell({
  value,
  onChange,
}: {
  value: number | null | undefined;
  onChange: (next: number | null) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState<string>(value?.toString() ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) setLocal(value?.toString() ?? "");
  }, [value, editing]);

  const start = () => {
    if (busy) return;
    setEditing(true);
    setLocal(value?.toString() ?? "");
  };

  const commit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const trimmed = local.trim();
      const next = trimmed === "" ? null : Number(trimmed);
      if (trimmed !== "" && Number.isNaN(next)) {
        alert("Voer een geldig getal in, of laat leeg voor geen team.");
        return;
      }
      await onChange(next);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    if (busy) return;
    setEditing(false);
    setLocal(value?.toString() ?? "");
  };

  if (!editing) {
    return (
      <button
        className="inline-flex items-center justify-center w-full px-2 py-1 rounded-md hover:bg-gray-100"
        title="Klik om te bewerken"
        onClick={start}
      >
        {value ?? "-"}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={local}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") cancel();
      }}
      inputMode="numeric"
      className="w-16 mx-auto text-center rounded-md border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-gray-300"
      placeholder="-"
    />
  );
}

/* --- Delete + Modal --- */

function DeleteStudentButton({
  id,
  onDone,
}: {
  id: number;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const remove = useCallback(async () => {
    if (!confirm("Leerling verwijderen?")) return;
    setBusy(true);
    try {
      await api.delete(`/admin/students/${id}`);
      onDone();
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.message || "Verwijderen mislukt");
    } finally {
      setBusy(false);
    }
  }, [id, onDone]);
  return (
    <Button variant="danger" onClick={remove} disabled={busy}>
      {busy ? "..." : "Verwijderen"}
    </Button>
  );
}

function EditStudentModal({
  student,
  onClose,
  onSaved,
}: {
  student: Student;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(student.name ?? "");
  const [email, setEmail] = useState(student.email ?? "");
  const [className, setClassName] = useState(student.class_name ?? "");
  const [courseName, setCourseName] = useState(student.course_name ?? ""); // <— nieuw
  const [status, setStatus] = useState<"active" | "inactive">(
    student.status === "inactive" ? "inactive" : "active",
  );
  const [teamNumber, setTeamNumber] = useState<string>(
    student.team_number?.toString() ?? "",
  );
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await api.put(`/admin/students/${student.id}`, {
        name,
        email,
        class_name: className,
        course_name: courseName.trim() || null, // <— stuur course_name mee
        status,
        team_number: teamNumber.trim() === "" ? null : Number(teamNumber),
      });
      await onSaved(); // reload
      onClose();
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }, [
    className,
    courseName,
    email,
    name,
    onSaved,
    onClose,
    status,
    student.id,
    teamNumber,
  ]);

  const target = typeof window !== "undefined" ? document.body : null;
  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-xl w-[520px] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Leerling bewerken</h2>
          <Button variant="ghost" onClick={onClose}>
            Sluiten
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="Naam"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          />
          <TextInput
            label="Email"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          />
          <TextInput
            label="Vak/Course"
            value={courseName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCourseName(e.target.value)}
          />
          {/* vervangt Cluster */}
          <TextInput
            label="Klas"
            value={className}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClassName(e.target.value)}
          />
          <TextInput
            label="Team #"
            value={teamNumber}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTeamNumber(e.target.value)}
          />
          <Select
            label="Status"
            value={status}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatus(e.target.value as "active" | "inactive")}
          >
            <option value="active">Actief</option>
            <option value="inactive">Inactief</option>
          </Select>
        </div>
        <div className="flex justify-end">
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? "Opslaan…" : "Opslaan"}
          </Button>
        </div>
      </div>
    </div>
  );
  return target ? createPortal(modal, target) : modal;
}
