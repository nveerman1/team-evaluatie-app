"use client";
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import {
  MyAllocation,
  Criterion,
  ScoreItem,
  DashboardResponse,
} from "@/lib/types";
import { useParams, useSearchParams, useRouter } from "next/navigation";

export default function StudentWizard() {
  const { evaluationId } = useParams<{ evaluationId: string }>();
  const sp = useSearchParams();
  const step = Number(sp.get("step") ?? 1);
  const router = useRouter();
  const [allocs, setAllocs] = useState<MyAllocation[]>([]);
  const [criteria, setCriteria] = useState<Record<number, Criterion>>({});
  const [rubricId, setRubricId] = useState<number | undefined>();
  const [sending, setSending] = useState(false);

  // stap 3 data: ontvangen feedback (peer-avg uit dashboard)
  const [dash, setDash] = useState<DashboardResponse | undefined>();

  useEffect(() => {
    api
      .get<
        MyAllocation[]
      >(`/allocations/my`, { params: { evaluation_id: evaluationId } })
      .then(async (r) => {
        setAllocs(r.data || []);
        const rid = r.data?.[0]?.rubric_id;
        setRubricId(rid);
        if (rid) {
          const res = await api.get<Criterion[]>(`/rubrics/${rid}/criteria`);
          const map: Record<number, Criterion> = {};
          res.data.forEach((c) => {
            map[c.id] = c;
          });
          setCriteria(map);
        }
      });
  }, [evaluationId]);

  useEffect(() => {
    if (step === 3) {
      api
        .get<DashboardResponse>(`/dashboard/evaluation/${evaluationId}`, {
          params: { include_breakdown: true },
        })
        .then((r) => setDash(r.data));
    }
  }, [evaluationId, step]);

  const selfAlloc = useMemo(() => allocs.find((a) => a.is_self), [allocs]);
  const peerAllocs = useMemo(() => allocs.filter((a) => !a.is_self), [allocs]);

  async function submitScores(allocationId: number, items: ScoreItem[]) {
    setSending(true);
    try {
      await api.post("/scores", { allocation_id: allocationId, items });
      alert("Ingeleverd ✔");
    } finally {
      setSending(false);
    }
  }

  function goStep(n: number) {
    router.replace(`/student/${evaluationId}?step=${n}`);
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
              className={`px-3 py-1 rounded-lg border ${step === n ? "bg-black text-white" : "bg-white"}`}
            >
              Stap {n}
            </button>
          ))}
        </nav>
      </header>

      {step === 1 && selfAlloc && (
        <SectionScore
          title="Stap 1 — Zelfbeoordeling"
          allocationId={selfAlloc.allocation_id}
          criteria={selfAlloc.criterion_ids
            .map((id) => criteria[id])
            .filter(Boolean)}
          onSubmit={submitScores}
          sending={sending}
        />
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Stap 2 — Peer-reviews</h2>
          {peerAllocs.length === 0 && <p>Geen peers toegewezen.</p>}
          {peerAllocs.map((a) => (
            <SectionScore
              key={a.allocation_id}
              title={`Beoordeel ${a.reviewee_name}`}
              allocationId={a.allocation_id}
              criteria={a.criterion_ids
                .map((id) => criteria[id])
                .filter(Boolean)}
              onSubmit={submitScores}
              sending={sending}
            />
          ))}
        </div>
      )}

      {step === 3 && dash && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">
            Stap 3 — Overzicht ontvangen feedback
          </h2>
          <p className="text-sm text-gray-600">
            Samenvatting uit dashboard (peer-gemiddeld, self, SPR/GCF).
          </p>
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
        </div>
      )}

      {step === 4 && <Reflection />}
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
        className="px-4 py-2 rounded-xl bg-black text-white"
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

function Reflection() {
  return (
    <section className="p-4 border rounded-xl space-y-3">
      <h2 className="text-xl font-semibold">Stap 4 — Reflectie</h2>
      <p className="text-sm text-gray-600">
        MVP: lokale notities (bewaren in backend kan later).
      </p>
      <textarea
        className="w-full border rounded p-2 min-h-[140px]"
        placeholder="Wat ga je behouden/verbeteren?"
      ></textarea>
      <button className="px-4 py-2 rounded-xl bg-black text-white">
        Opslaan (lokaal)
      </button>
    </section>
  );
}
