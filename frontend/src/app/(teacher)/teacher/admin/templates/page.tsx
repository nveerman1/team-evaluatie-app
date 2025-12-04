"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { subjectService } from "@/services/subject.service";
import { competencyService } from "@/services/competency.service";
import { Subject } from "@/dtos/subject.dto";
import type {
  Competency,
  CompetencyCategory,
  CompetencyUpdate,
  CompetencyListResponse,
} from "@/dtos/competency.dto";
import {
  createLearningObjective,
  listLearningObjectives,
  importLearningObjectives,
  updateLearningObjective,
  deleteLearningObjective,
} from "@/services/learning-objective.service";
import type {
  LearningObjectiveDto,
  LearningObjectiveCreateDto,
  LearningObjectiveUpdateDto,
  LearningObjectiveImportItem,
} from "@/dtos/learning-objective.dto";
import {
  listPeerCriteria,
  createPeerCriterion,
  updatePeerCriterion,
  deletePeerCriterion,
} from "@/services/peer-evaluation-criterion-template.service";
import type {
  PeerEvaluationCriterionTemplateDto,
  PeerEvaluationCriterionTemplateCreateDto,
} from "@/dtos/peer-evaluation-criterion-template.dto";
import {
  listProjectRubricCriteria,
  createProjectRubricCriterion,
  updateProjectRubricCriterion,
  deleteProjectRubricCriterion,
} from "@/services/project-rubric-criterion-template.service";
import type {
  ProjectRubricCriterionTemplateDto,
  ProjectRubricCriterionTemplateCreateDto,
} from "@/dtos/project-rubric-criterion-template.dto";
import {
  listMailTemplates,
  createMailTemplate,
  updateMailTemplate,
  deleteMailTemplate,
} from "@/services/mail-template.service";
import type {
  MailTemplateDto,
  MailTemplateCreateDto,
} from "@/dtos/mail-template.dto";
import {
  listStandardRemarks,
  createStandardRemark,
  updateStandardRemark,
  deleteStandardRemark,
} from "@/services/standard-remark.service";
import type {
  StandardRemarkDto,
  StandardRemarkCreateDto,
} from "@/dtos/standard-remark.dto";

type TabType =
  | "peer"
  | "rubrics"
  | "competencies"
  | "mail"
  | "objectives"
  | "remarks"
  | "tags";

const TABS: { key: TabType; label: string }[] = [
  { key: "peer", label: "Peerevaluatie Criteria" },
  { key: "rubrics", label: "Projectbeoordeling criteria" },
  { key: "competencies", label: "Competenties" },
  { key: "mail", label: "Mail-templates" },
  { key: "objectives", label: "Leerdoelen" },
  { key: "remarks", label: "Standaardopmerkingen" },
  { key: "tags", label: "Tags & metadata" },
];

export default function TemplatesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<TabType>("peer");

  // Modal state for learning objectives
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [learningObjectives, setLearningObjectives] = useState<
    LearningObjectiveDto[]
  >([]);
  const [loadingObjectives, setLoadingObjectives] = useState(false);
  const [formData, setFormData] = useState<LearningObjectiveCreateDto>({
    domain: "",
    title: "",
    description: "",
    order: 0,
    phase: "",
  });

  // Import state
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    errors: string[];
  } | null>(null);

  // Objectives filtering and editing state
  const [selectedObjectiveLevelFilter, setSelectedObjectiveLevelFilter] = useState<
    "all" | "onderbouw" | "bovenbouw"
  >("all");
  const [selectedObjectiveDomainFilter, setSelectedObjectiveDomainFilter] = useState<string>("all");
  const [editingObjective, setEditingObjective] = useState<number | null>(null);
  const [editObjectiveFormData, setEditObjectiveFormData] = useState<LearningObjectiveUpdateDto>({
    domain: "",
    title: "",
    description: "",
    order: 0,
    phase: "",
  });

  // Peer criteria state
  const [peerCriteria, setPeerCriteria] = useState<
    PeerEvaluationCriterionTemplateDto[]
  >([]);
  const [loadingPeerCriteria, setLoadingPeerCriteria] = useState(false);
  const [expandedCriterion, setExpandedCriterion] = useState<number | null>(
    null,
  );
  const [editingCriterion, setEditingCriterion] = useState<number | null>(null);
  const [editFilterPhase, setEditFilterPhase] = useState<string | undefined>(
    undefined,
  );
  const [editLearningObjectiveIds, setEditLearningObjectiveIds] = useState<
    number[]
  >([]);
  const [isCreatingPeerCriterion, setIsCreatingPeerCriterion] = useState(false);
  const [selectedPeerLevelFilter, setSelectedPeerLevelFilter] = useState<
    "all" | "onderbouw" | "bovenbouw"
  >("all");
  const [activePeerCategory, setActivePeerCategory] = useState<
    "all" | "organiseren" | "meedoen" | "zelfvertrouwen" | "autonomie"
  >("all");
  const [peerSort, setPeerSort] = useState<{
    key: string | null;
    dir: "asc" | "desc";
  }>({ key: null, dir: "asc" });
  const [peerFormData, setPeerFormData] = useState<
    Partial<PeerEvaluationCriterionTemplateCreateDto> & {
      _filterPhase?: string;
    }
  >({
    omza_category: "organiseren",
    title: "",
    description: "",
    target_level: null,
    level_descriptors: {
      "1": "",
      "2": "",
      "3": "",
      "4": "",
      "5": "",
    },
    learning_objective_ids: [] as number[],
    _filterPhase: undefined,
  });

  // Project criteria state
  const [projectCriteria, setProjectCriteria] = useState<
    ProjectRubricCriterionTemplateDto[]
  >([]);
  const [loadingProjectCriteria, setLoadingProjectCriteria] = useState(false);
  const [expandedProjectCriterion, setExpandedProjectCriterion] = useState<
    number | null
  >(null);
  const [editingProjectCriterion, setEditingProjectCriterion] = useState<
    number | null
  >(null);
  const [editProjectFilterPhase, setEditProjectFilterPhase] = useState<
    string | undefined
  >(undefined);
  const [editProjectLearningObjectiveIds, setEditProjectLearningObjectiveIds] =
    useState<number[]>([]);
  const [isCreatingProjectCriterion, setIsCreatingProjectCriterion] =
    useState(false);
  const [selectedProjectLevelFilter, setSelectedProjectLevelFilter] = useState<
    "all" | "onderbouw" | "bovenbouw"
  >("all");
  const [activeProjectCategory, setActiveProjectCategory] = useState<
    "all" | "projectproces" | "eindresultaat" | "communicatie"
  >("all");
  const [projectSort, setProjectSort] = useState<{
    key: string | null;
    dir: "asc" | "desc";
  }>({ key: null, dir: "asc" });
  const [projectFormData, setProjectFormData] = useState<
    Partial<ProjectRubricCriterionTemplateCreateDto> & { _filterPhase?: string }
  >({
    category: "projectproces",
    title: "",
    description: "",
    target_level: null,
    level_descriptors: {
      "1": "",
      "2": "",
      "3": "",
      "4": "",
      "5": "",
    },
    learning_objective_ids: [] as number[],
    _filterPhase: undefined,
  });

  // Competency state
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [categories, setCategories] = useState<CompetencyCategory[]>([]);
  const [loadingCompetencies, setLoadingCompetencies] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<
    number | "all"
  >("all");
  const [selectedCompetencyLevelFilter, setSelectedCompetencyLevelFilter] =
    useState<"all" | "onderbouw" | "bovenbouw">("all");
  const [expandedCompetency, setExpandedCompetency] = useState<number | null>(null);
  const [editingCompetency, setEditingCompetency] = useState<number | null>(null);
  const [editCompetencyFormData, setEditCompetencyFormData] = useState<CompetencyUpdate>({});

  // Mail template state
  const [mailTemplates, setMailTemplates] = useState<MailTemplateDto[]>([]);
  const [loadingMailTemplates, setLoadingMailTemplates] = useState(false);
  const [isCreatingMailTemplate, setIsCreatingMailTemplate] = useState(false);
  const [editingMailTemplate, setEditingMailTemplate] = useState<number | null>(
    null,
  );
  const [isMailEditModalOpen, setIsMailEditModalOpen] = useState(false);
  const [selectedMailTypeFilter, setSelectedMailTypeFilter] = useState<string>("all");
  const [mailSort, setMailSort] = useState<{
    key: string | null;
    dir: "asc" | "desc";
  }>({ key: null, dir: "asc" });
  const [mailFormData, setMailFormData] = useState<
    Partial<MailTemplateCreateDto>
  >({
    name: "",
    type: "opvolgmail",
    subject: "",
    body: "",
    is_active: true,
  });

  // Standard remarks (OMZA quick comments) state
  const [standardRemarks, setStandardRemarks] = useState<StandardRemarkDto[]>(
    [],
  );
  const [loadingStandardRemarks, setLoadingStandardRemarks] = useState(false);
  const [isCreatingStandardRemark, setIsCreatingStandardRemark] =
    useState(false);
  const [editingStandardRemark, setEditingStandardRemark] = useState<
    number | null
  >(null);
  const [expandedRemark, setExpandedRemark] = useState<number | null>(null);
  const [selectedOmzaCategoryFilter, setSelectedOmzaCategoryFilter] = useState<
    "all" | "O" | "M" | "Z" | "A"
  >("all");
  const [remarkSort, setRemarkSort] = useState<{
    key: string | null;
    dir: "asc" | "desc";
  }>({ key: null, dir: "asc" });
  const [remarkFormData, setRemarkFormData] = useState<
    Partial<StandardRemarkCreateDto>
  >({
    type: "omza",
    category: "O",
    text: "",
    order: 0,
  });

  // Sync state with URL params
  useEffect(() => {
    const subjectIdParam = searchParams.get("subjectId");
    const tabParam = searchParams.get("tab");

    if (subjectIdParam) {
      setSelectedSubjectId(parseInt(subjectIdParam));
    }
    if (tabParam && TABS.find((t) => t.key === tabParam)) {
      setActiveTab(tabParam as TabType);
    }
  }, [searchParams]);

  // Load subjects
  useEffect(() => {
    loadSubjects();
  }, []);

  // Load learning objectives when tab changes to objectives
  useEffect(() => {
    if (activeTab === "objectives" && selectedSubjectId) {
      fetchLearningObjectives();
    }
  }, [activeTab, selectedSubjectId]);

  // Load peer criteria when tab changes to peer
  useEffect(() => {
    if (activeTab === "peer" && selectedSubjectId) {
      fetchPeerCriteria();
      fetchLearningObjectives(); // Also load learning objectives for linking
    }
  }, [activeTab, selectedSubjectId]);

  // Load project criteria when tab changes to rubrics
  useEffect(() => {
    if (activeTab === "rubrics" && selectedSubjectId) {
      fetchProjectCriteria();
      fetchLearningObjectives(); // Also load learning objectives for linking
    }
  }, [activeTab, selectedSubjectId]);

  // Load mail templates when tab changes to mail
  useEffect(() => {
    if (activeTab === "mail") {
      fetchMailTemplates();
    }
  }, [activeTab, selectedSubjectId]);

  // Load competencies when tab changes to competencies
  useEffect(() => {
    if (activeTab === "competencies") {
      fetchCompetencies();
      fetchCategories();
    }
  }, [activeTab]);

  // Load standard remarks when tab changes to remarks
  useEffect(() => {
    if (activeTab === "remarks" && selectedSubjectId) {
      fetchStandardRemarks();
    }
  }, [activeTab, selectedSubjectId]);

  const loadSubjects = async () => {
    try {
      setLoading(true);
      const response = await subjectService.listSubjects({
        per_page: 100,
        is_active: true,
      });
      setSubjects(response.subjects);
    } catch (err) {
      console.error("Failed to load subjects:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLearningObjectives = async () => {
    if (!selectedSubjectId) return;

    setLoadingObjectives(true);
    try {
      const response = await listLearningObjectives({
        page: 1,
        limit: 50,
        subject_id: selectedSubjectId, // Filter by selected subject
        objective_type: "template", // Only show central/template objectives in admin
      });
      setLearningObjectives(response.items);
    } catch (err) {
      console.error("Error fetching learning objectives:", err);
    } finally {
      setLoadingObjectives(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const cats = await competencyService.getCategories();
      setCategories(cats);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  const fetchCompetencies = async () => {
    setLoadingCompetencies(true);
    try {
      // Fetch all central/template competencies (admin manages these)
      const response: CompetencyListResponse = await competencyService.listTeacherCompetencies({
        page: 1,
        limit: 100,
        active_only: false, // Include inactive
        competency_type: "central", // Only central/template competencies in admin
      });
      setCompetencies(response.items);
    } catch (err) {
      console.error("Error fetching competencies:", err);
    } finally {
      setLoadingCompetencies(false);
    }
  };

  // Filter competencies based on selected filters
  const filteredCompetencies = useMemo((): Competency[] => {
    let result = competencies;
    
    // Filter by category
    if (selectedCategoryFilter !== "all") {
      result = result.filter(comp => comp.category_id === selectedCategoryFilter);
    }
    
    // Filter by phase/level
    if (selectedCompetencyLevelFilter !== "all") {
      result = result.filter(comp => comp.phase === selectedCompetencyLevelFilter);
    }
    
    return result;
  }, [competencies, selectedCategoryFilter, selectedCompetencyLevelFilter]);

  // Group competencies by category for display
  const competenciesByCategory = useMemo(() => {
    const grouped: Record<number, { category: CompetencyCategory | null; items: Competency[] }> = {};
    
    // Initialize with categories
    categories.forEach(cat => {
      grouped[cat.id] = { category: cat, items: [] };
    });
    
    // Add uncategorized group
    grouped[0] = { category: null, items: [] };
    
    // Group competencies
    filteredCompetencies.forEach(comp => {
      const catId = comp.category_id || 0;
      if (!grouped[catId]) {
        grouped[catId] = { category: null, items: [] };
      }
      grouped[catId].items.push(comp);
    });
    
    // Return only groups with items
    return Object.entries(grouped)
      .filter(([_, group]) => group.items.length > 0)
      .sort(([a], [b]) => parseInt(a) - parseInt(b));
  }, [filteredCompetencies, categories]);

  // Competency inline editing functions
  const toggleCompetencyExpand = (id: number) => {
    if (expandedCompetency === id) {
      setExpandedCompetency(null);
      setEditingCompetency(null);
    } else {
      setExpandedCompetency(id);
      setEditingCompetency(null);
    }
  };

  const startEditCompetency = (comp: Competency) => {
    setEditingCompetency(comp.id);
    setEditCompetencyFormData({
      name: comp.name,
      description: comp.description || "",
      category_id: comp.category_id,
      phase: comp.phase || "",
      level_descriptors: comp.level_descriptors || { "1": "", "2": "", "3": "", "4": "", "5": "" },
    });
  };

  const handleUpdateCompetency = async (competencyId: number) => {
    try {
      // Clean up the form data - don't send empty strings for optional fields
      const cleanedData: CompetencyUpdate = {
        name: editCompetencyFormData.name,
        description: editCompetencyFormData.description || undefined,
        category_id: editCompetencyFormData.category_id || undefined,
        phase: editCompetencyFormData.phase || undefined,
        level_descriptors: editCompetencyFormData.level_descriptors,
      };
      await competencyService.updateCompetency(competencyId, cleanedData);
      setEditingCompetency(null);
      setEditCompetencyFormData({});
      fetchCompetencies();
    } catch (err) {
      console.error("Error updating competency:", err);
      alert("Er is een fout opgetreden bij het bijwerken van de competentie.");
    }
  };

  const handleDeleteCompetency = async (competencyId: number) => {
    if (!confirm("Weet je zeker dat je deze competentie wilt verwijderen?")) {
      return;
    }
    try {
      await competencyService.deleteCompetency(competencyId);
      setExpandedCompetency(null);
      setEditingCompetency(null);
      fetchCompetencies();
    } catch (err) {
      console.error("Error deleting competency:", err);
      alert("Er is een fout opgetreden bij het verwijderen van de competentie.");
    }
  };


  // Filter and sort peer criteria for the table view
  const filteredAndSortedPeerCriteria = useMemo(() => {
    // First filter by level
    let filtered = peerCriteria;
    if (selectedPeerLevelFilter !== "all") {
      filtered = filtered.filter(
        (c) => c.target_level === selectedPeerLevelFilter,
      );
    }
    // Then filter by category
    if (activePeerCategory !== "all") {
      filtered = filtered.filter((c) => c.omza_category === activePeerCategory);
    }
    // Map to include categoryName for display and sorting
    const mapped = filtered.map((c) => ({
      ...c,
      categoryName:
        c.omza_category.charAt(0).toUpperCase() + c.omza_category.slice(1),
      learningObjectivesCount: c.learning_objective_ids?.length ?? 0,
    }));
    // Sort if sort key is set
    if (peerSort.key) {
      const dir = peerSort.dir === "asc" ? 1 : -1;
      mapped.sort((a, b) => {
        const aVal = a[peerSort.key as keyof typeof a];
        const bVal = b[peerSort.key as keyof typeof b];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (aVal < bVal) return -1 * dir;
        if (aVal > bVal) return 1 * dir;
        return 0;
      });
    }
    return mapped;
  }, [peerCriteria, selectedPeerLevelFilter, activePeerCategory, peerSort]);

  // Keep filteredPeerCriteria for backward compatibility (used in create form)
  const filteredPeerCriteria = useMemo(() => {
    if (selectedPeerLevelFilter === "all") {
      return peerCriteria;
    }
    return peerCriteria.filter(
      (c) => c.target_level === selectedPeerLevelFilter,
    );
  }, [peerCriteria, selectedPeerLevelFilter]);

  // Filter and sort project criteria for the table view
  const filteredAndSortedProjectCriteria = useMemo(() => {
    // First filter by level
    let filtered = projectCriteria;
    if (selectedProjectLevelFilter !== "all") {
      filtered = filtered.filter(
        (c) => c.target_level === selectedProjectLevelFilter,
      );
    }
    // Then filter by category
    if (activeProjectCategory !== "all") {
      filtered = filtered.filter((c) => c.category === activeProjectCategory);
    }
    // Map to include categoryName for display and sorting
    const categoryLabels: Record<string, string> = {
      projectproces: "Projectproces",
      eindresultaat: "Eindresultaat",
      communicatie: "Communicatie",
    };
    const mapped = filtered.map((c) => ({
      ...c,
      categoryName: categoryLabels[c.category] || c.category,
      learningObjectivesCount: c.learning_objective_ids?.length ?? 0,
    }));
    // Sort if sort key is set
    if (projectSort.key) {
      const dir = projectSort.dir === "asc" ? 1 : -1;
      mapped.sort((a, b) => {
        const aVal = a[projectSort.key as keyof typeof a];
        const bVal = b[projectSort.key as keyof typeof b];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (aVal < bVal) return -1 * dir;
        if (aVal > bVal) return 1 * dir;
        return 0;
      });
    }
    return mapped;
  }, [
    projectCriteria,
    selectedProjectLevelFilter,
    activeProjectCategory,
    projectSort,
  ]);

  // Get unique domains from learning objectives for filter dropdown
  const uniqueObjectiveDomains = useMemo(() => {
    const domains = new Set<string>();
    learningObjectives.forEach((obj) => {
      if (obj.domain) {
        domains.add(obj.domain);
      }
    });
    return Array.from(domains).sort();
  }, [learningObjectives]);

  // Filter learning objectives based on selected filters
  const filteredLearningObjectives = useMemo(() => {
    let filtered = learningObjectives;
    
    // Filter by level (phase)
    if (selectedObjectiveLevelFilter !== "all") {
      filtered = filtered.filter(
        (obj) => obj.phase === selectedObjectiveLevelFilter,
      );
    }
    
    // Filter by domain
    if (selectedObjectiveDomainFilter !== "all") {
      filtered = filtered.filter(
        (obj) => obj.domain === selectedObjectiveDomainFilter,
      );
    }
    
    return filtered;
  }, [learningObjectives, selectedObjectiveLevelFilter, selectedObjectiveDomainFilter]);

  const openCreateModal = () => {
    setFormData({
      domain: "",
      title: "",
      description: "",
      order: 0,
      phase: "",
      subject_id: selectedSubjectId, // Set subject_id from selected subject
    });
    setIsCreateModalOpen(true);
  };

  const handleCreateObjective = async () => {
    if (!formData.title) {
      alert("Titel is verplicht");
      return;
    }

    if (!selectedSubjectId) {
      alert("Selecteer eerst een sectie");
      return;
    }

    try {
      // Create as central/template objective (is_template: true) with subject_id
      await createLearningObjective({
        ...formData,
        subject_id: selectedSubjectId,
        is_template: true, // This is a central objective managed by admin
      });
      setIsCreateModalOpen(false);
      fetchLearningObjectives();
    } catch (err) {
      console.error("Error creating learning objective:", err);
      alert("Er is een fout opgetreden bij het aanmaken van het leerdoel.");
    }
  };

  const handleUpdateObjective = async (id: number) => {
    if (!editObjectiveFormData.title) {
      alert("Titel is verplicht");
      return;
    }

    try {
      await updateLearningObjective(id, editObjectiveFormData);
      setEditingObjective(null);
      setEditObjectiveFormData({
        domain: "",
        title: "",
        description: "",
        order: 0,
        phase: "",
      });
      fetchLearningObjectives();
    } catch (err) {
      console.error("Error updating learning objective:", err);
      alert("Er is een fout opgetreden bij het bijwerken van het leerdoel.");
    }
  };

  const handleDeleteObjective = async (id: number) => {
    if (!confirm("Weet je zeker dat je dit leerdoel wilt verwijderen?")) {
      return;
    }
    try {
      await deleteLearningObjective(id);
      fetchLearningObjectives();
    } catch (err) {
      console.error("Error deleting learning objective:", err);
      alert("Er is een fout opgetreden bij het verwijderen van het leerdoel.");
    }
  };

  const startEditingObjective = (obj: LearningObjectiveDto) => {
    setEditingObjective(obj.id);
    setEditObjectiveFormData({
      domain: obj.domain || "",
      title: obj.title,
      description: obj.description || "",
      order: obj.order,
      phase: obj.phase || "",
    });
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    let fieldStart = true;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"' && (fieldStart || inQuotes)) {
        if (fieldStart && !inQuotes) {
          inQuotes = true;
          fieldStart = false;
        } else if (inQuotes) {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
        fieldStart = true;
      } else {
        current += char;
        fieldStart = false;
      }
    }
    result.push(current.trim());

    return result;
  };

  const handleImport = async () => {
    if (!importText.trim()) {
      alert("Voer CSV-gegevens in");
      return;
    }

    if (!selectedSubjectId) {
      alert("Selecteer eerst een sectie");
      return;
    }

    try {
      const lines = importText.trim().split("\n");
      const items: LearningObjectiveImportItem[] = [];

      const firstLine = lines[0].toLowerCase();
      const hasHeader =
        firstLine.includes("domein") ||
        firstLine.includes("domain") ||
        firstLine.includes("nummer") ||
        firstLine.includes("titel") ||
        firstLine.includes("title");
      const startIdx = hasHeader ? 1 : 0;

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = parseCSVLine(line);
        if (parts.length < 2) continue;

        let phase = parts[4] || null;
        if (phase) {
          const phaseUpper = phase.toUpperCase();
          if (phaseUpper === "B" || phaseUpper === "ONDERBOUW") {
            phase = "onderbouw";
          } else if (phaseUpper === "E" || phaseUpper === "BOVENBOUW") {
            phase = "bovenbouw";
          }
          if (phase.length > 20) {
            phase = phase.substring(0, 20);
          }
        }

        items.push({
          domain: parts[0] || null,
          order: parts[1] ? parseInt(parts[1], 10) : 0,
          title: parts[2] || parts[1],
          description: parts[3] || null,
          phase: phase,
        });
      }

      const result = await importLearningObjectives(
        { items },
        selectedSubjectId,
        true, // Import as central/template objectives (is_template: true)
      );
      setImportResult(result);
      if (result.errors.length === 0) {
        fetchLearningObjectives();
      }
    } catch (err) {
      console.error("Error importing learning objectives:", err);
      alert("Er is een fout opgetreden bij het importeren.");
    }
  };

  // Peer criteria functions
  const fetchPeerCriteria = async () => {
    if (!selectedSubjectId) return;

    setLoadingPeerCriteria(true);
    try {
      const criteria = await listPeerCriteria(selectedSubjectId);
      setPeerCriteria(criteria);
    } catch (err) {
      console.error("Error fetching peer criteria:", err);
    } finally {
      setLoadingPeerCriteria(false);
    }
  };

  const handleCreatePeerCriterion = async () => {
    if (!peerFormData.title) {
      alert("Titel is verplicht");
      return;
    }
    if (!selectedSubjectId) {
      alert("Selecteer eerst een sectie");
      return;
    }

    try {
      await createPeerCriterion({
        ...(peerFormData as PeerEvaluationCriterionTemplateCreateDto),
        subject_id: selectedSubjectId,
      });
      setIsCreatingPeerCriterion(false);
      setPeerFormData({
        omza_category: "organiseren",
        title: "",
        description: "",
        level_descriptors: { "1": "", "2": "", "3": "", "4": "", "5": "" },
        learning_objective_ids: [],
      });
      fetchPeerCriteria();
    } catch (err) {
      console.error("Error creating peer criterion:", err);
      alert("Er is een fout opgetreden bij het aanmaken.");
    }
  };

  const handleUpdatePeerCriterion = async (
    id: number,
    data: Partial<PeerEvaluationCriterionTemplateCreateDto>,
  ) => {
    try {
      await updatePeerCriterion(id, data);
      setEditingCriterion(null);
      fetchPeerCriteria();
    } catch (err) {
      console.error("Error updating peer criterion:", err);
      alert("Er is een fout opgetreden bij het bijwerken.");
    }
  };

  const handleDeletePeerCriterion = async (id: number) => {
    if (!confirm("Weet je zeker dat je dit criterium wilt verwijderen?")) {
      return;
    }
    try {
      await deletePeerCriterion(id);
      fetchPeerCriteria();
    } catch (err) {
      console.error("Error deleting peer criterion:", err);
      alert("Er is een fout opgetreden bij het verwijderen.");
    }
  };

  const toggleCriterionExpand = (id: number) => {
    setExpandedCriterion(expandedCriterion === id ? null : id);
    setEditingCriterion(null);
  };

  // Project criteria functions
  const fetchProjectCriteria = async () => {
    if (!selectedSubjectId) return;

    setLoadingProjectCriteria(true);
    try {
      const criteria = await listProjectRubricCriteria(selectedSubjectId);
      setProjectCriteria(criteria);
    } catch (err) {
      console.error("Error fetching project criteria:", err);
    } finally {
      setLoadingProjectCriteria(false);
    }
  };

  const handleCreateProjectCriterion = async () => {
    if (!projectFormData.title) {
      alert("Titel is verplicht");
      return;
    }
    if (!selectedSubjectId) {
      alert("Selecteer eerst een sectie");
      return;
    }

    try {
      await createProjectRubricCriterion({
        ...(projectFormData as ProjectRubricCriterionTemplateCreateDto),
        subject_id: selectedSubjectId,
      });
      setIsCreatingProjectCriterion(false);
      setProjectFormData({
        category: "projectproces",
        title: "",
        description: "",
        target_level: null,
        level_descriptors: { "1": "", "2": "", "3": "", "4": "", "5": "" },
        learning_objective_ids: [],
      });
      fetchProjectCriteria();
    } catch (err) {
      console.error("Error creating project criterion:", err);
      alert("Er is een fout opgetreden bij het aanmaken.");
    }
  };

  const handleUpdateProjectCriterion = async (
    id: number,
    data: Partial<ProjectRubricCriterionTemplateCreateDto>,
  ) => {
    try {
      await updateProjectRubricCriterion(id, data);
      setEditingProjectCriterion(null);
      fetchProjectCriteria();
    } catch (err) {
      console.error("Error updating project criterion:", err);
      alert("Er is een fout opgetreden bij het bijwerken.");
    }
  };

  const handleDeleteProjectCriterion = async (id: number) => {
    if (!confirm("Weet je zeker dat je dit criterium wilt verwijderen?")) {
      return;
    }
    try {
      await deleteProjectRubricCriterion(id);
      fetchProjectCriteria();
    } catch (err) {
      console.error("Error deleting project criterion:", err);
      alert("Er is een fout opgetreden bij het verwijderen.");
    }
  };

  const toggleProjectCriterionExpand = (id: number) => {
    setExpandedProjectCriterion(expandedProjectCriterion === id ? null : id);
    setEditingProjectCriterion(null);
  };

  // Mail template functions
  const fetchMailTemplates = async () => {
    setLoadingMailTemplates(true);
    try {
      const templates = await listMailTemplates({
        subject_id: selectedSubjectId,
      });
      setMailTemplates(templates);
    } catch (err) {
      console.error("Error fetching mail templates:", err);
    } finally {
      setLoadingMailTemplates(false);
    }
  };

  const handleCreateMailTemplate = async () => {
    if (
      !mailFormData.name ||
      !mailFormData.subject ||
      !mailFormData.body ||
      !mailFormData.type
    ) {
      alert("Naam, type, onderwerp en inhoud zijn verplicht");
      return;
    }

    try {
      const createData: MailTemplateCreateDto = {
        name: mailFormData.name,
        type: mailFormData.type,
        subject: mailFormData.subject,
        body: mailFormData.body,
        subject_id: selectedSubjectId ?? undefined,
        is_active: mailFormData.is_active ?? true,
      };
      await createMailTemplate(createData);
      setIsCreatingMailTemplate(false);
      setMailFormData({
        name: "",
        type: "opvolgmail",
        subject: "",
        body: "",
        is_active: true,
      });
      fetchMailTemplates();
    } catch (err) {
      console.error("Error creating mail template:", err);
      alert("Er is een fout opgetreden bij het aanmaken.");
    }
  };

  const _handleUpdateMailTemplate = async (
    id: number,
    data: Partial<MailTemplateCreateDto>,
  ) => {
    try {
      await updateMailTemplate(id, data);
      setEditingMailTemplate(null);
      fetchMailTemplates();
    } catch (err) {
      console.error("Error updating mail template:", err);
      alert("Er is een fout opgetreden bij het bijwerken.");
    }
  };

  const handleDeleteMailTemplate = async (id: number) => {
    if (!confirm("Weet je zeker dat je deze mail template wilt verwijderen?")) {
      return;
    }
    try {
      await deleteMailTemplate(id);
      fetchMailTemplates();
    } catch (err) {
      console.error("Error deleting mail template:", err);
      alert("Er is een fout opgetreden bij het verwijderen.");
    }
  };

  // Standard remarks (OMZA quick comments) functions
  const fetchStandardRemarks = async () => {
    if (!selectedSubjectId) return;

    setLoadingStandardRemarks(true);
    try {
      const response = await listStandardRemarks({
        subject_id: selectedSubjectId,
        type: "omza",
        per_page: 100,
      });
      setStandardRemarks(response.remarks);
    } catch (err) {
      console.error("Error fetching standard remarks:", err);
    } finally {
      setLoadingStandardRemarks(false);
    }
  };

  const handleCreateStandardRemark = async () => {
    if (!remarkFormData.text) {
      alert("Tekst is verplicht");
      return;
    }
    if (!selectedSubjectId) {
      alert("Selecteer eerst een sectie");
      return;
    }

    try {
      await createStandardRemark({
        ...(remarkFormData as StandardRemarkCreateDto),
        subject_id: selectedSubjectId,
        type: "omza",
      });
      setIsCreatingStandardRemark(false);
      setRemarkFormData({
        type: "omza",
        category: "O",
        text: "",
        order: 0,
      });
      fetchStandardRemarks();
    } catch (err) {
      console.error("Error creating standard remark:", err);
      alert("Er is een fout opgetreden bij het aanmaken.");
    }
  };

  const handleUpdateStandardRemark = async (
    id: number,
    data: Partial<StandardRemarkCreateDto>,
  ) => {
    try {
      await updateStandardRemark(id, data);
      setEditingStandardRemark(null);
      fetchStandardRemarks();
    } catch (err) {
      console.error("Error updating standard remark:", err);
      alert("Er is een fout opgetreden bij het bijwerken.");
    }
  };

  const handleDeleteStandardRemark = async (id: number) => {
    if (!confirm("Weet je zeker dat je deze opmerking wilt verwijderen?")) {
      return;
    }
    try {
      await deleteStandardRemark(id);
      fetchStandardRemarks();
    } catch (err) {
      console.error("Error deleting standard remark:", err);
      alert("Er is een fout opgetreden bij het verwijderen.");
    }
  };

  const toggleRemarkExpand = (id: number) => {
    setExpandedRemark(expandedRemark === id ? null : id);
    setEditingStandardRemark(null);
  };

  // OMZA category labels
  const OMZA_CATEGORY_LABELS: Record<string, string> = {
    O: "Organiseren",
    M: "Meedoen",
    Z: "Zelfvertrouwen",
    A: "Autonomie",
  };

  // Filter and sort standard remarks by OMZA category
  const filteredAndSortedStandardRemarks = useMemo(() => {
    // First filter by category
    let filtered = standardRemarks;
    if (selectedOmzaCategoryFilter !== "all") {
      filtered = filtered.filter(
        (r) => r.category === selectedOmzaCategoryFilter,
      );
    }
    // Map to include categoryName for display and sorting
    const mapped = filtered.map((r) => ({
      ...r,
      categoryName: OMZA_CATEGORY_LABELS[r.category] || r.category,
    }));
    // Sort if sort key is set
    if (remarkSort.key) {
      const dir = remarkSort.dir === "asc" ? 1 : -1;
      mapped.sort((a, b) => {
        const aVal = a[remarkSort.key as keyof typeof a];
        const bVal = b[remarkSort.key as keyof typeof b];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (aVal < bVal) return -1 * dir;
        if (aVal > bVal) return 1 * dir;
        return 0;
      });
    }
    return mapped;
  }, [standardRemarks, selectedOmzaCategoryFilter, remarkSort]);

  // Mail template type labels for display
  const MAIL_TYPE_LABELS: Record<string, string> = {
    opvolgmail: "Opvolgmail",
    startproject: "Start project",
    tussenpresentatie: "Tussenpresentatie",
    eindpresentatie: "Eindpresentatie",
    bedankmail: "Bedankmail",
    herinnering: "Herinnering",
  };

  // Filter and sort mail templates for the table view
  const filteredAndSortedMailTemplates = useMemo(() => {
    // First filter by type
    let filtered = mailTemplates;
    if (selectedMailTypeFilter !== "all") {
      filtered = filtered.filter((t) => t.type === selectedMailTypeFilter);
    }
    // Map to include typeName for display and sorting
    const mapped = filtered.map((t) => ({
      ...t,
      typeName: MAIL_TYPE_LABELS[t.type] || t.type,
    }));
    // Sort if sort key is set
    if (mailSort.key) {
      const dir = mailSort.dir === "asc" ? 1 : -1;
      mapped.sort((a, b) => {
        const aVal = a[mailSort.key as keyof typeof a];
        const bVal = b[mailSort.key as keyof typeof b];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (aVal < bVal) return -1 * dir;
        if (aVal > bVal) return 1 * dir;
        return 0;
      });
    }
    return mapped;
  }, [mailTemplates, selectedMailTypeFilter, mailSort]);

  // Open mail edit modal
  const openMailEditModal = (template: MailTemplateDto) => {
    setEditingMailTemplate(template.id);
    setMailFormData({
      name: template.name,
      type: template.type,
      subject: template.subject,
      body: template.body,
      is_active: template.is_active,
    });
    setIsMailEditModalOpen(true);
  };

  // Handle mail template update from modal
  const handleMailTemplateUpdateFromModal = async () => {
    if (!editingMailTemplate) return;
    
    if (!mailFormData.name || !mailFormData.subject || !mailFormData.body || !mailFormData.type) {
      alert("Naam, type, onderwerp en inhoud zijn verplicht");
      return;
    }

    try {
      await updateMailTemplate(editingMailTemplate, {
        name: mailFormData.name,
        type: mailFormData.type,
        subject: mailFormData.subject,
        body: mailFormData.body,
        is_active: mailFormData.is_active,
      });
      setIsMailEditModalOpen(false);
      setEditingMailTemplate(null);
      setMailFormData({
        name: "",
        type: "opvolgmail",
        subject: "",
        body: "",
        is_active: true,
      });
      fetchMailTemplates();
    } catch (err) {
      console.error("Error updating mail template:", err);
      alert("Er is een fout opgetreden bij het bijwerken.");
    }
  };

  const updateURL = (subjectId: number | null, tab: TabType) => {
    const params = new URLSearchParams();
    if (subjectId) params.set("subjectId", subjectId.toString());
    params.set("tab", tab);
    router.push(`/teacher/admin/templates?${params.toString()}`);
  };

  const handleSubjectChange = (subjectId: number) => {
    setSelectedSubjectId(subjectId);
    updateURL(subjectId, activeTab);
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    updateURL(selectedSubjectId, tab);
  };

  const renderTabContent = () => {
    // Competencies are school-wide and don't require a subject selection
    if (activeTab === "competencies") {
      return (
        <div className="p-6">
          <div className="space-y-6">
            {/* Header and description */}
            <div>
              <p className="text-sm text-gray-600">
                Beheer competentie templates met niveau descriptoren per
                categorie
              </p>
            </div>

            {/* Filters - Dropdowns for category and level */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Category Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">Categorie:</span>
                <select
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm"
                  value={
                    selectedCategoryFilter === "all"
                      ? "all"
                      : selectedCategoryFilter
                  }
                  onChange={(e) =>
                    setSelectedCategoryFilter(
                      e.target.value === "all"
                        ? "all"
                        : parseInt(e.target.value),
                    )
                  }
                >
                  <option value="all">
                    Alle categorieën ({competencies.length})
                  </option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} ({competencies.filter(c => c.category_id === category.id).length})
                    </option>
                  ))}
                </select>
              </div>

              {/* Level Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">Niveau:</span>
                {[
                  { id: "all", label: "Alle" },
                  { id: "onderbouw", label: "Onderbouw" },
                  { id: "bovenbouw", label: "Bovenbouw" },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() =>
                      setSelectedCompetencyLevelFilter(
                        filter.id as "all" | "onderbouw" | "bovenbouw",
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      selectedCompetencyLevelFilter === filter.id
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Loading state */}
            {loadingCompetencies && (
              <div className="text-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                <p className="mt-2 text-sm text-gray-500">
                  Competenties laden...
                </p>
              </div>
            )}

            {/* No data state */}
            {!loadingCompetencies && competencies.length === 0 && (
              <div className="text-center py-12 border rounded-xl bg-gray-50">
                <p className="text-gray-500 mb-4">
                  Nog geen competenties aangemaakt.
                </p>
                <Link
                  href="/teacher/competencies/create"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  <span>+</span> Eerste Competentie Aanmaken
                </Link>
              </div>
            )}

            {/* Single Competency Table */}
            {!loadingCompetencies && filteredCompetencies.length > 0 && (
              <div className="bg-white rounded-2xl border overflow-hidden">
                <table className="w-full table-fixed">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-36 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="w-32 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Categorie
                      </th>
                      <th className="w-40 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Naam
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Beschrijving
                      </th>
                      <th className="w-32 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fase
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredCompetencies.map((comp) => {
                      const isExpanded = expandedCompetency === comp.id;
                      const isEditing = editingCompetency === comp.id;
                      
                      return [
                        <tr 
                          key={comp.id} 
                          className="hover:bg-gray-50 cursor-pointer bg-amber-50/30"
                          onClick={() => toggleCompetencyExpand(comp.id)}
                        >
                          <td className="w-36 px-4 py-3 text-sm">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800 whitespace-nowrap">
                              🏛️ Centraal
                            </span>
                          </td>
                          <td className="w-32 px-4 py-3 text-sm">
                            {comp.category_name ? (
                              <span className="font-medium">{comp.category_name}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="w-40 px-4 py-3 text-sm font-medium">{comp.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 truncate">
                            {comp.description || <span className="text-gray-400">-</span>}
                          </td>
                          <td className="w-32 px-4 py-3 text-sm">
                            {comp.phase ? (
                              <span className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
                                comp.phase === "onderbouw" 
                                  ? "bg-blue-100 text-blue-800" 
                                  : "bg-purple-100 text-purple-800"
                              }`}>
                                {comp.phase === "onderbouw" ? "Onderbouw" : "Bovenbouw"}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>,
                        isExpanded && (
                          <tr key={`${comp.id}-expanded`} className="bg-slate-50">
                            <td colSpan={5} className="p-4">
                              {isEditing ? (
                                // Edit form
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium mb-1">Naam</label>
                                      <input
                                        type="text"
                                        value={editCompetencyFormData.name || ""}
                                        onChange={(e) => setEditCompetencyFormData({ ...editCompetencyFormData, name: e.target.value })}
                                        className="w-full px-3 py-2 border rounded"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium mb-1">Categorie</label>
                                      <select
                                        value={editCompetencyFormData.category_id || ""}
                                        onChange={(e) => setEditCompetencyFormData({ ...editCompetencyFormData, category_id: e.target.value ? parseInt(e.target.value) : undefined })}
                                        className="w-full px-3 py-2 border rounded"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <option value="">Geen categorie</option>
                                        {categories.map((cat) => (
                                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium mb-1">Fase</label>
                                      <select
                                        value={editCompetencyFormData.phase || ""}
                                        onChange={(e) => setEditCompetencyFormData({ ...editCompetencyFormData, phase: e.target.value })}
                                        className="w-full px-3 py-2 border rounded"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <option value="">Niet gespecificeerd</option>
                                        <option value="onderbouw">Onderbouw</option>
                                        <option value="bovenbouw">Bovenbouw</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-1">Beschrijving</label>
                                    <textarea
                                      value={editCompetencyFormData.description || ""}
                                      onChange={(e) => setEditCompetencyFormData({ ...editCompetencyFormData, description: e.target.value })}
                                      className="w-full px-3 py-2 border rounded"
                                      rows={2}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-2">Niveaubeschrijvingen</label>
                                    <div className="grid grid-cols-5 gap-2">
                                      {[1, 2, 3, 4, 5].map((level) => (
                                        <div key={level} className="flex flex-col">
                                          <label className="text-xs font-medium text-gray-700 mb-1">Niveau {level}</label>
                                          <textarea
                                            value={editCompetencyFormData.level_descriptors?.[level.toString()] || ""}
                                            onChange={(e) => setEditCompetencyFormData({
                                              ...editCompetencyFormData,
                                              level_descriptors: {
                                                ...editCompetencyFormData.level_descriptors,
                                                [level.toString()]: e.target.value
                                              }
                                            })}
                                            className="w-full px-2 py-1.5 border rounded text-xs resize-none"
                                            rows={3}
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateCompetency(comp.id);
                                      }}
                                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                    >
                                      Opslaan
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingCompetency(null);
                                        setEditCompetencyFormData({});
                                      }}
                                      className="px-3 py-1.5 border text-sm rounded hover:bg-gray-100"
                                    >
                                      Annuleren
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                // Read-only view with level descriptors
                                <>
                                  {comp.category_description && (
                                    <p className="text-sm text-gray-600 mb-3">{comp.category_description}</p>
                                  )}
                                  <div className="text-xs font-medium text-slate-700 mb-2">
                                    Niveaubeschrijvingen (1–5)
                                  </div>
                                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                                    {[1, 2, 3, 4, 5].map((level) => (
                                      <div key={level} className="flex min-h-[80px] flex-col rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-inner">
                                        <span className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Niveau {level}</span>
                                        <p className="text-[11px] text-slate-700">
                                          {comp.level_descriptors?.[level.toString()] || <em className="text-slate-400">Niet ingevuld</em>}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-4 flex justify-between items-center text-xs">
                                    <span className="text-gray-400">Klik om details te verbergen</span>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          startEditCompetency(comp);
                                        }}
                                        className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                      >
                                        Bewerken
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteCompetency(comp.id);
                                        }}
                                        className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                                      >
                                        Verwijderen
                                      </button>
                                    </div>
                                  </div>
                                </>
                              )}
                            </td>
                          </tr>
                        ),
                      ];
                    })}
                  </tbody>
                </table>

                {filteredCompetencies.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    Geen competenties gevonden
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Mail templates can work with or without a subject selection (school-wide or per subject)
    if (activeTab === "mail" && !selectedSubjectId) {
      return (
        <div className="p-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Mail-templates (School-breed)
            </h3>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Beheer school-brede email templates met variabelen voor
                verschillende communicatiemomenten. Selecteer een sectie voor
                vak-specifieke templates.
              </p>

              {/* Filters above the table */}
              <div className="flex flex-wrap items-center gap-4">
                {/* Type filter */}
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span>Type:</span>
                  <select
                    className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                    value={selectedMailTypeFilter}
                    onChange={(e) => setSelectedMailTypeFilter(e.target.value)}
                  >
                    <option value="all">Alle</option>
                    <option value="opvolgmail">Opvolgmail</option>
                    <option value="startproject">Start project</option>
                    <option value="tussenpresentatie">Tussenpresentatie</option>
                    <option value="eindpresentatie">Eindpresentatie</option>
                    <option value="bedankmail">Bedankmail</option>
                    <option value="herinnering">Herinnering</option>
                  </select>
                </div>
              </div>

              {loadingMailTemplates ? (
                <div className="text-center py-8 text-gray-500">
                  <p>Templates laden...</p>
                </div>
              ) : (
                <>
                  {/* Create new mail template form */}
                  {isCreatingMailTemplate && (
                    <div className="bg-white border-2 border-blue-500 rounded-lg p-4 mb-4">
                      <h4 className="font-semibold mb-3">
                        Nieuwe Mail Template (School-breed)
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Naam *
                          </label>
                          <input
                            type="text"
                            value={mailFormData.name || ""}
                            onChange={(e) =>
                              setMailFormData({
                                ...mailFormData,
                                name: e.target.value,
                              })
                            }
                            placeholder="bijv. Opvolgmail volgend schooljaar"
                            className="w-full px-3 py-2 border rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Type
                          </label>
                          <select
                            value={mailFormData.type || "opvolgmail"}
                            onChange={(e) =>
                              setMailFormData({
                                ...mailFormData,
                                type: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border rounded"
                          >
                            <option value="opvolgmail">Opvolgmail</option>
                            <option value="startproject">Start project</option>
                            <option value="tussenpresentatie">
                              Tussenpresentatie
                            </option>
                            <option value="eindpresentatie">
                              Eindpresentatie
                            </option>
                            <option value="bedankmail">Bedankmail</option>
                            <option value="herinnering">Herinnering</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Onderwerp *
                          </label>
                          <input
                            type="text"
                            value={mailFormData.subject || ""}
                            onChange={(e) =>
                              setMailFormData({
                                ...mailFormData,
                                subject: e.target.value,
                              })
                            }
                            placeholder="bijv. Samenwerking schooljaar {schoolYear}"
                            className="w-full px-3 py-2 border rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Inhoud *
                          </label>
                          <textarea
                            value={mailFormData.body || ""}
                            onChange={(e) =>
                              setMailFormData({
                                ...mailFormData,
                                body: e.target.value,
                              })
                            }
                            placeholder="Beste opdrachtgever,&#10;&#10;Het schooljaar {schoolYear} staat voor de deur..."
                            className="w-full px-3 py-2 border rounded font-mono text-sm"
                            rows={8}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="is_active_global"
                            checked={mailFormData.is_active ?? true}
                            onChange={(e) =>
                              setMailFormData({
                                ...mailFormData,
                                is_active: e.target.checked,
                              })
                            }
                            className="rounded"
                          />
                          <label htmlFor="is_active_global" className="text-sm">
                            Actief (zichtbaar in dropdowns)
                          </label>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={handleCreateMailTemplate}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Opslaan
                          </button>
                          <button
                            onClick={() => setIsCreatingMailTemplate(false)}
                            className="px-4 py-2 border rounded hover:bg-gray-50"
                          >
                            Annuleren
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Table of mail templates */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                            onClick={() =>
                              setMailSort({
                                key: "typeName",
                                dir:
                                  mailSort.key === "typeName" &&
                                  mailSort.dir === "asc"
                                    ? "desc"
                                    : "asc",
                              })
                            }
                          >
                            Type{" "}
                            {mailSort.key === "typeName" &&
                              (mailSort.dir === "asc" ? "↑" : "↓")}
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 w-64"
                            onClick={() =>
                              setMailSort({
                                key: "name",
                                dir:
                                  mailSort.key === "name" && mailSort.dir === "asc"
                                    ? "desc"
                                    : "asc",
                              })
                            }
                          >
                            Naam{" "}
                            {mailSort.key === "name" &&
                              (mailSort.dir === "asc" ? "↑" : "↓")}
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                            onClick={() =>
                              setMailSort({
                                key: "subject",
                                dir:
                                  mailSort.key === "subject" &&
                                  mailSort.dir === "asc"
                                    ? "desc"
                                    : "asc",
                              })
                            }
                          >
                            Onderwerp{" "}
                            {mailSort.key === "subject" &&
                              (mailSort.dir === "asc" ? "↑" : "↓")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Acties
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredAndSortedMailTemplates.map((row) => (
                          <tr
                            key={row.id}
                            className="hover:bg-gray-50"
                          >
                            <td className="px-6 py-4 text-sm">
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {row.typeName}
                              </span>
                              {!row.is_active && (
                                <span className="ml-1 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                  Inactief
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold w-64">
                              {row.name}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {row.subject}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => openMailEditModal(row)}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  Bewerken
                                </button>
                                <button
                                  onClick={() => handleDeleteMailTemplate(row.id)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  Verwijderen
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {filteredAndSortedMailTemplates.length === 0 &&
                    !isCreatingMailTemplate && (
                      <div className="text-center py-8 text-gray-500">
                        {mailTemplates.length === 0 ? (
                          <>
                            <p className="mb-4">
                              Nog geen school-brede mail templates aangemaakt.
                            </p>
                            <p className="text-xs">
                              Klik op &quot;+ Nieuwe Mail-template&quot; om te
                              beginnen.
                            </p>
                          </>
                        ) : (
                          <p>
                            Geen templates gevonden voor het geselecteerde type.
                          </p>
                        )}
                      </div>
                    )}
                </>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (!selectedSubjectId) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              Geen sectie geselecteerd
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Kies eerst een sectie/vakgebied om templates te beheren.
            </p>
          </div>
        </div>
      );
    }

    const selectedSubject = subjects.find(
      (s: Subject) => s.id === selectedSubjectId,
    );

    return (
      <div className="p-6">
        {/* Tab-specific content */}
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {TABS.find((t) => t.key === activeTab)?.label}
        </h3>

        {activeTab === "peer" && (
          <div className="space-y-4">
            {/* Title and description */}
            <div>
              <p className="text-sm text-slate-600 mt-1">
                Alle criteria in één overzicht.
              </p>
            </div>

            {/* Filters above the table */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Niveau filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">Niveau:</span>
                {[
                  { id: "all", label: "Alle" },
                  { id: "onderbouw", label: "Onderbouw" },
                  { id: "bovenbouw", label: "Bovenbouw" },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() =>
                      setSelectedPeerLevelFilter(
                        filter.id as "all" | "onderbouw" | "bovenbouw",
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      selectedPeerLevelFilter === filter.id
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {/* Categorie filter */}
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>Categorie:</span>
                <select
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                  value={activePeerCategory}
                  onChange={(e) =>
                    setActivePeerCategory(
                      e.target.value as
                        | "all"
                        | "organiseren"
                        | "meedoen"
                        | "zelfvertrouwen"
                        | "autonomie",
                    )
                  }
                >
                  <option value="all">Alle</option>
                  <option value="organiseren">Organiseren</option>
                  <option value="meedoen">Meedoen</option>
                  <option value="zelfvertrouwen">Zelfvertrouwen</option>
                  <option value="autonomie">Autonomie</option>
                </select>
              </div>
            </div>

            {loadingPeerCriteria ? (
              <div className="text-center py-8 text-gray-500">
                <p>Criteria laden...</p>
              </div>
            ) : (
              <>
                {/* Create new criterion form */}
                {isCreatingPeerCriterion && (
                  <div className="bg-white border-2 border-blue-500 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold mb-3">Nieuw Criterium</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          OMZA Categorie
                        </label>
                        <select
                          value={peerFormData.omza_category}
                          onChange={(e) =>
                            setPeerFormData({
                              ...peerFormData,
                              omza_category: e.target.value as
                                | "organiseren"
                                | "meedoen"
                                | "zelfvertrouwen"
                                | "autonomie",
                            })
                          }
                          className="w-full px-3 py-2 border rounded"
                        >
                          <option value="organiseren">Organiseren</option>
                          <option value="meedoen">Meedoen</option>
                          <option value="zelfvertrouwen">Zelfvertrouwen</option>
                          <option value="autonomie">Autonomie</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Niveau (Onderbouw/Bovenbouw)
                        </label>
                        <select
                          value={peerFormData.target_level || ""}
                          onChange={(e) =>
                            setPeerFormData({
                              ...peerFormData,
                              target_level: e.target.value
                                ? (e.target.value as "onderbouw" | "bovenbouw")
                                : null,
                            })
                          }
                          className="w-full px-3 py-2 border rounded"
                        >
                          <option value="">Geen specifiek niveau</option>
                          <option value="onderbouw">Onderbouw</option>
                          <option value="bovenbouw">Bovenbouw</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Titel *
                        </label>
                        <input
                          type="text"
                          value={peerFormData.title}
                          onChange={(e) =>
                            setPeerFormData({
                              ...peerFormData,
                              title: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Beschrijving
                        </label>
                        <textarea
                          value={peerFormData.description || ""}
                          onChange={(e) =>
                            setPeerFormData({
                              ...peerFormData,
                              description: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border rounded"
                          rows={2}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Niveaubeschrijvingen (1-5)
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <div key={level} className="flex flex-col">
                              <label className="text-xs font-medium text-gray-700 mb-1">
                                Niveau {level}
                              </label>
                              <textarea
                                placeholder={`Niveau ${level}`}
                                value={
                                  peerFormData.level_descriptors?.[
                                    level.toString() as
                                      | "1"
                                      | "2"
                                      | "3"
                                      | "4"
                                      | "5"
                                  ] || ""
                                }
                                onChange={(e) =>
                                  setPeerFormData({
                                    ...peerFormData,
                                    level_descriptors: {
                                      ...peerFormData.level_descriptors,
                                      [level.toString()]: e.target.value,
                                    } as typeof peerFormData.level_descriptors,
                                  })
                                }
                                className="w-full px-2 py-1 border rounded text-sm resize-y min-h-[80px]"
                                rows={4}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Leerdoelen koppelen
                        </label>
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setPeerFormData({
                                  ...peerFormData,
                                  _filterPhase: "onderbouw",
                                })
                              }
                              className={`px-3 py-1 text-sm rounded ${
                                peerFormData._filterPhase === "onderbouw"
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                              }`}
                            >
                              Onderbouw
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setPeerFormData({
                                  ...peerFormData,
                                  _filterPhase: "bovenbouw",
                                })
                              }
                              className={`px-3 py-1 text-sm rounded ${
                                peerFormData._filterPhase === "bovenbouw"
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                              }`}
                            >
                              Bovenbouw
                            </button>
                          </div>
                          {peerFormData._filterPhase && (
                            <select
                              value=""
                              onChange={(e) => {
                                const id = parseInt(e.target.value);
                                const currentIds =
                                  peerFormData.learning_objective_ids || [];
                                if (id && !currentIds.includes(id)) {
                                  setPeerFormData({
                                    ...peerFormData,
                                    learning_objective_ids: [...currentIds, id],
                                  });
                                }
                              }}
                              className="w-full px-3 py-2 border rounded"
                            >
                              <option value="">
                                Selecteer een leerdoel...
                              </option>
                              {learningObjectives
                                .filter(
                                  (obj) =>
                                    obj.phase === peerFormData._filterPhase,
                                )
                                .map((obj) => (
                                  <option key={obj.id} value={obj.id}>
                                    {obj.domain || ""} {obj.order} - {obj.title}
                                  </option>
                                ))}
                            </select>
                          )}
                          {(peerFormData.learning_objective_ids?.length ?? 0) >
                            0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {(peerFormData.learning_objective_ids || []).map(
                                (id) => {
                                  const obj = learningObjectives.find(
                                    (o) => o.id === id,
                                  );
                                  return (
                                    <span
                                      key={id}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                                    >
                                      {obj
                                        ? `${obj.domain || ""} ${obj.order} - ${obj.title}`
                                        : `ID: ${id}`}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setPeerFormData({
                                            ...peerFormData,
                                            learning_objective_ids: (
                                              peerFormData.learning_objective_ids ||
                                              []
                                            ).filter((objId) => objId !== id),
                                          })
                                        }
                                        className="text-blue-600 hover:text-blue-800"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  );
                                },
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={handleCreatePeerCriterion}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Opslaan
                        </button>
                        <button
                          onClick={() => setIsCreatingPeerCriterion(false)}
                          className="px-4 py-2 border rounded hover:bg-gray-50"
                        >
                          Annuleren
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Table of criteria */}
                <table className="w-full table-fixed text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b">
                      <th
                        className="w-32 py-2 cursor-pointer hover:text-slate-700"
                        onClick={() =>
                          setPeerSort({
                            key: "categoryName",
                            dir:
                              peerSort.key === "categoryName" &&
                              peerSort.dir === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Categorie{" "}
                        {peerSort.key === "categoryName" &&
                          (peerSort.dir === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        className="w-40 cursor-pointer hover:text-slate-700"
                        onClick={() =>
                          setPeerSort({
                            key: "title",
                            dir:
                              peerSort.key === "title" && peerSort.dir === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Naam{" "}
                        {peerSort.key === "title" &&
                          (peerSort.dir === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        className="w-24 cursor-pointer hover:text-slate-700"
                        onClick={() =>
                          setPeerSort({
                            key: "target_level",
                            dir:
                              peerSort.key === "target_level" &&
                              peerSort.dir === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Niveau{" "}
                        {peerSort.key === "target_level" &&
                          (peerSort.dir === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="w-auto">Beschrijving</th>
                      <th
                        className="w-24 text-center cursor-pointer hover:text-slate-700"
                        onClick={() =>
                          setPeerSort({
                            key: "learningObjectivesCount",
                            dir:
                              peerSort.key === "learningObjectivesCount" &&
                              peerSort.dir === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Leerdoelen{" "}
                        {peerSort.key === "learningObjectivesCount" &&
                          (peerSort.dir === "asc" ? "↑" : "↓")}
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {filteredAndSortedPeerCriteria.map((row) => {
                      const isOpen = expandedCriterion === row.id;

                      return [
                        <tr
                          key={row.id}
                          className="hover:bg-slate-50 cursor-pointer"
                          onClick={() => toggleCriterionExpand(row.id)}
                        >
                          <td className="w-32 py-3 font-bold text-slate-900">
                            {row.categoryName}
                          </td>
                          <td className="w-40 py-3">{row.title}</td>
                          <td className="w-24">
                            {row.target_level ? (
                              <span className="inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 whitespace-nowrap">
                                {row.target_level === "onderbouw"
                                  ? "Onderbouw"
                                  : "Bovenbouw"}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="text-slate-600 truncate max-w-xl">
                            {row.description || "-"}
                          </td>
                          <td className="w-24 text-slate-500 text-center">
                            {row.learningObjectivesCount}
                          </td>
                        </tr>,
                        isOpen && (
                          <tr
                            key={`${row.id}-expanded`}
                            className="bg-slate-50"
                          >
                            <td colSpan={5} className="p-4">
                              {editingCriterion === row.id ? (
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-sm font-medium mb-1">
                                      Titel
                                    </label>
                                    <input
                                      type="text"
                                      defaultValue={row.title}
                                      id={`edit-title-${row.id}`}
                                      className="w-full px-3 py-2 border rounded"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-2">
                                      Niveaubeschrijvingen
                                    </label>
                                    <div className="grid grid-cols-5 gap-2">
                                      {[1, 2, 3, 4, 5].map((level) => (
                                        <div
                                          key={level}
                                          className="flex flex-col"
                                        >
                                          <label className="text-xs font-medium text-gray-700 mb-1">
                                            Niveau {level}
                                          </label>
                                          <textarea
                                            defaultValue={
                                              row.level_descriptors[
                                                level.toString() as
                                                  | "1"
                                                  | "2"
                                                  | "3"
                                                  | "4"
                                                  | "5"
                                              ] || ""
                                            }
                                            id={`edit-level-${row.id}-${level}`}
                                            className="w-full px-2 py-1 border rounded text-sm resize-y min-h-[80px]"
                                            rows={4}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-2">
                                      Leerdoelen koppelen
                                    </label>
                                    <div className="space-y-2">
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setEditFilterPhase("onderbouw")
                                          }
                                          className={`px-3 py-1 text-sm rounded ${
                                            editFilterPhase === "onderbouw"
                                              ? "bg-blue-600 text-white"
                                              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                          }`}
                                        >
                                          Onderbouw
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setEditFilterPhase("bovenbouw")
                                          }
                                          className={`px-3 py-1 text-sm rounded ${
                                            editFilterPhase === "bovenbouw"
                                              ? "bg-blue-600 text-white"
                                              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                          }`}
                                        >
                                          Bovenbouw
                                        </button>
                                      </div>
                                      {editFilterPhase && (
                                        <select
                                          value=""
                                          onChange={(e) => {
                                            const id = parseInt(e.target.value);
                                            if (
                                              id &&
                                              !editLearningObjectiveIds.includes(
                                                id,
                                              )
                                            ) {
                                              setEditLearningObjectiveIds([
                                                ...editLearningObjectiveIds,
                                                id,
                                              ]);
                                            }
                                          }}
                                          className="w-full px-3 py-2 border rounded"
                                        >
                                          <option value="">
                                            Selecteer een leerdoel...
                                          </option>
                                          {learningObjectives
                                            .filter(
                                              (obj) =>
                                                obj.phase === editFilterPhase,
                                            )
                                            .map((obj) => (
                                              <option
                                                key={obj.id}
                                                value={obj.id}
                                              >
                                                {obj.domain || ""} {obj.order} -{" "}
                                                {obj.title}
                                              </option>
                                            ))}
                                        </select>
                                      )}
                                      {editLearningObjectiveIds.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                          {editLearningObjectiveIds.map(
                                            (id) => {
                                              const obj =
                                                learningObjectives.find(
                                                  (o) => o.id === id,
                                                );
                                              return (
                                                <span
                                                  key={id}
                                                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                                                >
                                                  {obj
                                                    ? `${obj.domain || ""} ${obj.order} - ${obj.title}`
                                                    : `ID: ${id}`}
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setEditLearningObjectiveIds(
                                                        editLearningObjectiveIds.filter(
                                                          (objId) =>
                                                            objId !== id,
                                                        ),
                                                      )
                                                    }
                                                    className="text-blue-600 hover:text-blue-800"
                                                  >
                                                    ×
                                                  </button>
                                                </span>
                                              );
                                            },
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        const titleEl = document.getElementById(
                                          `edit-title-${row.id}`,
                                        ) as HTMLInputElement;
                                        const levels: {
                                          "1": string;
                                          "2": string;
                                          "3": string;
                                          "4": string;
                                          "5": string;
                                        } = {
                                          "1": "",
                                          "2": "",
                                          "3": "",
                                          "4": "",
                                          "5": "",
                                        };
                                        ([1, 2, 3, 4, 5] as const).forEach(
                                          (level) => {
                                            const el = document.getElementById(
                                              `edit-level-${row.id}-${level}`,
                                            ) as HTMLInputElement;
                                            levels[
                                              level.toString() as
                                                | "1"
                                                | "2"
                                                | "3"
                                                | "4"
                                                | "5"
                                            ] = el.value;
                                          },
                                        );
                                        handleUpdatePeerCriterion(row.id, {
                                          title: titleEl.value,
                                          level_descriptors: levels,
                                          learning_objective_ids:
                                            editLearningObjectiveIds,
                                        });
                                      }}
                                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                    >
                                      Opslaan
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingCriterion(null);
                                        setEditFilterPhase(undefined);
                                        setEditLearningObjectiveIds([]);
                                      }}
                                      className="px-3 py-1.5 border text-sm rounded hover:bg-gray-100"
                                    >
                                      Annuleren
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="text-xs font-medium text-slate-700 mb-2">
                                    Niveaubeschrijvingen (1–5)
                                  </div>
                                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                                    {[1, 2, 3, 4, 5].map((level) => (
                                      <div
                                        key={level}
                                        className="flex min-h-[80px] flex-col rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-inner"
                                      >
                                        <span className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                                          Niveau {level}
                                        </span>
                                        <p className="text-[11px] text-slate-700">
                                          {row.level_descriptors[
                                            level.toString() as
                                              | "1"
                                              | "2"
                                              | "3"
                                              | "4"
                                              | "5"
                                          ] || (
                                            <em className="text-slate-400">
                                              Niet ingevuld
                                            </em>
                                          )}
                                        </p>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="mt-4 flex justify-between text-xs">
                                    <span className="text-slate-500">
                                      {row.learningObjectivesCount > 0
                                        ? `${row.learningObjectivesCount} leerdoel(en) gekoppeld`
                                        : "Geen leerdoelen gekoppeld"}
                                    </span>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingCriterion(row.id);
                                          setEditLearningObjectiveIds(
                                            row.learning_objective_ids || [],
                                          );
                                          setEditFilterPhase(undefined);
                                        }}
                                        className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px]"
                                      >
                                        Bewerken
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeletePeerCriterion(row.id);
                                        }}
                                        className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] text-red-700"
                                      >
                                        Verwijderen
                                      </button>
                                    </div>
                                  </div>
                                </>
                              )}
                            </td>
                          </tr>
                        ),
                      ];
                    })}
                  </tbody>
                </table>

                {filteredAndSortedPeerCriteria.length === 0 &&
                  !isCreatingPeerCriterion && (
                    <div className="text-center py-8 text-gray-500">
                      {peerCriteria.length === 0 ? (
                        <>
                          <p>Nog geen criteria aangemaakt voor dit vak.</p>
                          <p className="text-xs mt-2">
                            Klik op &quot;+ Nieuw Peerevaluatie Criterium&quot;
                            om te beginnen.
                          </p>
                        </>
                      ) : (
                        <p>
                          Geen criteria gevonden voor de geselecteerde filters.
                        </p>
                      )}
                    </div>
                  )}
              </>
            )}
          </div>
        )}

        {activeTab === "rubrics" && (
          <div className="space-y-4">
            {/* Title and description */}
            <div>
              <p className="text-sm text-slate-600 mt-1">
                Alle criteria in één overzicht.
              </p>
            </div>

            {/* Filters above the table */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Niveau filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">Niveau:</span>
                {[
                  { id: "all", label: "Alle" },
                  { id: "onderbouw", label: "Onderbouw" },
                  { id: "bovenbouw", label: "Bovenbouw" },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() =>
                      setSelectedProjectLevelFilter(
                        filter.id as "all" | "onderbouw" | "bovenbouw",
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      selectedProjectLevelFilter === filter.id
                        ? "border-green-600 bg-green-50 text-green-700"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {/* Categorie filter */}
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>Categorie:</span>
                <select
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                  value={activeProjectCategory}
                  onChange={(e) =>
                    setActiveProjectCategory(
                      e.target.value as
                        | "all"
                        | "projectproces"
                        | "eindresultaat"
                        | "communicatie",
                    )
                  }
                >
                  <option value="all">Alle</option>
                  <option value="projectproces">Projectproces</option>
                  <option value="eindresultaat">Eindresultaat</option>
                  <option value="communicatie">Communicatie</option>
                </select>
              </div>
            </div>

            {loadingProjectCriteria ? (
              <div className="text-center py-8 text-gray-500">
                <p>Criteria laden...</p>
              </div>
            ) : (
              <>
                {/* Create new criterion form */}
                {isCreatingProjectCriterion && (
                  <div className="bg-white border-2 border-green-500 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold mb-3">Nieuw Criterium</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Categorie
                        </label>
                        <select
                          value={projectFormData.category}
                          onChange={(e) =>
                            setProjectFormData({
                              ...projectFormData,
                              category: e.target.value as
                                | "projectproces"
                                | "eindresultaat"
                                | "communicatie",
                            })
                          }
                          className="w-full px-3 py-2 border rounded"
                        >
                          <option value="projectproces">Projectproces</option>
                          <option value="eindresultaat">Eindresultaat</option>
                          <option value="communicatie">Communicatie</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Niveau (Onderbouw/Bovenbouw)
                        </label>
                        <select
                          value={projectFormData.target_level || ""}
                          onChange={(e) =>
                            setProjectFormData({
                              ...projectFormData,
                              target_level: e.target.value
                                ? (e.target.value as "onderbouw" | "bovenbouw")
                                : null,
                            })
                          }
                          className="w-full px-3 py-2 border rounded"
                        >
                          <option value="">Geen specifiek niveau</option>
                          <option value="onderbouw">Onderbouw</option>
                          <option value="bovenbouw">Bovenbouw</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Titel *
                        </label>
                        <input
                          type="text"
                          value={projectFormData.title}
                          onChange={(e) =>
                            setProjectFormData({
                              ...projectFormData,
                              title: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Beschrijving
                        </label>
                        <textarea
                          value={projectFormData.description || ""}
                          onChange={(e) =>
                            setProjectFormData({
                              ...projectFormData,
                              description: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border rounded"
                          rows={2}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Niveaubeschrijvingen (1-5)
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <div key={level} className="flex flex-col">
                              <label className="text-xs font-medium text-gray-700 mb-1">
                                Niveau {level}
                              </label>
                              <textarea
                                placeholder={`Niveau ${level}`}
                                value={
                                  projectFormData.level_descriptors?.[
                                    level.toString() as
                                      | "1"
                                      | "2"
                                      | "3"
                                      | "4"
                                      | "5"
                                  ] || ""
                                }
                                onChange={(e) =>
                                  setProjectFormData({
                                    ...projectFormData,
                                    level_descriptors: {
                                      ...projectFormData.level_descriptors,
                                      [level.toString()]: e.target.value,
                                    } as typeof projectFormData.level_descriptors,
                                  })
                                }
                                className="w-full px-2 py-1 border rounded text-sm resize-y min-h-[80px]"
                                rows={4}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Leerdoelen koppelen
                        </label>
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setProjectFormData({
                                  ...projectFormData,
                                  _filterPhase: "onderbouw",
                                })
                              }
                              className={`px-3 py-1 text-sm rounded ${
                                projectFormData._filterPhase === "onderbouw"
                                  ? "bg-green-600 text-white"
                                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                              }`}
                            >
                              Onderbouw
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setProjectFormData({
                                  ...projectFormData,
                                  _filterPhase: "bovenbouw",
                                })
                              }
                              className={`px-3 py-1 text-sm rounded ${
                                projectFormData._filterPhase === "bovenbouw"
                                  ? "bg-green-600 text-white"
                                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                              }`}
                            >
                              Bovenbouw
                            </button>
                          </div>
                          {projectFormData._filterPhase && (
                            <select
                              value=""
                              onChange={(e) => {
                                const id = parseInt(e.target.value);
                                const currentIds =
                                  projectFormData.learning_objective_ids || [];
                                if (id && !currentIds.includes(id)) {
                                  setProjectFormData({
                                    ...projectFormData,
                                    learning_objective_ids: [...currentIds, id],
                                  });
                                }
                              }}
                              className="w-full px-3 py-2 border rounded"
                            >
                              <option value="">
                                Selecteer een leerdoel...
                              </option>
                              {learningObjectives
                                .filter(
                                  (obj) =>
                                    obj.phase === projectFormData._filterPhase,
                                )
                                .map((obj) => (
                                  <option key={obj.id} value={obj.id}>
                                    {obj.domain || ""} {obj.order} - {obj.title}
                                  </option>
                                ))}
                            </select>
                          )}
                          {(projectFormData.learning_objective_ids?.length ??
                            0) > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {(
                                projectFormData.learning_objective_ids || []
                              ).map((id) => {
                                const obj = learningObjectives.find(
                                  (o) => o.id === id,
                                );
                                return (
                                  <span
                                    key={id}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded"
                                  >
                                    {obj
                                      ? `${obj.domain || ""} ${obj.order} - ${obj.title}`
                                      : `ID: ${id}`}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setProjectFormData({
                                          ...projectFormData,
                                          learning_objective_ids: (
                                            projectFormData.learning_objective_ids ||
                                            []
                                          ).filter((objId) => objId !== id),
                                        })
                                      }
                                      className="text-green-600 hover:text-green-800"
                                    >
                                      ×
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={handleCreateProjectCriterion}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Opslaan
                        </button>
                        <button
                          onClick={() => setIsCreatingProjectCriterion(false)}
                          className="px-4 py-2 border rounded hover:bg-gray-50"
                        >
                          Annuleren
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Table of criteria */}
                <table className="w-full table-fixed text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b">
                      <th
                        className="w-32 py-2 cursor-pointer hover:text-slate-700"
                        onClick={() =>
                          setProjectSort({
                            key: "categoryName",
                            dir:
                              projectSort.key === "categoryName" &&
                              projectSort.dir === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Categorie{" "}
                        {projectSort.key === "categoryName" &&
                          (projectSort.dir === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        className="w-40 cursor-pointer hover:text-slate-700"
                        onClick={() =>
                          setProjectSort({
                            key: "title",
                            dir:
                              projectSort.key === "title" &&
                              projectSort.dir === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Naam{" "}
                        {projectSort.key === "title" &&
                          (projectSort.dir === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        className="w-24 cursor-pointer hover:text-slate-700"
                        onClick={() =>
                          setProjectSort({
                            key: "target_level",
                            dir:
                              projectSort.key === "target_level" &&
                              projectSort.dir === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Niveau{" "}
                        {projectSort.key === "target_level" &&
                          (projectSort.dir === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="w-auto">Beschrijving</th>
                      <th
                        className="w-24 text-center cursor-pointer hover:text-slate-700"
                        onClick={() =>
                          setProjectSort({
                            key: "learningObjectivesCount",
                            dir:
                              projectSort.key === "learningObjectivesCount" &&
                              projectSort.dir === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Leerdoelen{" "}
                        {projectSort.key === "learningObjectivesCount" &&
                          (projectSort.dir === "asc" ? "↑" : "↓")}
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {filteredAndSortedProjectCriteria.map((row) => {
                      const isOpen = expandedProjectCriterion === row.id;

                      return [
                        <tr
                          key={row.id}
                          className="hover:bg-slate-50 cursor-pointer"
                          onClick={() => toggleProjectCriterionExpand(row.id)}
                        >
                          <td className="w-32 py-3 font-bold text-slate-900">
                            {row.categoryName}
                          </td>
                          <td className="w-40 py-3">{row.title}</td>
                          <td className="w-24">
                            {row.target_level ? (
                              <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 whitespace-nowrap">
                                {row.target_level === "onderbouw"
                                  ? "Onderbouw"
                                  : "Bovenbouw"}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="text-slate-600 truncate max-w-xl">
                            {row.description || "-"}
                          </td>
                          <td className="w-24 text-slate-500 text-center">
                            {row.learningObjectivesCount}
                          </td>
                        </tr>,
                        isOpen && (
                          <tr
                            key={`${row.id}-expanded`}
                            className="bg-slate-50"
                          >
                            <td colSpan={5} className="p-4">
                              {editingProjectCriterion === row.id ? (
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-sm font-medium mb-1">
                                      Titel
                                    </label>
                                    <input
                                      type="text"
                                      defaultValue={row.title}
                                      id={`edit-project-title-${row.id}`}
                                      className="w-full px-3 py-2 border rounded"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-2">
                                      Niveaubeschrijvingen
                                    </label>
                                    <div className="grid grid-cols-5 gap-2">
                                      {[1, 2, 3, 4, 5].map((level) => (
                                        <div
                                          key={level}
                                          className="flex flex-col"
                                        >
                                          <label className="text-xs font-medium text-gray-700 mb-1">
                                            Niveau {level}
                                          </label>
                                          <textarea
                                            defaultValue={
                                              row.level_descriptors[
                                                level.toString() as
                                                  | "1"
                                                  | "2"
                                                  | "3"
                                                  | "4"
                                                  | "5"
                                              ] || ""
                                            }
                                            id={`edit-project-level-${row.id}-${level}`}
                                            className="w-full px-2 py-1 border rounded text-sm resize-y min-h-[80px]"
                                            rows={4}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-2">
                                      Leerdoelen koppelen
                                    </label>
                                    <div className="space-y-2">
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setEditProjectFilterPhase(
                                              "onderbouw",
                                            )
                                          }
                                          className={`px-3 py-1 text-sm rounded ${
                                            editProjectFilterPhase ===
                                            "onderbouw"
                                              ? "bg-green-600 text-white"
                                              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                          }`}
                                        >
                                          Onderbouw
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setEditProjectFilterPhase(
                                              "bovenbouw",
                                            )
                                          }
                                          className={`px-3 py-1 text-sm rounded ${
                                            editProjectFilterPhase ===
                                            "bovenbouw"
                                              ? "bg-green-600 text-white"
                                              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                          }`}
                                        >
                                          Bovenbouw
                                        </button>
                                      </div>
                                      {editProjectFilterPhase && (
                                        <select
                                          value=""
                                          onChange={(e) => {
                                            const id = parseInt(e.target.value);
                                            if (
                                              id &&
                                              !editProjectLearningObjectiveIds.includes(
                                                id,
                                              )
                                            ) {
                                              setEditProjectLearningObjectiveIds(
                                                [
                                                  ...editProjectLearningObjectiveIds,
                                                  id,
                                                ],
                                              );
                                            }
                                          }}
                                          className="w-full px-3 py-2 border rounded"
                                        >
                                          <option value="">
                                            Selecteer een leerdoel...
                                          </option>
                                          {learningObjectives
                                            .filter(
                                              (obj) =>
                                                obj.phase ===
                                                editProjectFilterPhase,
                                            )
                                            .map((obj) => (
                                              <option
                                                key={obj.id}
                                                value={obj.id}
                                              >
                                                {obj.domain || ""} {obj.order} -{" "}
                                                {obj.title}
                                              </option>
                                            ))}
                                        </select>
                                      )}
                                      {editProjectLearningObjectiveIds.length >
                                        0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                          {editProjectLearningObjectiveIds.map(
                                            (id) => {
                                              const obj =
                                                learningObjectives.find(
                                                  (o) => o.id === id,
                                                );
                                              return (
                                                <span
                                                  key={id}
                                                  className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded"
                                                >
                                                  {obj
                                                    ? `${obj.domain || ""} ${obj.order} - ${obj.title}`
                                                    : `ID: ${id}`}
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setEditProjectLearningObjectiveIds(
                                                        editProjectLearningObjectiveIds.filter(
                                                          (objId) =>
                                                            objId !== id,
                                                        ),
                                                      )
                                                    }
                                                    className="text-green-600 hover:text-green-800"
                                                  >
                                                    ×
                                                  </button>
                                                </span>
                                              );
                                            },
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        const titleEl = document.getElementById(
                                          `edit-project-title-${row.id}`,
                                        ) as HTMLInputElement;
                                        const levels: {
                                          "1": string;
                                          "2": string;
                                          "3": string;
                                          "4": string;
                                          "5": string;
                                        } = {
                                          "1": "",
                                          "2": "",
                                          "3": "",
                                          "4": "",
                                          "5": "",
                                        };
                                        ([1, 2, 3, 4, 5] as const).forEach(
                                          (level) => {
                                            const el = document.getElementById(
                                              `edit-project-level-${row.id}-${level}`,
                                            ) as HTMLInputElement;
                                            levels[
                                              level.toString() as
                                                | "1"
                                                | "2"
                                                | "3"
                                                | "4"
                                                | "5"
                                            ] = el.value;
                                          },
                                        );
                                        handleUpdateProjectCriterion(row.id, {
                                          title: titleEl.value,
                                          level_descriptors: levels,
                                          learning_objective_ids:
                                            editProjectLearningObjectiveIds,
                                        });
                                      }}
                                      className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                                    >
                                      Opslaan
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingProjectCriterion(null);
                                        setEditProjectFilterPhase(undefined);
                                        setEditProjectLearningObjectiveIds([]);
                                      }}
                                      className="px-3 py-1.5 border text-sm rounded hover:bg-gray-100"
                                    >
                                      Annuleren
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="text-xs font-medium text-slate-700 mb-2">
                                    Niveaubeschrijvingen (1–5)
                                  </div>
                                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                                    {[1, 2, 3, 4, 5].map((level) => (
                                      <div
                                        key={level}
                                        className="flex min-h-[80px] flex-col rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-inner"
                                      >
                                        <span className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                                          Niveau {level}
                                        </span>
                                        <p className="text-[11px] text-slate-700">
                                          {row.level_descriptors[
                                            level.toString() as
                                              | "1"
                                              | "2"
                                              | "3"
                                              | "4"
                                              | "5"
                                          ] || (
                                            <em className="text-slate-400">
                                              Niet ingevuld
                                            </em>
                                          )}
                                        </p>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="mt-4 flex justify-between text-xs">
                                    <span className="text-slate-500">
                                      {row.learningObjectivesCount > 0
                                        ? `${row.learningObjectivesCount} leerdoel(en) gekoppeld`
                                        : "Geen leerdoelen gekoppeld"}
                                    </span>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingProjectCriterion(row.id);
                                          setEditProjectLearningObjectiveIds(
                                            row.learning_objective_ids || [],
                                          );
                                          setEditProjectFilterPhase(undefined);
                                        }}
                                        className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px]"
                                      >
                                        Bewerken
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteProjectCriterion(row.id);
                                        }}
                                        className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] text-red-700"
                                      >
                                        Verwijderen
                                      </button>
                                    </div>
                                  </div>
                                </>
                              )}
                            </td>
                          </tr>
                        ),
                      ];
                    })}
                  </tbody>
                </table>

                {filteredAndSortedProjectCriteria.length === 0 &&
                  !isCreatingProjectCriterion && (
                    <div className="text-center py-8 text-gray-500">
                      {projectCriteria.length === 0 ? (
                        <>
                          <p>Nog geen criteria aangemaakt voor dit vak.</p>
                          <p className="text-xs mt-2">
                            Klik op &quot;+ Nieuw Projectbeoordeling
                            Criterium&quot; om te beginnen.
                          </p>
                        </>
                      ) : (
                        <p>
                          Geen criteria gevonden voor de geselecteerde filters.
                        </p>
                      )}
                    </div>
                  )}
              </>
            )}
          </div>
        )}

        {activeTab === "mail" && (
          <div className="space-y-4">
            {/* Title and description */}
            <div>
              <p className="text-sm text-slate-600 mt-1">
                Beheer email templates met variabelen voor verschillende communicatiemomenten.
              </p>
            </div>

            {/* Filters above the table */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Type filter */}
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>Type:</span>
                <select
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                  value={selectedMailTypeFilter}
                  onChange={(e) => setSelectedMailTypeFilter(e.target.value)}
                >
                  <option value="all">Alle</option>
                  <option value="opvolgmail">Opvolgmail</option>
                  <option value="startproject">Start project</option>
                  <option value="tussenpresentatie">Tussenpresentatie</option>
                  <option value="eindpresentatie">Eindpresentatie</option>
                  <option value="bedankmail">Bedankmail</option>
                  <option value="herinnering">Herinnering</option>
                </select>
              </div>
            </div>

            {loadingMailTemplates ? (
              <div className="text-center py-8 text-gray-500">
                <p>Templates laden...</p>
              </div>
            ) : (
              <>
                {/* Create new mail template form */}
                {isCreatingMailTemplate && (
                  <div className="bg-white border-2 border-blue-500 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold mb-3">Nieuwe Mail Template</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Naam *
                        </label>
                        <input
                          type="text"
                          value={mailFormData.name || ""}
                          onChange={(e) =>
                            setMailFormData({
                              ...mailFormData,
                              name: e.target.value,
                            })
                          }
                          placeholder="bijv. Opvolgmail volgend schooljaar"
                          className="w-full px-3 py-2 border rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Type
                        </label>
                        <select
                          value={mailFormData.type || "opvolgmail"}
                          onChange={(e) =>
                            setMailFormData({
                              ...mailFormData,
                              type: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border rounded"
                        >
                          <option value="opvolgmail">Opvolgmail</option>
                          <option value="startproject">Start project</option>
                          <option value="tussenpresentatie">
                            Tussenpresentatie
                          </option>
                          <option value="eindpresentatie">
                            Eindpresentatie
                          </option>
                          <option value="bedankmail">Bedankmail</option>
                          <option value="herinnering">Herinnering</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Onderwerp *
                        </label>
                        <input
                          type="text"
                          value={mailFormData.subject || ""}
                          onChange={(e) =>
                            setMailFormData({
                              ...mailFormData,
                              subject: e.target.value,
                            })
                          }
                          placeholder="bijv. Samenwerking schooljaar {schoolYear}"
                          className="w-full px-3 py-2 border rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Inhoud *
                        </label>
                        <textarea
                          value={mailFormData.body || ""}
                          onChange={(e) =>
                            setMailFormData({
                              ...mailFormData,
                              body: e.target.value,
                            })
                          }
                          placeholder="Beste opdrachtgever,&#10;&#10;Het schooljaar {schoolYear} staat voor de deur..."
                          className="w-full px-3 py-2 border rounded font-mono text-sm"
                          rows={8}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="is_active"
                          checked={mailFormData.is_active ?? true}
                          onChange={(e) =>
                            setMailFormData({
                              ...mailFormData,
                              is_active: e.target.checked,
                            })
                          }
                          className="rounded"
                        />
                        <label htmlFor="is_active" className="text-sm">
                          Actief (zichtbaar in dropdowns)
                        </label>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={handleCreateMailTemplate}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Opslaan
                        </button>
                        <button
                          onClick={() => setIsCreatingMailTemplate(false)}
                          className="px-4 py-2 border rounded hover:bg-gray-50"
                        >
                          Annuleren
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Table of mail templates */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                          onClick={() =>
                            setMailSort({
                              key: "typeName",
                              dir:
                                mailSort.key === "typeName" &&
                                mailSort.dir === "asc"
                                  ? "desc"
                                  : "asc",
                            })
                          }
                        >
                          Type{" "}
                          {mailSort.key === "typeName" &&
                            (mailSort.dir === "asc" ? "↑" : "↓")}
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 w-64"
                          onClick={() =>
                            setMailSort({
                              key: "name",
                              dir:
                                mailSort.key === "name" && mailSort.dir === "asc"
                                  ? "desc"
                                  : "asc",
                            })
                          }
                        >
                          Naam{" "}
                          {mailSort.key === "name" &&
                            (mailSort.dir === "asc" ? "↑" : "↓")}
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                          onClick={() =>
                            setMailSort({
                              key: "subject",
                              dir:
                                mailSort.key === "subject" &&
                                mailSort.dir === "asc"
                                  ? "desc"
                                  : "asc",
                            })
                          }
                        >
                          Onderwerp{" "}
                          {mailSort.key === "subject" &&
                            (mailSort.dir === "asc" ? "↑" : "↓")}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Acties
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredAndSortedMailTemplates.map((row) => (
                        <tr
                          key={row.id}
                          className="hover:bg-gray-50"
                        >
                          <td className="px-6 py-4 text-sm">
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {row.typeName}
                            </span>
                            {!row.is_active && (
                              <span className="ml-1 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                Inactief
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold w-64">
                            {row.name}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {row.subject}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex gap-2">
                              <button
                                onClick={() => openMailEditModal(row)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                Bewerken
                              </button>
                              <button
                                onClick={() => handleDeleteMailTemplate(row.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                Verwijderen
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredAndSortedMailTemplates.length === 0 &&
                  !isCreatingMailTemplate && (
                    <div className="text-center py-8 text-gray-500">
                      {mailTemplates.length === 0 ? (
                        <>
                          <p className="mb-4">
                            Nog geen mail templates aangemaakt
                            {selectedSubjectId ? " voor dit vak" : ""}.
                          </p>
                          <p className="text-xs">
                            Klik op &quot;+ Nieuwe Mail-template&quot; om te
                            beginnen.
                          </p>
                        </>
                      ) : (
                        <p>
                          Geen templates gevonden voor het geselecteerde type.
                        </p>
                      )}
                    </div>
                  )}
              </>
            )}
          </div>
        )}

        {activeTab === "objectives" && (
          <div className="space-y-4">
            {/* Info banner for admin */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-amber-500 text-xl">🏛️</span>
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">Centrale Leerdoelen</p>
                  <p>
                    Leerdoelen die hier worden aangemaakt zijn{" "}
                    <strong>centrale leerdoelen</strong> (gekoppeld aan de
                    geselecteerde sectie). Deze zijn zichtbaar voor alle
                    docenten maar kunnen alleen door beheerders worden bewerkt.
                  </p>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              Beheer leerdoelen en eindtermen die gekoppeld kunnen worden aan
              criteria
            </p>

            {/* Filters above the table */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Niveau filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">Niveau:</span>
                {[
                  { id: "all", label: "Alle" },
                  { id: "onderbouw", label: "Onderbouw" },
                  { id: "bovenbouw", label: "Bovenbouw" },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() =>
                      setSelectedObjectiveLevelFilter(
                        filter.id as "all" | "onderbouw" | "bovenbouw",
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      selectedObjectiveLevelFilter === filter.id
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {/* Domein filter */}
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>Domein:</span>
                <select
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                  value={selectedObjectiveDomainFilter}
                  onChange={(e) =>
                    setSelectedObjectiveDomainFilter(e.target.value)
                  }
                >
                  <option value="all">Alle</option>
                  {uniqueObjectiveDomains.map((domain) => (
                    <option key={domain} value={domain}>
                      {domain}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loadingObjectives ? (
              <div className="text-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                <p className="mt-2 text-sm text-gray-500">Laden...</p>
              </div>
            ) : filteredLearningObjectives.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Type
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-16">
                        Domein
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-16">
                        Nummer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Titel
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fase
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Acties
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredLearningObjectives.map((obj) => (
                      <tr
                        key={obj.id}
                        className="hover:bg-gray-50 bg-amber-50/30"
                      >
                        {editingObjective === obj.id ? (
                          <>
                            <td className="px-6 py-4 text-sm whitespace-nowrap">
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                🏛️ Centraal
                              </span>
                            </td>
                            <td className="px-3 py-4 text-sm">
                              <input
                                type="text"
                                value={editObjectiveFormData.domain || ""}
                                onChange={(e) =>
                                  setEditObjectiveFormData({
                                    ...editObjectiveFormData,
                                    domain: e.target.value,
                                  })
                                }
                                placeholder="A, B, C..."
                                className="w-12 px-2 py-1 border rounded text-sm"
                              />
                            </td>
                            <td className="px-3 py-4 text-sm">
                              <input
                                type="number"
                                value={editObjectiveFormData.order || 0}
                                onChange={(e) =>
                                  setEditObjectiveFormData({
                                    ...editObjectiveFormData,
                                    order: parseInt(e.target.value, 10) || 0,
                                  })
                                }
                                className="w-12 px-2 py-1 border rounded text-sm"
                              />
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <input
                                type="text"
                                value={editObjectiveFormData.title || ""}
                                onChange={(e) =>
                                  setEditObjectiveFormData({
                                    ...editObjectiveFormData,
                                    title: e.target.value,
                                  })
                                }
                                placeholder="Titel"
                                className="w-full px-2 py-1 border rounded text-sm"
                              />
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <select
                                value={editObjectiveFormData.phase || ""}
                                onChange={(e) =>
                                  setEditObjectiveFormData({
                                    ...editObjectiveFormData,
                                    phase: e.target.value || null,
                                  })
                                }
                                className="w-full px-2 py-1 border rounded text-sm"
                              >
                                <option value="">-</option>
                                <option value="onderbouw">Onderbouw</option>
                                <option value="bovenbouw">Bovenbouw</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 text-sm text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handleUpdateObjective(obj.id)}
                                  className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                >
                                  Opslaan
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingObjective(null);
                                    setEditObjectiveFormData({
                                      domain: "",
                                      title: "",
                                      description: "",
                                      order: 0,
                                      phase: "",
                                    });
                                  }}
                                  className="px-3 py-1.5 border text-xs rounded hover:bg-gray-100"
                                >
                                  Annuleren
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-6 py-4 text-sm whitespace-nowrap">
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                🏛️ Centraal
                              </span>
                            </td>
                            <td className="px-3 py-4 text-sm font-medium">
                              {obj.domain || "-"}
                            </td>
                            <td className="px-3 py-4 text-sm">{obj.order}</td>
                            <td className="px-6 py-4 text-sm">{obj.title}</td>
                            <td className="px-6 py-4 text-sm">
                              {obj.phase ? (
                                <span
                                  className={`px-2 py-1 rounded text-xs ${
                                    obj.phase === "onderbouw"
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-purple-100 text-purple-800"
                                  }`}
                                >
                                  {obj.phase === "onderbouw"
                                    ? "Onderbouw"
                                    : "Bovenbouw"}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => startEditingObjective(obj)}
                                  className="px-3 py-1.5 bg-gray-100 text-xs rounded hover:bg-gray-200"
                                >
                                  Bewerken
                                </button>
                                <button
                                  onClick={() => handleDeleteObjective(obj.id)}
                                  className="px-3 py-1.5 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200"
                                >
                                  Verwijderen
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                {learningObjectives.length === 0 ? (
                  <>
                    <p className="mb-4">Nog geen leerdoelen aangemaakt</p>
                    <p className="text-xs">
                      Klik op &quot;+ Nieuw Leerdoel&quot; om te beginnen
                    </p>
                  </>
                ) : (
                  <p>
                    Geen leerdoelen gevonden voor de geselecteerde filters.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "remarks" && (
          <div className="space-y-4">
            {/* Title and description */}
            <div>
              <p className="text-sm text-slate-600 mt-1">
                Beheer standaardopmerkingen (quick comments) voor OMZA
                categorieën
              </p>
            </div>

            {/* Filters above the table */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Categorie filter */}
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>Categorie:</span>
                <select
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                  value={selectedOmzaCategoryFilter}
                  onChange={(e) =>
                    setSelectedOmzaCategoryFilter(
                      e.target.value as "all" | "O" | "M" | "Z" | "A",
                    )
                  }
                >
                  <option value="all">Alle</option>
                  <option value="O">Organiseren</option>
                  <option value="M">Meedoen</option>
                  <option value="Z">Zelfvertrouwen</option>
                  <option value="A">Autonomie</option>
                </select>
              </div>
            </div>

            {loadingStandardRemarks ? (
              <div className="text-center py-8 text-gray-500">
                <p>Opmerkingen laden...</p>
              </div>
            ) : (
              <>
                {/* Create new standard remark form */}
                {isCreatingStandardRemark && (
                  <div className="bg-white border-2 border-blue-500 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold mb-3">Nieuwe Opmerking</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          OMZA Categorie
                        </label>
                        <select
                          value={remarkFormData.category}
                          onChange={(e) =>
                            setRemarkFormData({
                              ...remarkFormData,
                              category: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border rounded"
                        >
                          <option value="O">O - Organiseren</option>
                          <option value="M">M - Meedoen</option>
                          <option value="Z">Z - Zelfvertrouwen</option>
                          <option value="A">A - Autonomie</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Tekst *
                        </label>
                        <input
                          type="text"
                          value={remarkFormData.text}
                          onChange={(e) =>
                            setRemarkFormData({
                              ...remarkFormData,
                              text: e.target.value,
                            })
                          }
                          placeholder="bijv. Plant goed en houdt overzicht."
                          className="w-full px-3 py-2 border rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Volgorde
                        </label>
                        <input
                          type="number"
                          value={remarkFormData.order || 0}
                          onChange={(e) =>
                            setRemarkFormData({
                              ...remarkFormData,
                              order: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="w-full px-3 py-2 border rounded"
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={handleCreateStandardRemark}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Opslaan
                        </button>
                        <button
                          onClick={() => setIsCreatingStandardRemark(false)}
                          className="px-4 py-2 border rounded hover:bg-gray-50"
                        >
                          Annuleren
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Table of remarks */}
                <table className="w-full table-fixed text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b">
                      <th
                        className="w-32 py-2 cursor-pointer hover:text-slate-700"
                        onClick={() =>
                          setRemarkSort({
                            key: "categoryName",
                            dir:
                              remarkSort.key === "categoryName" &&
                              remarkSort.dir === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Categorie{" "}
                        {remarkSort.key === "categoryName" &&
                          (remarkSort.dir === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        className="w-auto cursor-pointer hover:text-slate-700"
                        onClick={() =>
                          setRemarkSort({
                            key: "text",
                            dir:
                              remarkSort.key === "text" &&
                              remarkSort.dir === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Tekst{" "}
                        {remarkSort.key === "text" &&
                          (remarkSort.dir === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        className="w-24 text-center cursor-pointer hover:text-slate-700"
                        onClick={() =>
                          setRemarkSort({
                            key: "order",
                            dir:
                              remarkSort.key === "order" &&
                              remarkSort.dir === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Volgorde{" "}
                        {remarkSort.key === "order" &&
                          (remarkSort.dir === "asc" ? "↑" : "↓")}
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {filteredAndSortedStandardRemarks.map((row) => {
                      const isOpen = expandedRemark === row.id;

                      return [
                        <tr
                          key={row.id}
                          className="hover:bg-slate-50 cursor-pointer"
                          onClick={() => toggleRemarkExpand(row.id)}
                        >
                          <td className="w-32 py-3 font-bold text-slate-900">
                            {row.categoryName}
                          </td>
                          <td
                            className="py-3 text-slate-600 truncate max-w-xl"
                            title={row.text}
                          >
                            {row.text}
                          </td>
                          <td className="w-24 text-slate-500 text-center">
                            {row.order}
                          </td>
                        </tr>,
                        isOpen && (
                          <tr
                            key={`${row.id}-expanded`}
                            className="bg-slate-50"
                          >
                            <td colSpan={3} className="p-4">
                              {editingStandardRemark === row.id ? (
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-sm font-medium mb-1">
                                      Tekst
                                    </label>
                                    <input
                                      type="text"
                                      defaultValue={row.text}
                                      id={`edit-remark-text-${row.id}`}
                                      className="w-full px-3 py-2 border rounded"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-1">
                                      Volgorde
                                    </label>
                                    <input
                                      type="number"
                                      defaultValue={row.order}
                                      id={`edit-remark-order-${row.id}`}
                                      className="w-full px-3 py-2 border rounded"
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        const textEl = document.getElementById(
                                          `edit-remark-text-${row.id}`,
                                        ) as HTMLInputElement;
                                        const orderEl = document.getElementById(
                                          `edit-remark-order-${row.id}`,
                                        ) as HTMLInputElement;
                                        handleUpdateStandardRemark(row.id, {
                                          text: textEl.value,
                                          order:
                                            parseInt(orderEl.value, 10) || 0,
                                        });
                                      }}
                                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                    >
                                      Opslaan
                                    </button>
                                    <button
                                      onClick={() =>
                                        setEditingStandardRemark(null)
                                      }
                                      className="px-3 py-1.5 border text-sm rounded hover:bg-gray-100"
                                    >
                                      Annuleren
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="text-sm text-slate-700 mb-3">
                                    <span className="font-medium">
                                      Volledige tekst:
                                    </span>{" "}
                                    {row.text}
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingStandardRemark(row.id);
                                      }}
                                      className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px]"
                                    >
                                      Bewerken
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteStandardRemark(row.id);
                                      }}
                                      className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] text-red-700"
                                    >
                                      Verwijderen
                                    </button>
                                  </div>
                                </>
                              )}
                            </td>
                          </tr>
                        ),
                      ];
                    })}
                  </tbody>
                </table>

                {filteredAndSortedStandardRemarks.length === 0 &&
                  !isCreatingStandardRemark && (
                    <div className="text-center py-8 text-gray-500">
                      {standardRemarks.length === 0 ? (
                        <>
                          <p className="mb-4">
                            Nog geen opmerkingen aangemaakt voor dit vak.
                          </p>
                          <p className="text-xs">
                            Klik op &quot;+ Nieuwe Standaardopmerking&quot; om
                            te beginnen.
                          </p>
                        </>
                      ) : (
                        <p>
                          Geen opmerkingen gevonden voor de geselecteerde
                          categorie.
                        </p>
                      )}
                    </div>
                  )}
              </>
            )}
          </div>
        )}

        {activeTab === "tags" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Beheer tags voor categorisatie van templates
            </p>
            <div className="text-center py-8 text-gray-500">
              <p className="mb-4">Template tags worden hier weergegeven</p>
              <p className="text-xs">
                API Endpoint: GET /api/v1/templates/tags?subject_id=
                {selectedSubjectId}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const getNewButtonLabel = () => {
    switch (activeTab) {
      case "peer":
        return "+ Nieuw Peerevaluatie Criterium";
      case "rubrics":
        return "+ Nieuw Projectbeoordeling Criterium";
      case "competencies":
        return "+ Nieuwe Competentie";
      case "mail":
        return "+ Nieuwe Mail-template";
      case "objectives":
        return "+ Nieuw Leerdoel";
      case "remarks":
        return "+ Nieuwe Standaardopmerking";
      case "tags":
        return "+ Nieuwe Tag";
      default:
        return "+ Nieuw Item";
    }
  };

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              Templates
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              Beheer sjablonen per sectie/vakgebied.
            </p>
          </div>
          {(selectedSubjectId ||
            activeTab === "mail" ||
            activeTab === "competencies") && (
            <div className="flex gap-2">
              {activeTab === "competencies" ? (
                <Link
                  href="/teacher/competencies/create"
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  + Nieuwe Competentie
                </Link>
              ) : (
                <button
                  onClick={() => {
                    if (activeTab === "objectives") {
                      openCreateModal();
                    } else if (activeTab === "peer") {
                      setIsCreatingPeerCriterion(true);
                      setPeerFormData({
                        omza_category: "organiseren",
                        title: "",
                        description: "",
                        target_level: null,
                        level_descriptors: {
                          "1": "",
                          "2": "",
                          "3": "",
                          "4": "",
                          "5": "",
                        },
                        learning_objective_ids: [],
                      });
                    } else if (activeTab === "rubrics") {
                      setIsCreatingProjectCriterion(true);
                      setProjectFormData({
                        category: "projectproces",
                        title: "",
                        description: "",
                        target_level: null,
                        level_descriptors: {
                          "1": "",
                          "2": "",
                          "3": "",
                          "4": "",
                          "5": "",
                        },
                        learning_objective_ids: [],
                      });
                    } else if (activeTab === "mail") {
                      setIsCreatingMailTemplate(true);
                      setMailFormData({
                        name: "",
                        type: "opvolgmail",
                        subject: "",
                        body: "",
                        is_active: true,
                      });
                    } else if (activeTab === "remarks") {
                      setIsCreatingStandardRemark(true);
                      setRemarkFormData({
                        type: "omza",
                        category: "O",
                        text: "",
                        order: 0,
                      });
                    } else {
                      // TODO: Implement create modal/form for other template types
                      alert(
                        `Create new ${TABS.find((t) => t.key === activeTab)?.label}`,
                      );
                    }
                  }}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  {getNewButtonLabel()}
                </button>
              )}
              {activeTab === "objectives" && (
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Importeer CSV
                </button>
              )}
            </div>
          )}
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Subject Selector */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 mb-6">
          <label
            htmlFor="subject-select"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Selecteer Sectie / Vakgebied
          </label>
          {loading ? (
            <div className="animate-pulse h-10 bg-gray-200 rounded"></div>
          ) : (
            <select
              id="subject-select"
              value={selectedSubjectId || ""}
              onChange={(e) =>
                handleSubjectChange(
                  e.target.value ? parseInt(e.target.value) : 0,
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Kies een sectie --</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name} ({subject.code})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`
                    px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                    ${
                      activeTab === tab.key
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }
                  `}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          {renderTabContent()}
        </div>
      </div>

      {/* Create Learning Objective Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Nieuw Leerdoel</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Domein</label>
                <input
                  type="text"
                  value={formData.domain || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, domain: e.target.value })
                  }
                  placeholder="A, B, C, D, E"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nummer</label>
                <input
                  type="number"
                  value={formData.order || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      order: parseInt(e.target.value, 10),
                    })
                  }
                  placeholder="9, 11, 13, 14, 16..."
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Titel *
                </label>
                <input
                  type="text"
                  value={formData.title || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Conceptontwikkeling"
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Beschrijving
                </label>
                <textarea
                  value={formData.description || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Ontwerprichtingen genereren en onderbouwen"
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Fase</label>
                <select
                  value={formData.phase || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, phase: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">Niet gespecificeerd</option>
                  <option value="onderbouw">Onderbouw</option>
                  <option value="bovenbouw">Bovenbouw</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleCreateObjective}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Aanmaken
              </button>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Learning Objective Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              Importeer Leerdoelen (CSV)
            </h2>
            <p className="text-sm text-gray-600 mb-2">
              <strong>Let op:</strong> Deze leerdoelen worden toegevoegd aan het
              geselecteerde subject (
              {subjects.find((s) => s.id === selectedSubjectId)?.name}).
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Formaat: domein,nummer,titel,beschrijving,fase
              <br />
              Bijvoorbeeld: D,9,Conceptontwikkeling,Ontwerprichtingen genereren
              en onderbouwen,onderbouw
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Plak CSV-gegevens hier..."
              className="w-full px-3 py-2 border rounded font-mono text-sm"
              rows={10}
            />
            {importResult && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
                <p className="font-medium">Resultaat:</p>
                <p>Aangemaakt: {importResult.created}</p>
                <p>Bijgewerkt: {importResult.updated}</p>
                {importResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium text-red-600">Fouten:</p>
                    <ul className="list-disc list-inside text-sm">
                      {importResult.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleImport}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Importeren
              </button>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportText("");
                  setImportResult(null);
                }}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mail Template Edit Modal */}
      {isMailEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Mail Template Bewerken</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Naam *</label>
                <input
                  type="text"
                  value={mailFormData.name || ""}
                  onChange={(e) =>
                    setMailFormData({ ...mailFormData, name: e.target.value })
                  }
                  placeholder="bijv. Opvolgmail volgend schooljaar"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={mailFormData.type || "opvolgmail"}
                  onChange={(e) =>
                    setMailFormData({ ...mailFormData, type: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="opvolgmail">Opvolgmail</option>
                  <option value="startproject">Start project</option>
                  <option value="tussenpresentatie">Tussenpresentatie</option>
                  <option value="eindpresentatie">Eindpresentatie</option>
                  <option value="bedankmail">Bedankmail</option>
                  <option value="herinnering">Herinnering</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Onderwerp *
                </label>
                <input
                  type="text"
                  value={mailFormData.subject || ""}
                  onChange={(e) =>
                    setMailFormData({
                      ...mailFormData,
                      subject: e.target.value,
                    })
                  }
                  placeholder="bijv. Samenwerking schooljaar {schoolYear}"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Inhoud *
                </label>
                <textarea
                  value={mailFormData.body || ""}
                  onChange={(e) =>
                    setMailFormData({ ...mailFormData, body: e.target.value })
                  }
                  placeholder="Beste opdrachtgever,&#10;&#10;Het schooljaar {schoolYear} staat voor de deur..."
                  className="w-full px-3 py-2 border rounded font-mono text-sm"
                  rows={8}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active_modal"
                  checked={mailFormData.is_active ?? true}
                  onChange={(e) =>
                    setMailFormData({
                      ...mailFormData,
                      is_active: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                <label htmlFor="is_active_modal" className="text-sm">
                  Actief (zichtbaar in dropdowns)
                </label>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleMailTemplateUpdateFromModal}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Opslaan
              </button>
              <button
                onClick={() => {
                  setIsMailEditModalOpen(false);
                  setEditingMailTemplate(null);
                  setMailFormData({
                    name: "",
                    type: "opvolgmail",
                    subject: "",
                    body: "",
                    is_active: true,
                  });
                }}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
