// DTOs for Student Peer-Feedback Results Page

export type OmzaKey = "organiseren" | "meedoen" | "zelfvertrouwen" | "autonomie";

export type PeerScore = {
  peerLabel: string; // anoniem label of naam
  notes?: string;
  scores: Record<OmzaKey, number>; // 1..5
};

export type ReflectionData = {
  text: string;
  submittedAt?: string; // ISO date
};

export type OmzaAverage = {
  key: string; // "O", "M", "Z", "A"
  label: string; // "Organiseren", "Meedoen", etc.
  value: number; // gemiddelde score 0-4
  delta: number; // verandering t.o.v. vorige scan
};

export type TeacherOmza = {
  O: number; // 1-4 schaal
  M: number;
  Z: number;
  A: number;
};

export type EvaluationResult = {
  id: string;
  title: string; // bijv. "Tussenreview sprint 2"
  course: string; // bijv. "Ontwerpen & Onderzoeken – V2A"
  deadlineISO?: string; // bijv. "2025-11-05"
  status: "open" | "closed" | "processing";
  aiSummary?: string; // max ~7 zinnen
  peers: PeerScore[]; // individuele peer-feedback
  selfScore?: Record<OmzaKey, number>;
  trend?: Partial<Record<OmzaKey, number[]>>; // laatste n gemiddelden (sparkline)
  gcfScore?: number; // 0..100 – Team-bijdrage (GCF), begrijpelijk gemaakt voor leerlingen
  reflection?: ReflectionData; // eigen reflectie
  // New fields for the redesigned page
  teacherComments?: string; // Opmerkingen van de docent (from OMZA table)
  teacherGrade?: number; // Eindcijfer van de docent (bijv. 7.4) (from grades table)
  teacherGradeComment?: string; // Commentaar bij cijfer van de docent (from grades table)
  teacherGradeTrend?: string; // Trend t.o.v. vorige sprint (bijv. "+0,3 t.o.v. vorige sprint")
  teacherOmza?: TeacherOmza; // Docent-OMZA scores op 1-4 schaal (from OMZA table)
  teamContributionFactor?: number; // 0.90-1.10 correctiefactor
  teamContributionLabel?: string; // Label zoals "Boven verwachting"
  omzaAverages?: OmzaAverage[]; // OMZA gemiddelden met delta's
};
