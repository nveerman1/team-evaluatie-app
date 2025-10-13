"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";

/** Types in sync with backend */
type Student = {
  id: number;
  name: string;
  email: string;
  class_name?: string | null;
  team_id?: number | null;
  team_name?: string | null; // aanwezig maar we tonen team_id
  status: "active" | "inactive" | string;
};

/** Small UI helpers */
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
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string },
) {
  const { label, className = "", children, ...rest } = props;
  return (
    <label className="block space-y-1">
      {label && <span className="text-sm font-medium">{label}</span>}
      <select
        {...rest}
        className={`w-full px-3 py-2 border rounded-lg ${className}`}
      >
        {children}
      </select>
    </label>
  );
}

/** URL state helper (let op: class_name) */
function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const q = sp.get("q") ?? "";
  const className = sp.get("class_name") ?? "";
  const status = sp.get("status") ?? ""; // active|inactive|""
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

  return { q, className, status, page, limit, setParams };
}

/** CSV import dialog */
function ImportCsvDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (added: number) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const [allowUpdate, setAllowUpdate] = useState(false);
  const [defaultClass, setDefaultClass] = useState("");
  const [defaultTeamId, setDefaultTeamId] = useState<string>("");
  const [activate, setActivate] = useState(true);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFile(null);
      setDryRun(false);
      setAllowUpdate(false);
      setDefaultClass("");
      setDefaultTeamId("");
      setActivate(true);
      setSaving(false);
      setReport(null);
      setError(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("dry_run", String(dryRun));
      fd.append("allow_update", String(allowUpdate));
      if (defaultClass) fd.append("default_class_name", defaultClass);
      if (defaultTeamId) fd.append("default_team_id", defaultTeamId);
      fd.append("activate", String(activate));

      const resp = await api.post("/students/import.csv", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setReport(resp.data);
      if (!dryRun) onImported(resp.data?.created_count ?? 0);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Import mislukt");
    } finally {
      setSaving(false);
    }
  }

  async function downloadTemplate() {
    const resp = await api.get("/students/template.csv", {
      responseType: "blob",
    });
    const blob = new Blob([resp.data], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students_template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-2xl bg-white rounded-2xl border p-5 space-y-4 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">CSV importeren</h3>
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
          <label className="block space-y-1">
            <span className="text-sm font-medium">CSV-bestand</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span className="text-xs text-gray-500">
              Kolommen: name,email,class,team_id,active
            </span>
          </label>
          <div className="flex items-end gap-2">
            <Button type="button" onClick={downloadTemplate}>
              Download template
            </Button>
          </div>

          <TextInput
            label="Standaard klas (optioneel)"
            value={defaultClass}
            onChange={(e) => setDefaultClass(e.target.value)}
          />
          <TextInput
            label="Standaard team_id (optioneel)"
            value={defaultTeamId}
            onChange={(e) => setDefaultTeamId(e.target.value)}
            inputMode="numeric"
          />
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            Proefimport (dry-run)
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allowUpdate}
              onChange={(e) => setAllowUpdate(e.target.checked)}
            />
            Bestaande e-mails bijwerken
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={activate}
              onChange={(e) => setActivate(e.target.checked)}
            />
            Activeren bij import
          </label>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={saving || !file}>
            {saving ? "Importeren…" : dryRun ? "Valideren" : "Importeren"}
          </Button>
          <Button type="button" onClick={onClose}>
            Sluiten
          </Button>
        </div>

        {report && (
          <div className="mt-2 border rounded-xl p-3 bg-gray-50 text-sm">
            <div className="font-medium mb-1">Resultaat</div>
            <div className="grid grid-cols-2 gap-2">
              <div>Gelezen: {report.total_rows}</div>
              <div>Toegevoegd: {report.created_count}</div>
              <div>Bijgewerkt: {report.updated_count}</div>
              <div>Overgeslagen: {report.skipped_count}</div>
              <div>Fouten: {report.error_count}</div>
            </div>
            {Array.isArray(report.rows) && report.rows.length > 0 && (
              <div className="mt-2 max-h-48 overflow-auto bg-white border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="text-left p-2">rij</th>
                      <th className="text-left p-2">email</th>
                      <th className="text-left p-2">status</th>
                      <th className="text-left p-2">opmerking</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r: any, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{r.row}</td>
                        <td className="p-2">{r.email}</td>
                        <td className="p-2">{r.status}</td>
                        <td className="p-2">{r.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

/** Add/Edit dialog */
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
  const [teamId, setTeamId] = useState<string>(
    initial?.team_id != null ? String(initial.team_id) : "",
  );
  const [active, setActive] = useState(initial?.status !== "inactive");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setEmail(initial?.email ?? "");
      setClassName(initial?.class_name ?? "");
      setTeamId(initial?.team_id != null ? String(initial.team_id) : "");
      setActive(initial?.status !== "inactive");
      setError(null);
    }
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
        team_id: teamId ? Number(teamId) : null,
        active,
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
        className="w-full max-w-lg bg-white rounded-2xl border p-5 space-y-4 shadow-xl"
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
            label="Team ID (optioneel)"
            inputMode="numeric"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
          />
        </div>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Actief
        </label>

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
  const { q, className, status, page, limit, setParams } = useUrlState();
  const [rows, setRows] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Student | undefined>(undefined);
  const [importOpen, setImportOpen] = useState(false);

  // Fetch list
  useEffect(() => {
    const params: any = { q, page, limit };
    if (className) params.class_name = className; // <— FIXED
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
  }, [q, className, status, page, limit]);

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
      if (className) params.set("class_name", className); // <— FIXED
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
            Beheer leerlingen, klas en team. Import/Export als CSV.
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
            label="Klas"
            placeholder="Bijv. 2V2"
            defaultValue={className}
            onChange={(e) => setParams({ class_name: e.target.value, page: 1 })}
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
        <div className="grid grid-cols-[1.2fr_1.6fr_0.7fr_0.6fr_0.6fr_0.8fr] gap-0 px-4 py-3 bg-gray-50 text-sm font-medium text-gray-600">
          <div>Naam</div>
          <div>E-mail</div>
          <div>Klas</div>
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
              className="grid grid-cols-[1.2fr_1.6fr_0.7fr_0.6fr_0.6fr_0.8fr] items-center gap-0 px-4 py-3 border-t text-sm"
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
                title={s.team_id ? String(s.team_id) : "—"}
              >
                {s.team_id ?? "—"}
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
          // herladen na import
          const params: any = { q, page, limit };
          if (className) params.class_name = className;
          if (status) params.status = status;
          api
            .get<Student[]>("/students", { params })
            .then((r) => setRows(r.data ?? []));
        }}
      />
    </main>
  );
}
