export function ProjectNotesCard() {
  return (
    <div className="space-y-4 md:space-y-5">
      {/* Groot notitiegebied */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Projectbrede aantekeningen
            </p>
            <p className="text-sm text-slate-600">
              Interne notities voor docenten over planning, materialen en contact met opdrachtgever.
            </p>
          </div>
          <button className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] hover:bg-slate-50">
            + Markeer als highlight
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            Tip: noteer praktische zaken zoals wijzigingen in planning, materiaalproblemen, afspraken met de opdrachtgever of aandachtspunten voor de volgende les.
          </div>
          <textarea
            className="mt-1 w-full min-h-[110px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/70"
            placeholder="Bijvoorbeeld: planning loopt achter door vertraagde materiaallevering; extra coachmoment inplannen met Team 2 en afspraak met opdrachtgever verplaatsen naar volgende week..."
          />
          <div className="flex justify-between items-center mt-1">
            <p className="text-[11px] text-slate-500">
              Alleen zichtbaar voor docenten; niet gedeeld met leerlingen.
            </p>
            <button className="rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
              Aantekening opslaan (dummy)
            </button>
          </div>
        </div>
      </div>

      {/* Dummy-lijst met eerdere projectnotities */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            Laatste projectnotities (dummy)
          </p>
          <button className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium">
            Alles bekijken
          </button>
        </div>
        <ul className="divide-y divide-slate-100">
          {[
            "Docentoverleg ingepland over extra feedbackronde in week 5.",
            "Materiaal voor prototypes besteld; levering verwacht volgende week.",
            "Opdrachtgever geeft aan bij eindpresentaties nadruk te willen leggen op haalbaarheid en onderbouwing.",
          ].map((text, idx) => (
            <li key={idx} className="px-4 py-3.5">
              <p className="text-[11px] text-slate-500">
                {idx === 0 ? "Deze week" : idx === 1 ? "Vorige week" : "Eerder"}
              </p>
              <p className="text-sm text-slate-800 mt-0.5">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
