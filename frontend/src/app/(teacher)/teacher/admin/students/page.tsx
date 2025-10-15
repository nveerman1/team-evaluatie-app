"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Types in sync with backend */
type Student = {
  id: number;
  name: string;
  email: string;
  class_name?: string | null;
  team_id?: number | null;
  team_name?: string | null;
  team_number?: number | null;
  cluster_id?: number | null;
  cluster_name?: string | null;
  status: "active" | "inactive" | string;
};

function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "ghost" | "danger" | "outline";
  },
) {
  const { className = "", variant = "outline", ...rest } = props;
  const styles: Record<string, string> = {
    primary: "bg-black text-white hover:opacity-90",
    ghost: "bg-transparent hover:bg-gray-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
    outline: "border hover:bg-gray-50",
  };
  return (
    <button
      {...rest}
      className={`px-3 py-2 rounded-xl text-sm ${styles[variant]} ${className}`}
    />
  );
}

function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    hint?: string;
  },
) {
  const { label, hint, className = "", ...rest } = props;
  return (
    <label className="block space-y-1">
      {label && <span className="text-sm font-medium">{label}</span>}
      <input
        {...rest}
        className={`w-full px-3 py-2 border rounded-lg ${className}`}
      />
      {hint && <span className="text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    label?: string;
    hint?: string;
  },
) {
  const { label, hint, className = "", children, ...rest } = props;
  return (
    <label className="block space-y-1">
      {label && <span className="text-sm font-medium">{label}</span>}
      <select
        {...rest}
        className={`w-full px-3 py-2 border rounded-lg ${className}`}
      >
        {children}
      </select>
      {hint && <span className="text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

/** URL state helper */
function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const q = sp.get("q") ?? "";
  const klassOrCluster = sp.get("klass_or_cluster") ?? ""; // ← één veld
  const status = sp.get("status") ?? "active"; // standaard alleen actieve leerlingen
  const page = Number(sp.get("page") ?? 1);
  const limit = Number(sp.get("limit") ?? 25);

  function setParams(next: Record<string, string | number | undefined | null>) {
    const params = new URLSearchParams(sp.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") params.delete(k);
      else params.set(k, String(v));
    });
    router.replace(`${pathname}?${params.toString()}`);
  }

  return { q, klassOrCluster, status, page, limit, setParams };
}

/** CSV import dialog */
function ImportCsvDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [allowUpdate, setAllowUpdate] = useState(true);
  const [dryRun, setDryRun] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("allow_update", String(allowUpdate));
      fd.append("dry_run", String(dryRun));
      const resp = await api.post("/students/import.csv", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (dryRun) {
        alert(`Dry-run voltooid:\n${JSON.stringify(resp.data, null, 2)}`);
      } else {
        onImported();
        onClose();
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Import mislukt");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
      <form
        onSubmit={handleImport}
        className="w-full max-w-lg bg-white rounded-2xl border p-5 space-y-4 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Importeer CSV</h3>
          <button type="button" className="text-gray-500" onClick={onClose}>
            ✕
          </button>
        </div>
        {error && (
          <div className="p-2 rounded bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}
        <div className="space-y-2">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allowUpdate}
              onChange={(e) => setAllowUpdate(e.target.checked)}
            />
            Bestaanden bijwerken
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            Dry-run (geen writes)
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={!file || saving}>
            {saving ? "Bezig…" : dryRun ? "Dry-run" : "Importeer"}
          </Button>
          <Button type="button" onClick={onClose}>
            Annuleer
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Add/Edit dialog — vrije velden Cluster + Teamnummer */
function StudentDialog({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Partial<Student>;
  onSaved: (saved: Student) => void;
}) {
  const isEdit = Boolean(initial?.id);
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [className, setClassName] = useState(initial?.class_name ?? "");
  const [active, setActive] = useState(initial?.status !== "inactive");

  const [clusterName, setClusterName] = useState<string>(
    initial?.cluster_name ?? "",
  );
  const [teamNumber, setTeamNumber] = useState<string>(
    initial?.team_number != null ? String(initial.team_number) : "",
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setEmail(initial?.email ?? "");
    setClassName(initial?.class_name ?? "");
    setActive(initial?.status !== "inactive");
    setClusterName(initial?.cluster_name ?? "");
    setTeamNumber(
      initial?.team_number != null ? String(initial.team_number) : "",
    );
    setError(null);
  }, [open, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        name,
        email,
        class_name: className || null,
        active,
        cluster_name: clusterName || null,
        team_number: teamNumber === "" ? null : Number(teamNumber),
      };
      let resp;
      if (isEdit && initial?.id) {
        resp = await api.put(`/students/${initial.id}`, payload);
      } else {
        resp = await api.post("/students", payload);
      }
      onSaved(resp.data as Student);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl bg-white rounded-2xl border p-5 space-y-4 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {isEdit ? "Leerling bewerken" : "Nieuwe leerling"}
          </h3>
          <button type="button" className="text-gray-500" onClick={onClose}>
            ✕
          </button>
        </div>

        {error && (
          <div className="p-2 rounded-lg bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextInput
            label="Naam"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <TextInput
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextInput
            label="Klas"
            value={className ?? ""}
            onChange={(e) => setClassName(e.target.value)}
          />

          <TextInput
            label="Cluster"
            value={clusterName}
            onChange={(e) => setClusterName(e.target.value)}
            placeholder="bijv. GA2"
          />
          <TextInput
            label="Teamnummer"
            inputMode="numeric"
            value={teamNumber}
            onChange={(e) => setTeamNumber(e.target.value)}
            placeholder="bijv. 1"
          />

          <label className="inline-flex items-center gap-2 text-sm mt-2">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Actief
          </label>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Opslaan…" : "Opslaan"}
          </Button>
          <Button type="button" onClick={onClose}>
            Annuleer
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function StudentsAdminPage() {
  const { q, klassOrCluster, status, page, limit, setParams } = useUrlState();
  const [rows, setRows] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Student | undefined>(undefined);
  const [importOpen, setImportOpen] = useState(false);

  // Fetch list
  useEffect(() => {
    const params: any = { q, page, limit };
    if (klassOrCluster) params.klass_or_cluster = klassOrCluster;
    if (status) params.status = status;

    setLoading(true);
    setError(null);
    api
      .get<Student[]>("/students", { params })
      .then((r) => setRows(r.data ?? []))
      .catch((e) =>
        setError(e?.response?.data?.detail || e?.message || "Laden mislukt"),
      )
      .finally(() => setLoading(false));
  }, [q, klassOrCluster, status, page, limit]);

  function openCreate() {
    setEditItem(undefined);
    setDialogOpen(true);
  }
  function openEdit(s: Student) {
    setEditItem(s);
    setDialogOpen(true);
  }

  async function removeStudent(id: number) {
    if (!confirm("Weet je zeker dat je deze leerling wilt archiveren?")) return;
    try {
      await api.delete(`/students/${id}`);
      setRows((all) => all.filter((s) => s.id !== id));
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.message);
    }
  }

  async function exportCsv() {
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (klassOrCluster) params.set("klass_or_cluster", klassOrCluster); // ← i.p.v. class_name
      if (status) params.set("status", status);
      const resp = await api.get(`/students/export.csv?${params.toString()}`, {
        responseType: "blob",
      });
      const blob = new Blob([resp.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "students_export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.message || "Export mislukt");
    }
  }

  // Inline team-nummer wijziging
  async function saveInlineTeamNumber(
    id: number,
    nextTeamNumber: number | null,
  ) {
    try {
      const payload: any = { team_number: nextTeamNumber };
      const resp = await api.put(`/students/${id}`, payload);
      setRows((all) =>
        all.map((s) => (s.id === id ? (resp.data as Student) : s)),
      );
    } catch (e: any) {
      alert(
        e?.response?.data?.detail ||
          e?.message ||
          "Teamnummer wijzigen mislukt",
      );
    }
  }

  const pagination = (
    <div className="flex items-center gap-2">
      <Button
        onClick={() => setParams({ page: Math.max(1, page - 1) })}
        disabled={page <= 1}
      >
        Vorige
      </Button>
      <span className="text-sm text-gray-600">Pagina {page}</span>
      <Button onClick={() => setParams({ page: page + 1 })}>Volgende</Button>
      <Select
        value={String(limit)}
        onChange={(e) => setParams({ limit: Number(e.target.value), page: 1 })}
      >
        {[10, 25, 50, 100].map((n) => (
          <option key={n} value={n}>
            {n}/pagina
          </option>
        ))}
      </Select>
    </div>
  );

  const empty = !loading && !error && rows.length === 0;

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Leerlingen</h1>
          <p className="text-gray-600">
            Beheer leerlingen, klas, cluster en team. Import/Export als CSV.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={exportCsv}>Export CSV</Button>
          <Button onClick={() => setImportOpen(true)}>Import CSV</Button>
          <Button variant="primary" onClick={openCreate}>
            + Nieuwe leerling
          </Button>
        </div>
      </header>

      {/* Toolbar */}
      <section className="bg-white p-4 border rounded-2xl flex flex-wrap items-end gap-3">
        <div className="w-64">
          <TextInput
            label="Zoeken"
            placeholder="Naam of e-mail…"
            defaultValue={q}
            onChange={(e) => setParams({ q: e.target.value, page: 1 })}
          />
        </div>
        <div className="w-48">
          <TextInput
            label="Klas/Cluster"
            placeholder="Bijv. A2a of GA2"
            defaultValue={klassOrCluster}
            onChange={(e) =>
              setParams({ klass_or_cluster: e.target.value, page: 1 })
            }
          />
        </div>
        <div className="w-48">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setParams({ status: e.target.value, page: 1 })}
          >
            <option value="">Alle</option>
            <option value="active">Actief</option>
            <option value="inactive">Inactief</option>
          </Select>
        </div>
        <div className="ml-auto">{pagination}</div>
      </section>

      {/* Table */}
      <section className="bg-white border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1.2fr_1.6fr_0.7fr_0.9fr_0.6fr_0.6fr_0.9fr] gap-0 px-4 py-3 bg-gray-50 text-sm font-medium text-gray-600">
          <div>Naam</div>
          <div>E-mail</div>
          <div>Klas</div>
          <div>Cluster</div>
          <div>Team #</div>
          <div>Status</div>
          <div className="text-right pr-2">Acties</div>
        </div>

        {loading && <div className="p-6 text-gray-500">Laden…</div>}
        {error && !loading && (
          <div className="p-6 text-red-600">Fout: {error}</div>
        )}
        {empty && (
          <div className="p-6 text-gray-500">Geen leerlingen gevonden.</div>
        )}

        {!loading &&
          !error &&
          rows.map((s) => (
            <div
              key={s.id}
              className="grid grid-cols-[1.2fr_1.6fr_0.7fr_0.9fr_0.6fr_0.6fr_0.9fr] items-center gap-0 px-4 py-3 border-t text-sm"
            >
              <div className="truncate" title={s.name}>
                {s.name}
              </div>
              <div className="truncate" title={s.email}>
                {s.email}
              </div>
              <div className="truncate" title={s.class_name ?? "—"}>
                {s.class_name ?? "—"}
              </div>
              <div
                className="truncate"
                title={
                  s.cluster_name ??
                  (s.cluster_id != null ? `Course ${s.cluster_id}` : "—")
                }
              >
                {s.cluster_name ??
                  (s.cluster_id != null ? `Course ${s.cluster_id}` : "—")}
              </div>
              <div className="truncate">
                <input
                  className="w-20 px-2 py-1 border rounded-lg"
                  inputMode="numeric"
                  defaultValue={s.team_number ?? ""}
                  placeholder="—"
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    const next = val === "" ? null : Number(val);
                    if (val === "" || Number.isFinite(next)) {
                      if ((next ?? null) !== (s.team_number ?? null)) {
                        saveInlineTeamNumber(s.id, next as number | null);
                      }
                    } else {
                      e.currentTarget.value =
                        s.team_number != null ? String(s.team_number) : "";
                      alert("Teamnummer moet een getal zijn");
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") {
                      (e.target as HTMLInputElement).value =
                        s.team_number != null ? String(s.team_number) : "";
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  title="Wijzig teamnummer snel; leeg laten om team te verwijderen"
                />
              </div>
              <div>
                {s.status === "inactive" ? (
                  <span className="px-2 py-1 rounded-lg text-xs bg-gray-100 text-gray-600 ring-1 ring-gray-200">
                    inactief
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-lg text-xs bg-green-50 text-green-700 ring-1 ring-green-200">
                    actief
                  </span>
                )}
              </div>
              <div className="flex justify-end gap-2 pr-2">
                <Button onClick={() => openEdit(s)}>Bewerk</Button>
                <Button variant="danger" onClick={() => removeStudent(s.id)}>
                  Verwijder
                </Button>
              </div>
            </div>
          ))}
      </section>

      {/* Bottom pagination */}
      <div className="flex justify-end">{pagination}</div>

      <StudentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initial={editItem}
        onSaved={(saved) => {
          setRows((all) => {
            const idx = all.findIndex((x) => x.id === saved.id);
            if (idx >= 0) {
              const copy = [...all];
              copy[idx] = saved;
              return copy;
            }
            return [saved, ...all];
          });
        }}
      />

      <ImportCsvDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          const params: any = { q, page, limit };
          if (klassOrCluster) params.klass_or_cluster = klassOrCluster;
          if (status) params.status = status;
          api
            .get<Student[]>("/students", { params })
            .then((r) => setRows(r.data ?? []));
        }}
      />
    </main>
  );
}
