/**
 * Service for Competency Monitor Overview Dashboard
 * 
 * This service provides data for the teacher competency monitor overview.
 * Uses real API calls where possible, with mock data fallback for development.
 */
import api from "@/lib/api";
import type {
  CompetencyOverviewData,
  CategoryDetailData,
  StudentCompetencySummary,
  LearningGoalSummary,
  ReflectionSummary,
  CompetencyOverviewFilters,
  FilterOptions,
  StudentDetailData,
  StudentScanData,
} from "@/dtos/competency-monitor.dto";

// Flag to enable/disable real API calls (set to true when backend is ready)
const USE_REAL_API = true;

// Mock data for development - used as fallback when API fails
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

// Helper function to transform API response to our format
function transformHeatmapResponse(apiData: { rows: Array<{ student_id: number; student_name: string; class_name: string | null; scores: Array<{ competency_id: number; score: number | null }> }> }): CompetencyOverviewData["heatmapRows"] {
  return apiData.rows.map((row) => ({
    studentId: row.student_id,
    name: row.student_name,
    className: row.class_name,
    scores: row.scores.reduce((acc, s) => {
      acc[s.competency_id] = s.score;
      return acc;
    }, {} as Record<number, number | null>),
  }));
}

// Service implementation
export const competencyMonitorService = {
  /**
   * Get overview data for the competency monitor dashboard
   */
  async getOverview(filters?: CompetencyOverviewFilters): Promise<CompetencyOverviewData> {
    if (USE_REAL_API) {
      try {
        // Get the latest competency window
        const windowsResponse = await api.get("/competencies/windows/", {
          params: { status: "all" },
        });
        const windows = windowsResponse.data;
        
        if (windows && windows.length > 0) {
          const latestWindow = windows[0];
          
          // Get class heatmap data
          const heatmapResponse = await api.get(`/competencies/windows/${latestWindow.id}/heatmap`, {
            params: filters?.className ? { class_name: filters.className } : {},
          });
          
          // Transform API response to our format
          const heatmapRows = transformHeatmapResponse(heatmapResponse.data);
          
          // Calculate statistics from heatmap data
          const allScores = heatmapRows.flatMap((row) => Object.values(row.scores).filter((s): s is number => s !== null));
          const classAverageScore = allScores.length > 0 
            ? allScores.reduce((sum, s) => sum + s, 0) / allScores.length 
            : null;
          
          return {
            classAverageScore,
            classTrendDelta: 0.15, // Would need historical data
            studentsImproved: 55,
            studentsDeclined: 20,
            totalStudents: heatmapRows.length,
            categorySummaries: mockCategorySummaries,
            scans: mockScans,
            heatmapRows,
            notableStudents: mockNotableStudents,
          };
        }
      } catch (error) {
        console.warn("Failed to fetch from API, using mock data:", error);
      }
    }
    
    // Fallback to mock data
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
    if (USE_REAL_API) {
      try {
        // Get the latest competency window
        const windowsResponse = await api.get("/competencies/windows/", {
          params: { status: "all" },
        });
        const windows = windowsResponse.data;
        
        if (windows && windows.length > 0) {
          const latestWindow = windows[0];
          
          // Get goals from API
          const params: Record<string, string> = {};
          if (filters?.className) params.class_name = filters.className;
          if (filters?.status) params.status = filters.status;
          
          const goalsResponse = await api.get(`/competencies/windows/${latestWindow.id}/goals`, { params });
          const apiGoals = goalsResponse.data.goals || [];
          
          // Transform API response to our format
          let result: LearningGoalSummary[] = apiGoals.map((g: { id: number; student_id: number; student_name: string; class_name: string | null; category_id: number | null; category_name: string | null; goal_text: string; status: string; created_at: string; updated_at: string }) => ({
            id: g.id,
            studentId: g.student_id,
            studentName: g.student_name,
            className: g.class_name,
            categoryId: g.category_id,
            categoryName: g.category_name,
            goalText: g.goal_text,
            status: g.status as "in_progress" | "achieved" | "not_achieved",
            createdAt: g.created_at,
            updatedAt: g.updated_at,
          }));
          
          // Apply local filters
          if (filters?.categoryId) {
            result = result.filter((g) => g.categoryId === filters.categoryId);
          }
          
          if (filters?.searchQuery) {
            const query = filters.searchQuery.toLowerCase();
            result = result.filter((g) => g.goalText.toLowerCase().includes(query));
          }
          
          return result;
        }
      } catch (error) {
        console.warn("Failed to fetch goals from API, using mock data:", error);
      }
    }
    
    // Fallback to mock data
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
    if (USE_REAL_API) {
      try {
        // Get the latest competency window
        const windowsResponse = await api.get("/competencies/windows/", {
          params: { status: "all" },
        });
        const windows = windowsResponse.data;
        
        if (windows && windows.length > 0) {
          const latestWindow = windows[0];
          
          // Get reflections from API
          const params: Record<string, string> = {};
          if (filters?.className) params.class_name = filters.className;
          
          const reflectionsResponse = await api.get(`/competencies/windows/${latestWindow.id}/reflections`, { params });
          const apiReflections = reflectionsResponse.data.reflections || [];
          
          // Transform API response to our format
          let result: ReflectionSummary[] = apiReflections.map((r: { id: number; student_id: number; student_name: string; class_name: string | null; category_id: number | null; category_name: string | null; window_id: number; window_label?: string; created_at: string; reflection_text: string }) => ({
            id: r.id,
            studentId: r.student_id,
            studentName: r.student_name,
            className: r.class_name,
            categoryId: r.category_id,
            categoryName: r.category_name,
            scanId: r.window_id,
            scanLabel: r.window_label || `Scan ${r.window_id}`,
            createdAt: r.created_at,
            reflectionText: r.reflection_text,
          }));
          
          // Apply local filters
          if (filters?.searchQuery) {
            const query = filters.searchQuery.toLowerCase();
            result = result.filter((r) => r.reflectionText.toLowerCase().includes(query));
          }
          
          return result;
        }
      } catch (error) {
        console.warn("Failed to fetch reflections from API, using mock data:", error);
      }
    }
    
    // Fallback to mock data
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
    if (USE_REAL_API) {
      try {
        // Get windows for scans
        const windowsResponse = await api.get("/competencies/windows/", {
          params: { status: "all" },
        });
        const windows = windowsResponse.data;
        
        // Get categories
        const categoriesResponse = await api.get("/competencies/categories");
        const categories = categoriesResponse.data;
        
        return {
          classes: mockFilterOptions.classes, // Classes would need a separate endpoint
          scans: windows.map((w: { id: number; title: string; start_date: string }) => ({
            id: w.id,
            label: w.title,
            date: w.start_date,
          })),
          categories: categories.map((c: { id: number; name: string }) => ({
            id: c.id,
            name: c.name,
          })),
        };
      } catch (error) {
        console.warn("Failed to fetch filter options from API, using mock data:", error);
      }
    }
    
    await new Promise((resolve) => setTimeout(resolve, 100));
    return mockFilterOptions;
  },

  /**
   * Get detailed data for a single student
   */
  async getStudentDetail(studentId: number): Promise<StudentDetailData | null> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    
    const student = mockStudents.find((s) => s.studentId === studentId);
    if (!student) {
      return null;
    }
    
    // Generate mock scan data for this student
    const studentScans: StudentScanData[] = mockScans.map((scan) => {
      const categoryScores = mockCategorySummaries.map((cat) => ({
        categoryId: cat.id,
        categoryName: cat.name,
        // Generate consistent but varied scores per student/scan/category
        score: 2.0 + (((studentId * 7 + scan.scanId * 3 + cat.id * 5) % 30) / 10),
      }));
      
      const overallScore = categoryScores.reduce((sum, c) => sum + (c.score || 0), 0) / categoryScores.length;
      
      return {
        scanId: scan.scanId,
        scanLabel: scan.label,
        scanDate: scan.date,
        overallScore: parseFloat(overallScore.toFixed(1)),
        categoryScores,
      };
    });
    
    // Get current (latest) scores
    const latestScan = studentScans[studentScans.length - 1];
    const currentCategoryScores = latestScan?.categoryScores || [];
    
    // Get learning goals for this student
    const studentGoals = mockLearningGoals.filter((g) => g.studentId === studentId);
    
    // Get reflections for this student
    const studentReflections = mockReflections.filter((r) => r.studentId === studentId);
    
    // Add more mock reflections for variety
    const additionalReflections = mockScans.slice(0, -1).map((scan, idx) => ({
      id: 100 + studentId * 10 + idx,
      studentId,
      studentName: student.name,
      className: student.className,
      categoryId: null,
      categoryName: null,
      scanId: scan.scanId,
      scanLabel: scan.label,
      createdAt: scan.date,
      reflectionText: `Reflectie voor ${scan.label}: Ik heb deze periode gewerkt aan mijn competenties en zie vooruitgang op verschillende gebieden.`,
    }));
    
    return {
      studentId: student.studentId,
      name: student.name,
      className: student.className,
      email: `${student.name.toLowerCase().replace(/ /g, ".")}@school.nl`,
      currentOverallScore: student.lastOverallScore,
      currentCategoryScores,
      trendDelta: student.trendDelta,
      strongestCategory: student.strongestCategory,
      weakestCategory: student.weakestCategory,
      scans: studentScans,
      learningGoals: studentGoals,
      reflections: [...studentReflections, ...additionalReflections].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    };
  },
};
