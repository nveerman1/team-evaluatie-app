"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import {
  MyAllocation,
  Criterion,
  ScoreItem,
  DashboardResponse,
} from "@/lib/types";
import { useSearchParams, useRouter } from "next/navigation";
import { useNumericEvalId } from "@/lib/id";

export default function StudentWizard() {
  const evaluationIdNum = useNumericEvalId(); // null op /create of ongeldige id
  const sp = useSearchParams();
  const step = Number(sp.get("step") ?? 1);
  const router = useRouter();

  const [allocs, setAllocs] = useState<MyAllocation[]>([]);
  const [criteria, setCriteria] = useState<Record<number, Criterion>>({});
  const [rubricId, setRubricId] = useState<number | undefined>();
  const [sending, setSending] = useState(false);

  // stap 3 data: ontvangen feedback (peer-avg uit dashboard)
  const [dash, setDash] = useState<DashboardResponse | undefined>();

  const [error, setError] = useState<string | null>(null);
  const [loadingAlloc, setLoadingAlloc] = useState(false);
  const [loadingDash, setLoadingDash] = useState(false);

  // Handige string weergave voor routes/headers:
  const evaluationId = evaluationIdNum != null ? String(evaluationIdNum) : "—";

  // ---- 1) Allocations + criteria ophalen (alleen bij geldig evalId) ----
  useEffect(() => {
    setError(null);

    if (evaluationIdNum == null) {
      setAllocs([]);
      setCriteria({});
      setRubricId(undefined);
      return;
    }

    setLoadingAlloc(true);
    api
      .get<MyAllocation[]>("/allocations/my", {
        params: { evaluation_id: evaluationIdNum },
      })
      .then(async (r) => {
        const data = Array.isArray(r.data) ? r.data : [];
        setAllocs(data);

        const rid = data?.[0]?.rubric_id;
        setRubricId(rid);

        if (rid) {
          try {
            const res = await api.get<Criterion[]>(`/rubrics/${rid}/criteria`);
            const map: Record<number, Criterion> = {};
            (res.data || []).forEach((c) => {
              if (c && typeof c.id === "number") map[c.id] = c;
            });
            setCriteria(map);
          } catch (e: any) {
            // criteria laden mag stille fout zijn (student kan nog steeds slider invullen)
          }
        } else {
          setCriteria({});
        }
      })
      .catch((e) => {
        setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
      })
      .finally(() => setLoadingAlloc(false));
  }, [evaluationIdNum]);

  // ---- 2) Dashboard-overzicht (stap 3) ----
  useEffect(() => {
    if (evaluationIdNum == null || step !== 3) {
      setDash(undefined);
      return;
    }
    setLoadingDash(true);
    api
      .get<DashboardResponse>(`/dashboard/evaluation/${evaluationIdNum}`, {
        params: { include_breakdown: true },
      })
      .then((r) => setDash(r.data))
      .catch(() => {
        // stil houden; student kan verder zonder overzicht
      })
      .finally(() => setLoadingDash(false));
  }, [evaluationIdNum, step]);

  const selfAlloc = useMemo(() => allocs.find((a) => a.is_self), [allocs]);
  const peerAllocs = useMemo(() => allocs.filter((a) => !a.is_self), [allocs]);

  async function submitScores(allocationId: number, items: ScoreItem[]) {
    setSending(true);
    try {
      await api.post("/scores", { allocation_id: allocationId, items });
      alert("Ingeleverd ✔");
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.message || "Inleveren mislukt");
    } finally {
      setSending(false);
    }
  }

  function goStep(n: number) {
    // Alleen navigeren als we een geldig id hebben (anders blijft het “—”)
    if (evaluationIdNum == null) return;
    router.replace(`/student/${evaluationIdNum}?step=${n}`);
  }

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">
          Wizard — Evaluatie #{evaluationId}
        </h1>
        <nav className="ml-auto flex gap-2">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => goStep(n)}
              className={`px-3 py-1 rounded-lg border ${
                step === n ? "bg-black text-white" : "bg-white"
              }`}
              disabled={evaluationIdNum == null}
              title={evaluationIdNum == null ? "Geen geldige evaluatie" : ""}
            >
              Stap {n}
            </button>
          ))}
        </nav>
      </header>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700">{error}</div>
      )}

      {/* Stap 1 — Zelfbeoordeling */}
      {step === 1 && (
        <>
          {loadingAlloc && <div className="text-gray-500">Laden…</div>}
          {!loadingAlloc && evaluationIdNum == null && (
            <div className="text-gray-500">
              Geen geldige evaluatie. Open deze wizard via een bestaande
              evaluatie.
            </div>
          )}
          {!loadingAlloc && evaluationIdNum != null && !selfAlloc && (
            <div className="text-gray-500">
              Geen zelfbeoordeling toegewezen.
            </div>
          )}
          {!loadingAlloc && evaluationIdNum != null && selfAlloc && (
            <SectionScore
              title="Stap 1 — Zelfbeoordeling"
              allocationId={selfAlloc.allocation_id}
              criteria={
                selfAlloc.criterion_ids
                  .map((id) => criteria[id])
                  .filter(Boolean) as Criterion[]
              }
              onSubmit={submitScores}
              sending={sending}
            />
          )}
        </>
      )}

      {/* Stap 2 — Peer-reviews */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Stap 2 — Peer-reviews</h2>

          {loadingAlloc && <div className="text-gray-500">Laden…</div>}
          {!loadingAlloc && peerAllocs.length === 0 && (
            <p>Geen peers toegewezen.</p>
          )}

          {/* Voortgang teller */}
          {!loadingAlloc && peerAllocs.length > 0 && (
            <div className="text-sm text-gray-700">
              Peer-voortgang:{" "}
              <strong>
                {peerAllocs.filter((p) => p.completed).length}/
                {peerAllocs.length}
              </strong>
            </div>
          )}

          {!loadingAlloc &&
            peerAllocs.map((a) => (
              <PeerPanel
                key={a.allocation_id}
                alloc={a}
                criteria={a.criterion_ids
                  .map((id) => criteria[id])
                  .filter(Boolean)}
                onSubmit={submitScores}
              />
            ))}
        </div>
      )}

      {/* Stap 3 — Overzicht ontvangen feedback */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">
            Stap 3 — Overzicht ontvangen feedback
          </h2>
          <p className="text-sm text-gray-600">
            Samenvatting uit dashboard (peer-gemiddeld, self, SPR/GCF).
          </p>

          {loadingDash && <div className="text-gray-500">Laden…</div>}

          {!loadingDash && dash && (
            <table className="w-full text-sm border rounded-xl overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Naam</th>
                  <th className="p-2">Peer-avg</th>
                  <th className="p-2">Self-avg</th>
                  <th className="p-2">SPR</th>
                  <th className="p-2">GCF</th>
                </tr>
              </thead>
              <tbody>
                {dash.items.map((r) => (
                  <tr key={r.user_id} className="border-t">
                    <td className="p-2">{r.user_name}</td>
                    <td className="p-2 text-center">
                      {r.peer_avg_overall.toFixed(2)}
                    </td>
                    <td className="p-2 text-center">
                      {r.self_avg_overall ?? "-"}
                    </td>
                    <td className="p-2 text-center">{r.spr.toFixed(2)}</td>
                    <td className="p-2 text-center">{r.gcf.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Stap 4 — Reflectie (nu mét backend opslaan) */}
      {step === 4 && <Reflection evaluationIdNum={evaluationIdNum} />}
    </main>
  );
}

function SectionScore({
  title,
  allocationId,
  criteria,
  onSubmit,
  sending,
}: {
  title: string;
  allocationId: number;
  criteria: Criterion[];
  sending: boolean;
  onSubmit: (allocationId: number, items: ScoreItem[]) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<number, number>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  function update(id: number, v: number) {
    setValues((s) => ({ ...s, [id]: v }));
  }
  function updateC(id: number, v: string) {
    setComments((s) => ({ ...s, [id]: v }));
  }
  return (
    <section className="p-4 border rounded-xl space-y-3">
      <h3 className="font-semibold">{title}</h3>
      {criteria.map((c) => (
        <div key={c.id} className="grid md:grid-cols-3 gap-2 items-center">
          <div className="font-medium">{c.name}</div>
          <input
            type="range"
            min={1}
            max={5}
            defaultValue={3}
            onChange={(e) => update(c.id, Number(e.target.value))}
          />
          <input
            className="border rounded px-2 py-1"
            placeholder="Opmerking (optioneel)"
            onChange={(e) => updateC(c.id, e.target.value)}
          />
        </div>
      ))}
      <button
        disabled={sending}
        className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
        onClick={() =>
          onSubmit(
            allocationId,
            criteria.map((c) => ({
              criterion_id: c.id,
              score: values[c.id] ?? 3,
              comment: comments[c.id] || "",
            })),
          )
        }
      >
        {sending ? "Bezig…" : "Inleveren"}
      </button>
    </section>
  );
}

/**
 * Reflectie-component is nu self-contained:
 * - Laadt eigen reflectie bij mount
 * - Opslaan (concept) en Indienen (submit=true) via backend
 */
function Reflection({ evaluationIdNum }: { evaluationIdNum: number | null }) {
  const [reflection, setReflection] = useState<string>("");
  const [refSaving, setRefSaving] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // Als geen geldig id, toon lege staat
  useEffect(() => {
    if (evaluationIdNum == null) return;
    api
      .get(`/evaluations/${evaluationIdNum}/reflections/me`)
      .then((r) => setReflection(r.data?.text || ""))
      .catch(() => {
        // stil houden
      });
  }, [evaluationIdNum]);

  async function saveReflection(submit = false) {
    if (evaluationIdNum == null) return;
    try {
      setRefSaving("saving");
      await api.post(`/evaluations/${evaluationIdNum}/reflections/me`, {
        text: reflection,
        submit,
      });
      setRefSaving("saved");
      setTimeout(() => setRefSaving("idle"), 1200);
    } catch (e) {
      setRefSaving("error");
    }
  }

  if (evaluationIdNum == null) {
    return (
      <section className="rounded-2xl border p-4 space-y-3">
        <h2 className="text-xl font-semibold">Stap 4 — Reflectie</h2>
        <p className="text-gray-500">
          Geen geldige evaluatie. Open deze wizard via een bestaande evaluatie.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Stap 4 — Reflectie</h2>
        <div className="text-sm opacity-70">
          {refSaving === "saving" && "Opslaan..."}
          {refSaving === "saved" && "Alles opgeslagen ✓"}
          {refSaving === "error" && "Fout bij opslaan"}
        </div>
      </div>
      <textarea
        className="w-full border rounded p-2 min-h-[140px]"
        placeholder="Wat ga je behouden/verbeteren?"
        value={reflection}
        onChange={(e) => setReflection(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          className="px-4 py-2 rounded-xl border"
          onClick={() => saveReflection(false)}
        >
          Opslaan (concept)
        </button>
        <button
          className="px-4 py-2 rounded-xl bg-black text-white"
          onClick={() => saveReflection(true)}
        >
          Indienen
        </button>
      </div>
    </section>
  );
}

function PeerPanel({
  alloc,
  criteria,
  onSubmit,
}: {
  alloc: MyAllocation;
  criteria: Criterion[];
  onSubmit: (allocationId: number, items: ScoreItem[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<number, number>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // 1) Init: zodra het paneel open gaat, zet default 3 voor alle criteria
  useEffect(() => {
    if (!open) return;
    const init: Record<number, number> = {};
    criteria.forEach((c) => {
      init[c.id] = 3;
    });
    // behoud bestaande (of later prefilled) waarden
    setValues((prev) => ({ ...init, ...prev }));
  }, [open, criteria]);

  // 2) Prefill: laad bestaande scores zodra open + allocation_id beschikbaar
  useEffect(() => {
    if (!open) return;
    if (!alloc?.allocation_id) return;

    setLoading(true);
    api
      .get<ScoreItem[]>("/scores/my", {
        params: { allocation_id: alloc.allocation_id },
      })
      .then((r) => {
        const mapV: Record<number, number> = {};
        const mapC: Record<number, string> = {};
        (r.data || []).forEach((it) => {
          mapV[it.criterion_id] = it.score;
          if (it.comment) mapC[it.criterion_id] = it.comment;
        });
        // overschrijf defaults met prefill
        setValues((s) => ({ ...s, ...mapV }));
        setComments((s) => ({ ...s, ...mapC }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, alloc?.allocation_id]);

  // 3) Validatie: beschouw default 3 als 'ingevuld'
  const allScored = criteria.every((c) => {
    const v = values[c.id] ?? 3;
    return v >= 1 && v <= 5;
  });

  async function handleSubmit() {
    try {
      setSending(true);
      await onSubmit(
        alloc.allocation_id,
        criteria.map((c) => ({
          criterion_id: c.id,
          score: values[c.id] ?? 3,
          comment: comments[c.id] || "",
        })),
      );
      // optimistic: markeer klaar
      alloc.completed = true;
    } finally {
      setSending(false);
    }
  }

  return (
    <details
      className="rounded-xl border p-3"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex items-center justify-between cursor-pointer">
        <span>Beoordeel {alloc.reviewee_name}</span>
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            alloc.completed
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {alloc.completed ? "Klaar" : "Nog open"}
        </span>
      </summary>

      {loading ? (
        <div className="text-gray-500 mt-3">Prefill laden…</div>
      ) : (
        <div className="mt-3 space-y-3">
          {criteria.map((c) => (
            <div key={c.id} className="grid md:grid-cols-3 gap-2 items-center">
              <div className="font-medium">{c.name}</div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={values[c.id] ?? 3}
                  onChange={(e) =>
                    setValues((s) => ({ ...s, [c.id]: Number(e.target.value) }))
                  }
                  aria-label={`Score ${c.name}`}
                />
                <span className="w-6 text-center">{values[c.id] ?? 3}</span>
              </div>
              <input
                className="border rounded px-2 py-1"
                placeholder="Opmerking (optioneel)"
                value={comments[c.id] || ""}
                onChange={(e) =>
                  setComments((s) => ({ ...s, [c.id]: e.target.value }))
                }
                aria-label={`Opmerking ${c.name}`}
              />
            </div>
          ))}

          <div className="flex justify-end">
            <button
              className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50"
              onClick={handleSubmit}
              disabled={!allScored || sending}
              title={!allScored ? "Scoor eerst alle criteria" : ""}
            >
              {sending ? "Bezig…" : "Inleveren"}
            </button>
          </div>
        </div>
      )}
    </details>
  );
}
