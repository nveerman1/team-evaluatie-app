export default function StudentProjectOverviewPage() {
  return (
    <main className="min-h-screen bg-slate-100/80 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-10 pt-8">
        {/* Header */}
        <header className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Projectoverzicht
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Overzicht van jouw projectbeoordelingen, cijfers en ontwikkeling.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/5 px-3 py-1">
              <span
                className="inline-block h-2 w-2 rounded-full bg-emerald-500"
                aria-hidden="true"
              ></span>
              Live gekoppeld aan jouw projecten
            </span>
          </div>
        </header>

        {/* Back to dashboard */}
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 p-3 shadow-sm ring-1 ring-slate-200/80">
          <div className="flex flex-col text-xs text-slate-600 sm:flex-row sm:items-center sm:gap-2">
            <span className="font-medium text-slate-800">Tip</span>
            <span>
              Gebruik deze pagina om je ontwikkeling over meerdere projecten te volgen.
            </span>
          </div>
          <a
            href="/student"
            className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            Terug naar dashboard
          </a>
        </div>

        {/* KPI tiles */}
        <section className="grid gap-4 md:grid-cols-4">
          <button className="group flex flex-col justify-between rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Gemiddeld projectcijfer
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Nieuw
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-3xl font-semibold text-slate-900">7,8</span>
              <span className="text-xs text-slate-500">/ 10</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Gebaseerd op al je afgeronde projectbeoordelingen.
            </p>
          </button>

          <button className="group flex flex-col justify-between rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Afgeronde projecten
            </span>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-3xl font-semibold text-slate-900">6</span>
              <span className="text-[11px] text-slate-500">totaal</span>
            </div>
            <p className="mt-2 text-[11px] text-emerald-600">
              +2 projecten t.o.v. vorige periode.
            </p>
          </button>

          <button className="group flex flex-col justify-between rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Sterkste categorieën
            </span>
            <div className="mt-3 space-y-1 text-[11px] text-slate-600">
              <p>
                <span
                  className="inline-block h-2 w-2 rounded-full bg-sky-500"
                  aria-hidden="true"
                ></span>{" "}
                Proces • 4,2/5
              </p>
              <p>
                <span
                  className="inline-block h-2 w-2 rounded-full bg-violet-500"
                  aria-hidden="true"
                ></span>{" "}
                Communicatie • 4,0/5
              </p>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Gebaseerd op rubric-scores.
            </p>
          </button>

          <button className="group flex flex-col justify-between rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Focus voor volgende project
            </span>
            <p className="mt-3 text-[11px] text-slate-600">
              Meer aandacht voor planning & tijdsplanning. Bekijk tips in je
              feedback.
            </p>
            <span className="mt-3 inline-flex w-fit items-center rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-white group-hover:bg-slate-800">
              Bekijk adviezen
            </span>
          </button>
        </section>

        {/* Charts */}
        <section className="grid gap-4 lg:grid-cols-5">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:col-span-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Cijfers per project</h2>
              <span className="text-[11px] text-slate-500">Lijngrafiek • klikbaar</span>
            </div>
            <div className="mt-3 flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-xs text-slate-400">
              Line chart placeholder
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Sterktes en ontwikkelpunten
              </h2>
              <span className="text-[11px] text-slate-500">Radar grafiek</span>
            </div>
            <div className="mt-3 flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-xs text-slate-400">
              Radar chart placeholder
            </div>
          </div>
        </section>

        {/* AI summary */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Samenvatting van jouw projectontwikkeling
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  AI maakt op basis van meerdere projectbeoordelingen een kort
                  overzicht van je sterktes en groeikansen.
                </p>
              </div>
              <button className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-white hover:bg-slate-800">
                Vernieuw samenvatting
              </button>
            </div>
            <div className="mt-3 grid gap-3 text-xs text-slate-600 md:grid-cols-3">
              <div className="rounded-xl bg-emerald-50/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  Sterke punten
                </p>
                <ul className="mt-2 space-y-1 list-disc pl-4">
                  <li>Consistente kwaliteit in eindproducten.</li>
                  <li>Duidelijke presentaties voor opdrachtgever.</li>
                </ul>
              </div>
              <div className="rounded-xl bg-amber-50/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                  Ontwikkelpunten
                </p>
                <ul className="mt-2 space-y-1 list-disc pl-4">
                  <li>Planning en taakverdeling concreter maken.</li>
                  <li>Reflecties uitbreiden met voorbeelden.</li>
                </ul>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                  Volgende stap
                </p>
                <ul className="mt-2 space-y-1 list-disc pl-4">
                  <li>Kies 1 categorie om bewust op te focussen.</li>
                  <li>Bespreek je doelen met je docent of coach.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Mini legend */}
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Legenda rubriccategorieën
            </h2>
            <ul className="mt-3 space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full bg-sky-500"
                  aria-hidden="true"
                ></span>
                Projectproces
              </li>
              <li className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full bg-violet-500"
                  aria-hidden="true"
                ></span>
                Eindresultaat
              </li>
              <li className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full bg-emerald-500"
                  aria-hidden="true"
                ></span>
                Communicatie
              </li>
              <li className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full bg-amber-500"
                  aria-hidden="true"
                ></span>
                Samenwerking
              </li>
            </ul>
            <p className="mt-3 text-[11px] text-slate-500">
              De kleuren sluiten aan bij de grafieken op deze pagina en bij
              de projectrubric.
            </p>
          </div>
        </section>

        {/* Table */}
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Alle projectbeoordelingen
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Vergelijk je projecten en open details per beoordeling.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700">
                <option>Sorteren op nieuwste</option>
                <option>Sorteren op oudste</option>
                <option>Sorteren op hoogste cijfer</option>
                <option>Sorteren op laagste cijfer</option>
              </select>
              <button className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100">
                Exporteren als PDF
              </button>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">Project</th>
                  <th className="px-3 py-2 font-medium">Opdrachtgever</th>
                  <th className="px-3 py-2 font-medium">Periode</th>
                  <th className="px-3 py-2 font-medium">Eindcijfer</th>
                  <th className="px-3 py-2 font-medium">Proces</th>
                  <th className="px-3 py-2 font-medium">Eindresultaat</th>
                  <th className="px-3 py-2 font-medium">Communicatie</th>
                  <th className="px-3 py-2 font-medium text-right">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[1, 2, 3].map((row) => (
                  <tr key={row} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-slate-900">
                          Tussenreview sprint {row}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          V2A • Ontwerp & Onderzoek
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-slate-600">
                      Gemeente Rotterdam
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-slate-600">
                      Najaar 2025
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        8,0
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-slate-600">
                      4,0 / 5
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-slate-600">
                      4,2 / 5
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-slate-600">
                      3,8 / 5
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <button className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-white hover:bg-slate-800">
                        Bekijk details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
