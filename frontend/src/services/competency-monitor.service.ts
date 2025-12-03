/**
 * Service for Competency Monitor Overview Dashboard
 * 
 * This service provides data for the teacher competency monitor overview.
 * Currently uses mock data, but is structured to connect to a backend API.
 */
// import api from "@/lib/api"; // Uncomment when connecting to real API
import type {
  CompetencyOverviewData,
  CategoryDetailData,
  StudentCompetencySummary,
  LearningGoalSummary,
  ReflectionSummary,
  CompetencyOverviewFilters,
  FilterOptions,
} from "@/dtos/competency-monitor.dto";

// Mock data for development - will be replaced with API calls
const mockCategorySummaries = [
  {
    id: 1,
    name: "Samenwerken",
    averageScore: 3.8,
    previousAverageScore: 3.5,
    trendDelta: 0.3,
    numStudentsUp: 12,
    numStudentsDown: 3,
    numStudentsSame: 5,
  },
  {
    id: 2,
    name: "Plannen & Organiseren",
    averageScore: 3.2,
    previousAverageScore: 3.4,
    trendDelta: -0.2,
    numStudentsUp: 5,
    numStudentsDown: 8,
    numStudentsSame: 7,
  },
  {
    id: 3,
    name: "Creatief denken",
    averageScore: 3.9,
    previousAverageScore: 3.6,
    trendDelta: 0.3,
    numStudentsUp: 10,
    numStudentsDown: 4,
    numStudentsSame: 6,
  },
  {
    id: 4,
    name: "Technische vaardigheden",
    averageScore: 3.5,
    previousAverageScore: 3.3,
    trendDelta: 0.2,
    numStudentsUp: 8,
    numStudentsDown: 5,
    numStudentsSame: 7,
  },
  {
    id: 5,
    name: "Communicatie",
    averageScore: 4.1,
    previousAverageScore: 3.9,
    trendDelta: 0.2,
    numStudentsUp: 11,
    numStudentsDown: 2,
    numStudentsSame: 7,
  },
  {
    id: 6,
    name: "Reflectie",
    averageScore: 3.4,
    previousAverageScore: 3.2,
    trendDelta: 0.2,
    numStudentsUp: 9,
    numStudentsDown: 4,
    numStudentsSame: 7,
  },
];

const mockScans = [
  {
    scanId: 1,
    label: "Scan 1 - September",
    date: "2024-09-15",
    overallAverage: 3.2,
    categoryAverages: [
      { categoryId: 1, categoryName: "Samenwerken", averageScore: 3.2 },
      { categoryId: 2, categoryName: "Plannen & Organiseren", averageScore: 3.0 },
      { categoryId: 3, categoryName: "Creatief denken", averageScore: 3.3 },
      { categoryId: 4, categoryName: "Technische vaardigheden", averageScore: 3.1 },
      { categoryId: 5, categoryName: "Communicatie", averageScore: 3.5 },
      { categoryId: 6, categoryName: "Reflectie", averageScore: 3.0 },
    ],
  },
  {
    scanId: 2,
    label: "Scan 2 - November",
    date: "2024-11-01",
    overallAverage: 3.5,
    categoryAverages: [
      { categoryId: 1, categoryName: "Samenwerken", averageScore: 3.5 },
      { categoryId: 2, categoryName: "Plannen & Organiseren", averageScore: 3.4 },
      { categoryId: 3, categoryName: "Creatief denken", averageScore: 3.6 },
      { categoryId: 4, categoryName: "Technische vaardigheden", averageScore: 3.3 },
      { categoryId: 5, categoryName: "Communicatie", averageScore: 3.9 },
      { categoryId: 6, categoryName: "Reflectie", averageScore: 3.2 },
    ],
  },
  {
    scanId: 3,
    label: "Scan 3 - December",
    date: "2024-12-01",
    overallAverage: 3.65,
    categoryAverages: [
      { categoryId: 1, categoryName: "Samenwerken", averageScore: 3.8 },
      { categoryId: 2, categoryName: "Plannen & Organiseren", averageScore: 3.2 },
      { categoryId: 3, categoryName: "Creatief denken", averageScore: 3.9 },
      { categoryId: 4, categoryName: "Technische vaardigheden", averageScore: 3.5 },
      { categoryId: 5, categoryName: "Communicatie", averageScore: 4.1 },
      { categoryId: 6, categoryName: "Reflectie", averageScore: 3.4 },
    ],
  },
];

const mockStudents: StudentCompetencySummary[] = [
  { studentId: 1, name: "Anna de Vries", className: "4A", lastScanDate: "2024-12-01", lastOverallScore: 4.2, trendDelta: 0.5, strongestCategory: "Communicatie", weakestCategory: "Plannen & Organiseren" },
  { studentId: 2, name: "Bram Jansen", className: "4A", lastScanDate: "2024-12-01", lastOverallScore: 3.1, trendDelta: -0.3, strongestCategory: "Technische vaardigheden", weakestCategory: "Samenwerken" },
  { studentId: 3, name: "Charlotte Bakker", className: "4A", lastScanDate: "2024-12-01", lastOverallScore: 3.8, trendDelta: 0.2, strongestCategory: "Creatief denken", weakestCategory: "Reflectie" },
  { studentId: 4, name: "Daan Peters", className: "4B", lastScanDate: "2024-12-01", lastOverallScore: 3.5, trendDelta: 0.1, strongestCategory: "Samenwerken", weakestCategory: "Technische vaardigheden" },
  { studentId: 5, name: "Emma van den Berg", className: "4B", lastScanDate: "2024-12-01", lastOverallScore: 4.5, trendDelta: 0.8, strongestCategory: "Communicatie", weakestCategory: "Plannen & Organiseren" },
  { studentId: 6, name: "Finn de Groot", className: "4B", lastScanDate: "2024-12-01", lastOverallScore: 2.4, trendDelta: -0.9, strongestCategory: "Reflectie", weakestCategory: "Samenwerken" },
  { studentId: 7, name: "Gina Smit", className: "4A", lastScanDate: "2024-12-01", lastOverallScore: 3.9, trendDelta: 0.4, strongestCategory: "Creatief denken", weakestCategory: "Plannen & Organiseren" },
  { studentId: 8, name: "Hugo Visser", className: "4A", lastScanDate: "2024-12-01", lastOverallScore: 3.3, trendDelta: 0.0, strongestCategory: "Technische vaardigheden", weakestCategory: "Communicatie" },
  { studentId: 9, name: "Isabel Meijer", className: "4B", lastScanDate: "2024-12-01", lastOverallScore: 2.2, trendDelta: -0.5, strongestCategory: "Samenwerken", weakestCategory: "Creatief denken" },
  { studentId: 10, name: "Jan de Boer", className: "4B", lastScanDate: "2024-12-01", lastOverallScore: 4.0, trendDelta: 0.9, strongestCategory: "Communicatie", weakestCategory: "Reflectie" },
];

const mockHeatmapRows = mockStudents.map((s) => ({
  studentId: s.studentId,
  name: s.name,
  className: s.className,
  scores: {
    1: 2.5 + Math.random() * 2,
    2: 2.5 + Math.random() * 2,
    3: 2.5 + Math.random() * 2,
    4: 2.5 + Math.random() * 2,
    5: 2.5 + Math.random() * 2,
    6: 2.5 + Math.random() * 2,
  },
}));

const mockNotableStudents = [
  { studentId: 5, name: "Emma van den Berg", className: "4B", type: "strong_growth" as const, trendDelta: 0.8, score: 4.5, categoryName: null },
  { studentId: 10, name: "Jan de Boer", className: "4B", type: "strong_growth" as const, trendDelta: 0.9, score: 4.0, categoryName: null },
  { studentId: 6, name: "Finn de Groot", className: "4B", type: "decline" as const, trendDelta: -0.9, score: 2.4, categoryName: null },
  { studentId: 9, name: "Isabel Meijer", className: "4B", type: "low_score" as const, trendDelta: -0.5, score: 2.2, categoryName: "Creatief denken" },
];

const mockLearningGoals: LearningGoalSummary[] = [
  { id: 1, studentId: 1, studentName: "Anna de Vries", className: "4A", categoryId: 2, categoryName: "Plannen & Organiseren", goalText: "Ik wil beter worden in het maken van een planning en me daar aan houden", status: "in_progress", createdAt: "2024-11-01", updatedAt: "2024-11-15" },
  { id: 2, studentId: 2, studentName: "Bram Jansen", className: "4A", categoryId: 1, categoryName: "Samenwerken", goalText: "Ik wil actiever luisteren naar mijn teamgenoten en meer ruimte geven aan anderen", status: "achieved", createdAt: "2024-10-15", updatedAt: "2024-12-01" },
  { id: 3, studentId: 3, studentName: "Charlotte Bakker", className: "4A", categoryId: 6, categoryName: "Reflectie", goalText: "Ik wil leren om na elke sprint bewust te reflecteren op mijn eigen bijdrage", status: "in_progress", createdAt: "2024-11-01", updatedAt: "2024-11-20" },
  { id: 4, studentId: 6, studentName: "Finn de Groot", className: "4B", categoryId: 1, categoryName: "Samenwerken", goalText: "Ik wil feedback van anderen serieuzer nemen en er daadwerkelijk iets mee doen", status: "not_achieved", createdAt: "2024-10-01", updatedAt: "2024-12-01" },
  { id: 5, studentId: 9, studentName: "Isabel Meijer", className: "4B", categoryId: 3, categoryName: "Creatief denken", goalText: "Ik wil meer out-of-the-box ideeën bedenken tijdens brainstormsessies", status: "in_progress", createdAt: "2024-11-10", updatedAt: "2024-11-25" },
];

const mockReflections: ReflectionSummary[] = [
  { id: 1, studentId: 1, studentName: "Anna de Vries", className: "4A", categoryId: null, categoryName: null, scanId: 3, scanLabel: "Scan 3 - December", createdAt: "2024-12-02", reflectionText: "Dit was een drukke periode, maar ik heb geleerd om beter te plannen. Mijn communicatie met het team is verbeterd doordat ik meer vragen stelde." },
  { id: 2, studentId: 2, studentName: "Bram Jansen", className: "4A", categoryId: null, categoryName: null, scanId: 3, scanLabel: "Scan 3 - December", createdAt: "2024-12-02", reflectionText: "Ik merk dat samenwerken soms nog lastig is, vooral als ik het niet eens ben met de aanpak van anderen. Wel ben ik trots op mijn technische groei." },
  { id: 3, studentId: 5, studentName: "Emma van den Berg", className: "4B", categoryId: null, categoryName: null, scanId: 3, scanLabel: "Scan 3 - December", createdAt: "2024-12-01", reflectionText: "Ik ben erg gegroeid deze periode. Mijn presentatievaardigheden zijn veel beter geworden en ik voel me zekerder in groepsdiscussies." },
  { id: 4, studentId: 6, studentName: "Finn de Groot", className: "4B", categoryId: null, categoryName: null, scanId: 3, scanLabel: "Scan 3 - December", createdAt: "2024-12-03", reflectionText: "Het was een moeilijke periode. Ik had moeite om feedback te accepteren en dat leidde tot conflicten. Ik moet hier echt aan werken." },
  { id: 5, studentId: 7, studentName: "Gina Smit", className: "4A", categoryId: null, categoryName: null, scanId: 3, scanLabel: "Scan 3 - December", createdAt: "2024-12-02", reflectionText: "Creatief denken gaat me goed af, maar planning blijft een uitdaging. Ik ga volgende periode een digitale tool gebruiken om beter bij te houden wat ik moet doen." },
];

const mockFilterOptions: FilterOptions = {
  classes: [
    { id: "4A", name: "Klas 4A" },
    { id: "4B", name: "Klas 4B" },
  ],
  scans: mockScans.map((s) => ({ id: s.scanId, label: s.label, date: s.date })),
  categories: mockCategorySummaries.map((c) => ({ id: c.id, name: c.name })),
};

// Service implementation
export const competencyMonitorService = {
  /**
   * Get overview data for the competency monitor dashboard
   */
  async getOverview(_filters?: CompetencyOverviewFilters): Promise<CompetencyOverviewData> {
    // In production, this would call the API:
    // const response = await api.get('/teacher/competency/overview', { params: filters });
    // return response.data;
    
    // For now, return mock data with a small delay to simulate API call
    await new Promise((resolve) => setTimeout(resolve, 300));
    
    return {
      classAverageScore: 3.65,
      classTrendDelta: 0.15,
      studentsImproved: 55,
      studentsDeclined: 20,
      totalStudents: 100,
      categorySummaries: mockCategorySummaries,
      scans: mockScans,
      heatmapRows: mockHeatmapRows,
      notableStudents: mockNotableStudents,
    };
  },

  /**
   * Get category detail data
   */
  async getCategoryDetail(categoryId: number, _filters?: CompetencyOverviewFilters): Promise<CategoryDetailData> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    
    const category = mockCategorySummaries.find((c) => c.id === categoryId) || mockCategorySummaries[0];
    
    return {
      category,
      scoreDistribution: [
        { score: 1, count: 2 },
        { score: 2, count: 5 },
        { score: 3, count: 12 },
        { score: 4, count: 15 },
        { score: 5, count: 6 },
      ],
      riskStudents: [
        { studentId: 6, name: "Finn de Groot", className: "4B", categoryId, categoryName: category.name, lastScore: 2.1, trendDelta: -0.5 },
        { studentId: 9, name: "Isabel Meijer", className: "4B", categoryId, categoryName: category.name, lastScore: 2.4, trendDelta: -0.3 },
      ],
      minScore: 2.1,
      maxScore: 4.8,
    };
  },

  /**
   * Get students list
   */
  async getStudents(filters?: CompetencyOverviewFilters): Promise<StudentCompetencySummary[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    
    let result = [...mockStudents];
    
    if (filters?.className) {
      result = result.filter((s) => s.className === filters.className);
    }
    
    if (filters?.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(query));
    }
    
    return result;
  },

  /**
   * Get learning goals
   */
  async getLearningGoals(filters?: CompetencyOverviewFilters): Promise<LearningGoalSummary[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    
    let result = [...mockLearningGoals];
    
    if (filters?.className) {
      result = result.filter((g) => g.className === filters.className);
    }
    
    if (filters?.categoryId) {
      result = result.filter((g) => g.categoryId === filters.categoryId);
    }
    
    if (filters?.status) {
      result = result.filter((g) => g.status === filters.status);
    }
    
    if (filters?.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter((g) => g.goalText.toLowerCase().includes(query));
    }
    
    return result;
  },

  /**
   * Get reflections
   */
  async getReflections(filters?: CompetencyOverviewFilters): Promise<ReflectionSummary[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    
    let result = [...mockReflections];
    
    if (filters?.className) {
      result = result.filter((r) => r.className === filters.className);
    }
    
    if (filters?.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter((r) => r.reflectionText.toLowerCase().includes(query));
    }
    
    return result;
  },

  /**
   * Get filter options (classes, scans, categories)
   */
  async getFilterOptions(): Promise<FilterOptions> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return mockFilterOptions;
  },
};
