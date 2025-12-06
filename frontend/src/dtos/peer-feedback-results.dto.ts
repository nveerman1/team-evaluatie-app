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
};
