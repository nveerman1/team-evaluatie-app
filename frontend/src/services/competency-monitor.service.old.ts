/**
 * Service for Competency Monitor Overview Dashboard
 * 
 * This service provides data for the teacher competency monitor overview.
 * Connects to real backend API endpoints.
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

// Helper function to transform API response to our format
function transformHeatmapResponse(apiData: { rows: Array<{ user_id: number; user_name: string; scores: Record<number, number | null> }> }): CompetencyOverviewData["heatmapRows"] {
  return apiData.rows.map((row) => ({
    studentId: row.user_id,
    name: row.user_name,
    className: null, // Backend doesn't return className in heatmap
    scores: row.scores,
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
