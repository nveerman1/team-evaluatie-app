interface NoteItem {
  id: number;
  date: string;
  who: string;
  category: string;
  text: string;
  tags?: string[];
}

const DUMMY_TIMELINE: NoteItem[] = [
  {
    id: 1,
    date: "Vandaag · Les 3",
    who: "Team 1 – Woonhub Noord / Sara",
    category: "Meedoen · Communicatie",
    text: "Sara nam spontaan het voortouw in de pitch-oefening en betrok alle groepsleden.",
    tags: ["samenwerking", "presenteren"],
  },
  {
    id: 2,
    date: "Gisteren · Coachmoment",
    who: "Team 3 – Mobiliteit",
    category: "Organiseren",
    text: "Planning liep achter; team heeft samen taken concreet gemaakt en planning bijgewerkt.",
    tags: ["planning", "proces"],
  },
  {
    id: 3,
    date: "Vorige week",
    who: "Projectgroep",
    category: "Projectproces",
    text: "Veel vragen over beoordelingscriteria; les besteed aan verhelderen van eindtermen en rubric.",
    tags: ["uitleg", "rubric"],
  },
];

export function TimelineCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Tijdlijn</p>
          <p className="text-sm text-slate-600">
            Chronologisch overzicht van alle (dummy) aantekeningen binnen dit project.
          </p>
        </div>
        <div className="flex gap-2 text-[11px]">
          <button className="rounded-full border border-slate-200 px-3 py-1.5 hover:bg-slate-50">
            Filter op periode
          </button>
          <button className="rounded-full border border-slate-200 px-3 py-1.5 hover:bg-slate-50">
            Exporteren (dummy)
          </button>
        </div>
      </div>
      <div className="p-4">
        <ol className="relative border-l border-slate-200 ml-2 pl-4 space-y-4">
          {DUMMY_TIMELINE.map((item) => (
            <li key={item.id} className="relative">
              <span className="absolute -left-[9px] top-[4px] h-2.5 w-2.5 rounded-full bg-indigo-500" />
              <p className="text-[11px] text-slate-500">{item.date}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-slate-800">{item.who}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-700">
                  {item.category}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-800">{item.text}</p>
              {item.tags && (
                <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
