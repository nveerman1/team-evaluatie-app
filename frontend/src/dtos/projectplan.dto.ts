/**
 * DTOs for ProjectPlan (GO/NO-GO) module
 */

// Section keys
export type ProjectPlanSectionKey =
  | "client"
  | "problem"
  | "goal"
  | "method"
  | "planning"
  | "tasks"
  | "motivation"
  | "risks";

// Section status
export type ProjectPlanSectionStatus =
  | "empty"
  | "draft"
  | "submitted"
  | "approved"
  | "revision";

// Plan status
export type ProjectPlanStatus = "concept" | "ingediend" | "go" | "no-go";

// ProjectPlanSection
export type ProjectPlanSection = {
  id: number;
  school_id: number;
  project_plan_id: number;
  key: ProjectPlanSectionKey;
  status: ProjectPlanSectionStatus;
  text?: string;
  // Client section fields
  client_organisation?: string;
  client_contact?: string;
  client_email?: string;
  client_phone?: string;
  client_description?: string;
  // Teacher feedback
  teacher_note?: string;
  created_at: string;
  updated_at: string;
};

// ProjectPlan
export type ProjectPlan = {
  id: number;
  school_id: number;
  project_id: number;
  title?: string;
  status: ProjectPlanStatus;
  locked: boolean;
  global_teacher_note?: string;
  created_at: string;
  updated_at: string;
  sections: ProjectPlanSection[];
};

// ProjectPlan list item
export type ProjectPlanListItem = {
  id: number;
  project_id: number;
  title?: string;
  status: ProjectPlanStatus;
  locked: boolean;
  updated_at: string;
  // Enriched fields
  project_title: string;
  team_number?: number;
  team_members: string[];
  required_complete: number;
  required_total: number;
  total_sections: number;
};

// ProjectPlan list response
export type ProjectPlanListResponse = {
  items: ProjectPlanListItem[];
  total: number;
  page: number;
  per_page: number;
};

// Update DTOs
export type ProjectPlanUpdate = {
  title?: string;
  status?: ProjectPlanStatus;
  locked?: boolean;
  global_teacher_note?: string;
};

export type ProjectPlanSectionUpdate = {
  text?: string;
  status?: ProjectPlanSectionStatus;
  // Client section fields
  client_organisation?: string;
  client_contact?: string;
  client_email?: string;
  client_phone?: string;
  client_description?: string;
  // Teacher feedback
  teacher_note?: string;
};

// Teacher review DTOs
export type TeacherSectionReview = {
  teacher_note: string;
  status: "approved" | "revision";
};

export type TeacherGlobalReview = {
  status: "go" | "no-go";
  global_teacher_note?: string;
  locked?: boolean;
};

// Section metadata
export type SectionMeta = {
  key: ProjectPlanSectionKey;
  title: string;
  hint: string;
  requiredForGo: boolean;
};

export const SECTION_META: SectionMeta[] = [
  {
    key: "client",
    title: "Opdrachtgever",
    hint: "Vul organisatie, contactpersoon en contactgegevens in.",
    requiredForGo: true,
  },
  {
    key: "problem",
    title: "Probleem & context",
    hint: "Wat is het probleem, voor wie, waarom relevant?",
    requiredForGo: true,
  },
  {
    key: "goal",
    title: "Doel & eindproduct",
    hint: "Hoofddoel, eisen/criteria, afbakening (wat niet).",
    requiredForGo: true,
  },
  {
    key: "method",
    title: "Methode",
    hint: "Projectafhankelijk: beschrijf jullie eigen aanpak (geen dropdown).",
    requiredForGo: true,
  },
  {
    key: "planning",
    title: "Planning (globaal)",
    hint: "Fases, mijlpalen, grove tijdsinschatting, knelpunten.",
    requiredForGo: true,
  },
  {
    key: "tasks",
    title: "Taakverdeling",
    hint: "Taken per persoon + wie bewaakt planning/kwaliteit/contact.",
    requiredForGo: false,
  },
  {
    key: "motivation",
    title: "Motivatie",
    hint: "Waarom dit probleem en waarom deze aanpak? Wat is uitdagend?",
    requiredForGo: false,
  },
  {
    key: "risks",
    title: "Risico's / onzekerheden",
    hint: "Wat kan misgaan (technisch/organisatie) en jullie plan B.",
    requiredForGo: false,
  },
];
