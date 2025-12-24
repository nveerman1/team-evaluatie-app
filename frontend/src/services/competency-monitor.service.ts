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
} from "@/dtos/competency-monitor.dto";

// Service implementation
export const competencyMonitorService = {
  /**
   * Get overview data for the competency monitor dashboard
   */
  async getOverview(filters?: CompetencyOverviewFilters): Promise<CompetencyOverviewData> {
    // Get the competency windows, filtering by course if specified
    const windowsParams: Record<string, unknown> = { status: "all" };
    if (filters?.courseId) {
      windowsParams.course_id = filters.courseId;
    }
    
    const windowsResponse = await api.get("/competencies/windows/", {
      params: windowsParams,
    });
    const windows = windowsResponse.data;
    
    if (!windows || windows.length === 0) {
      // No windows available - return empty data
      return {
        classAverageScore: null,
        classTrendDelta: null,
        studentsImproved: 0,
        studentsDeclined: 0,
        totalStudents: 0,
        categorySummaries: [],
        scans: [],
        heatmapRows: [],
        notableStudents: [],
      };
    }
    
    // Use the latest window for main data
    const latestWindow = windows[0];
    
    // Get heatmap data for the latest window
    const heatmapResponse = await api.get(`/competencies/windows/${latestWindow.id}/heatmap`);
    const heatmapData = heatmapResponse.data;
    
    // Get categories from competencies in heatmap
    const competencies = heatmapData.competencies || [];
    
    // Build a map of competency ID to category ID
    const competencyToCategoryMap = new Map<number, number>();
    competencies.forEach((comp: { id: number; category_id: number }) => {
      if (comp.category_id) {
        competencyToCategoryMap.set(comp.id, comp.category_id);
      }
    });
    
    // Transform heatmap rows and aggregate scores by category
    const heatmapRows = heatmapData.rows.map((row: { user_id: number; user_name: string; class_name: string | null; scores: Record<number, number | null> }) => {
      // Transform competency scores to category scores
      const categoryScores: Record<number, number[]> = {};
      
      Object.entries(row.scores).forEach(([compIdStr, score]) => {
        if (score !== null && !isNaN(score)) {
          const compId = Number(compIdStr);
          const categoryId = competencyToCategoryMap.get(compId);
          if (categoryId) {
            if (!categoryScores[categoryId]) {
              categoryScores[categoryId] = [];
            }
            categoryScores[categoryId].push(score);
          }
        }
      });
      
      // Calculate average score per category for this student
      const avgCategoryScores: Record<number, number | null> = {};
      Object.entries(categoryScores).forEach(([catIdStr, scores]) => {
        const catId = Number(catIdStr);
        avgCategoryScores[catId] = scores.length > 0
          ? scores.reduce((sum, s) => sum + s, 0) / scores.length
          : null;
      });
      
      return {
        studentId: row.user_id,
        name: row.user_name,
        className: row.class_name,
        scores: avgCategoryScores,
      };
    });
    
    // Build category summaries from heatmap data
    const categoryMap = new Map<number, {
      id: number;
      name: string;
      averageScore: number;
      previousAverageScore: number | null;
      trendDelta: number | null;
      numStudentsUp: number;
      numStudentsDown: number;
      numStudentsSame: number;
    }>();
    
    competencies.forEach((comp: { id: number; category_name: string; category_id: number }) => {
      if (!comp.category_id) return;
      
      // Calculate average score for this competency across all students
      const scores = heatmapData.rows
        .map((row: { scores: Record<number, number | null> }) => row.scores[comp.id])
        .filter((s): s is number => s !== null && !isNaN(s));
      
      const averageScore = scores.length > 0
        ? scores.reduce((sum, s) => sum + s, 0) / scores.length
        : 0;
      
      // Skip if averageScore is invalid
      if (isNaN(averageScore)) return;
      
      if (categoryMap.has(comp.category_id)) {
        const existing = categoryMap.get(comp.category_id)!;
        // Update with average of all competencies in this category
        const count = existing.numStudentsUp + 1; // Track how many competencies we've added
        const newAverage = (existing.averageScore * existing.numStudentsUp + averageScore) / count;
        if (!isNaN(newAverage)) {
          categoryMap.set(comp.category_id, {
            ...existing,
            averageScore: newAverage,
            numStudentsUp: count,
          });
        }
      } else {
        categoryMap.set(comp.category_id, {
          id: comp.category_id,
          name: comp.category_name || `Category ${comp.category_id}`,
          averageScore,
          previousAverageScore: null,
          trendDelta: null,
          numStudentsUp: 1, // Track competency count temporarily
          numStudentsDown: 0,
          numStudentsSame: 0,
        });
      }
    });
    
    const categorySummaries = Array.from(categoryMap.values()).map(cat => ({
      ...cat,
      numStudentsUp: 0, // Reset to 0 as we don't have historical data
      numStudentsDown: 0,
      numStudentsSame: 0,
    }));
    
    // Calculate overall statistics
    const allScores = heatmapRows.flatMap((row) => Object.values(row.scores).filter((s): s is number => s !== null));
    const classAverageScore = allScores.length > 0 
      ? allScores.reduce((sum, s) => sum + s, 0) / allScores.length 
      : null;
    
    // Build scans data - fetch multiple windows based on scanRange filter
    const scans = [];
    const scanLimit = filters?.scanRange === "last_5" ? 5 : filters?.scanRange === "all" ? windows.length : 3;
    const windowsToFetch = windows.slice(0, Math.min(scanLimit, windows.length));
    
    for (const window of windowsToFetch) {
      try {
        const windowHeatmapResponse = await api.get(`/competencies/windows/${window.id}/heatmap`);
        const windowHeatmapData = windowHeatmapResponse.data;
        
        // Calculate overall average for this scan
        const windowScores = windowHeatmapData.rows.flatMap((row: { scores: Record<number, number | null> }) => 
          Object.values(row.scores).filter((s): s is number => s !== null && !isNaN(s))
        );
        const windowAverage = windowScores.length > 0
          ? windowScores.reduce((sum: number, s: number) => sum + s, 0) / windowScores.length
          : 0;
        
        scans.push({
          scanId: window.id,
          label: window.title,
          date: window.start_date,
          overallAverage: windowAverage,
          categoryAverages: categorySummaries.map(cat => ({
            categoryId: cat.id,
            categoryName: cat.name,
            averageScore: cat.averageScore,
          })),
        });
      } catch (error) {
        console.error(`Failed to fetch heatmap for window ${window.id}:`, error);
      }
    }
    
    // Calculate notable students from heatmap data
    const notableStudents = [];
    
    // Find students with low scores (average < 2.5 across all categories)
    for (const row of heatmapRows) {
      const scores = Object.values(row.scores).filter((s): s is number => s !== null);
      if (scores.length > 0) {
        const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        
        if (avgScore < 2.5) {
          // Find the lowest category for this student
          let lowestScore = Infinity;
          let lowestCategoryName = null;
          
          Object.entries(row.scores).forEach(([catIdStr, score]) => {
            if (score !== null && score < lowestScore) {
              lowestScore = score;
              const category = categorySummaries.find(c => c.id === Number(catIdStr));
              lowestCategoryName = category?.name || null;
            }
          });
          
          notableStudents.push({
            studentId: row.studentId,
            name: row.name,
            className: row.className,
            type: "low_score" as const,
            score: avgScore,
            trendDelta: null,
            categoryName: lowestCategoryName,
          });
        }
      }
    }
    
    // Calculate trend data if there's a previous window
    let classTrendDelta = null;
    let studentsImproved = 0;
    let studentsDeclined = 0;
    
    if (windows.length >= 2) {
      try {
        // Get data from the previous window
        const previousWindow = windows[1];
        const previousHeatmapResponse = await api.get(`/competencies/windows/${previousWindow.id}/heatmap`);
        const previousHeatmapData = previousHeatmapResponse.data;
        
        // Build competency to category map for previous window
        const previousCompetencies = previousHeatmapData.competencies || [];
        const previousCompToCatMap = new Map<number, number>();
        previousCompetencies.forEach((comp: { id: number; category_id: number }) => {
          if (comp.category_id) {
            previousCompToCatMap.set(comp.id, comp.category_id);
          }
        });
        
        // Calculate previous overall average
        const previousScores = previousHeatmapData.rows.flatMap((row: { scores: Record<number, number | null> }) => 
          Object.values(row.scores).filter((s): s is number => s !== null && !isNaN(s))
        );
        const previousAverage = previousScores.length > 0
          ? previousScores.reduce((sum: number, s: number) => sum + s, 0) / previousScores.length
          : null;
        
        if (previousAverage !== null && classAverageScore !== null) {
          classTrendDelta = classAverageScore - previousAverage;
        }
        
        // Build a map of student scores from previous window
        const previousStudentScores = new Map<number, number>();
        for (const row of previousHeatmapData.rows) {
          const categoryScores: Record<number, number[]> = {};
          Object.entries(row.scores).forEach(([compIdStr, score]) => {
            if (score !== null && !isNaN(score as number)) {
              const compId = Number(compIdStr);
              const categoryId = previousCompToCatMap.get(compId);
              if (categoryId) {
                if (!categoryScores[categoryId]) {
                  categoryScores[categoryId] = [];
                }
                categoryScores[categoryId].push(score as number);
              }
            }
          });
          
          // Calculate overall average for this student in previous window
          const allScoresForStudent = Object.values(categoryScores).flat();
          if (allScoresForStudent.length > 0) {
            const avgScore = allScoresForStudent.reduce((sum, s) => sum + s, 0) / allScoresForStudent.length;
            previousStudentScores.set(row.user_id, avgScore);
          }
        }
        
        // Compare current vs previous for each student
        for (const row of heatmapRows) {
          const currentScores = Object.values(row.scores).filter((s): s is number => s !== null);
          if (currentScores.length > 0) {
            const currentAvg = currentScores.reduce((sum, s) => sum + s, 0) / currentScores.length;
            const previousAvg = previousStudentScores.get(row.studentId);
            
            if (previousAvg !== undefined) {
              const delta = currentAvg - previousAvg;
              if (delta > 0.1) { // Threshold for improvement
                studentsImproved++;
              } else if (delta < -0.1) { // Threshold for decline
                studentsDeclined++;
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch previous window data for trend calculation:", error);
      }
    }
    
    return {
      classAverageScore,
      classTrendDelta,
      studentsImproved,
      studentsDeclined,
      totalStudents: heatmapRows.length,
      categorySummaries,
      scans,
      heatmapRows,
      notableStudents,
    };
  },

  /**
   * Get category detail data
   */
  async getCategoryDetail(categoryId: number, filters?: CompetencyOverviewFilters): Promise<CategoryDetailData> {
    // For now, return minimal data as we don't have a specific endpoint for category details
    // This would need a backend endpoint to provide detailed category statistics
    
    const overviewData = await this.getOverview(filters);
    const category = overviewData.categorySummaries.find((c) => c.id === categoryId);
    
    if (!category) {
      throw new Error(`Category ${categoryId} not found`);
    }
    
    // Calculate score distribution from heatmap
    const scoreDistribution: { score: number; count: number }[] = [
      { score: 1, count: 0 },
      { score: 2, count: 0 },
      { score: 3, count: 0 },
      { score: 4, count: 0 },
      { score: 5, count: 0 },
    ];
    
    // Count scores by rounding to nearest integer
    overviewData.heatmapRows.forEach(row => {
      Object.values(row.scores).forEach(score => {
        if (score !== null) {
          const roundedScore = Math.round(score);
          const bucketIndex = Math.max(0, Math.min(4, roundedScore - 1));
          scoreDistribution[bucketIndex].count++;
        }
      });
    });
    
    return {
      category,
      scoreDistribution,
      riskStudents: [], // Would need a backend endpoint
      minScore: null,
      maxScore: null,
    };
  },

  /**
   * Get students list
   */
  async getStudents(filters?: CompetencyOverviewFilters): Promise<StudentCompetencySummary[]> {
    const overviewData = await this.getOverview(filters);
    
    // Transform heatmap rows to student summaries
    return overviewData.heatmapRows.map(row => {
      const scores = Object.values(row.scores).filter((s): s is number => s !== null);
      const lastOverallScore = scores.length > 0
        ? scores.reduce((sum, s) => sum + s, 0) / scores.length
        : null;
      
      // Find strongest and weakest categories
      let strongestCategory: string | null = null;
      let weakestCategory: string | null = null;
      let maxScore = -Infinity;
      let minScore = Infinity;
      
      overviewData.categorySummaries.forEach(cat => {
        // Find competencies in this category
        const categoryScores = Object.entries(row.scores)
          .filter(([compId, score]) => score !== null)
          .map(([_, score]) => score as number);
        
        if (categoryScores.length > 0) {
          const avgScore = categoryScores.reduce((sum, s) => sum + s, 0) / categoryScores.length;
          if (avgScore > maxScore) {
            maxScore = avgScore;
            strongestCategory = cat.name;
          }
          if (avgScore < minScore) {
            minScore = avgScore;
            weakestCategory = cat.name;
          }
        }
      });
      
      return {
        studentId: row.studentId,
        name: row.name,
        className: row.className,
        lastScanDate: null, // Would need from backend
        lastOverallScore,
        trendDelta: null, // Would need historical data
        strongestCategory,
        weakestCategory,
      };
    }).filter(student => {
      // Apply search filter if provided
      if (filters?.searchQuery) {
        return student.name.toLowerCase().includes(filters.searchQuery.toLowerCase());
      }
      return true;
    });
  },

  /**
   * Get learning goals
   */
  async getLearningGoals(filters?: CompetencyOverviewFilters): Promise<LearningGoalSummary[]> {
    // Get the competency windows, filtering by course if specified
    const windowsParams: Record<string, unknown> = { status: "all" };
    if (filters?.courseId) {
      windowsParams.course_id = filters.courseId;
    }
    
    const windowsResponse = await api.get("/competencies/windows/", {
      params: windowsParams,
    });
    const windows = windowsResponse.data;
    
    if (!windows || windows.length === 0) {
      return [];
    }
    
    // Determine which windows to fetch based on scanRange filter
    const scanLimit = filters?.scanRange === "last_5" ? 5 : filters?.scanRange === "all" ? windows.length : 3;
    const windowsToFetch = windows.slice(0, Math.min(scanLimit, windows.length));
    
    // Fetch goals from all selected windows
    let allGoals: LearningGoalSummary[] = [];
    
    for (const window of windowsToFetch) {
      try {
        const goalsResponse = await api.get(`/competencies/windows/${window.id}/goals`, {
          params: filters?.status ? { status: filters.status } : {},
        });
        const apiGoals = goalsResponse.data.items || [];
        
        // Transform API response to our format
        const windowGoals: LearningGoalSummary[] = apiGoals.map((g: {
          id: number;
          user_id: number;
          user_name: string;
          class_name: string | null;
          competency_id: number | null;
          competency_name: string | null;
          category_name: string | null;
          goal_text: string;
          status: string;
          submitted_at: string;
          updated_at: string;
        }) => ({
          id: g.id,
          studentId: g.user_id,
          studentName: g.user_name,
          className: g.class_name,
          categoryId: null,
          categoryName: g.category_name,
          goalText: g.goal_text,
          status: g.status as "in_progress" | "achieved" | "not_achieved",
          createdAt: g.submitted_at,
          updatedAt: g.updated_at,
        }));
        
        allGoals = allGoals.concat(windowGoals);
      } catch (error) {
        console.error(`Failed to fetch goals for window ${window.id}:`, error);
      }
    }
    
    // Apply local filters
    if (filters?.categoryId) {
      allGoals = allGoals.filter((g) => g.categoryId === filters.categoryId);
    }
    
    return allGoals;
  },

  /**
   * Get reflections
   */
  async getReflections(filters?: CompetencyOverviewFilters): Promise<ReflectionSummary[]> {
    // Get the competency windows, filtering by course if specified
    const windowsParams: Record<string, unknown> = { status: "all" };
    if (filters?.courseId) {
      windowsParams.course_id = filters.courseId;
    }
    
    const windowsResponse = await api.get("/competencies/windows/", {
      params: windowsParams,
    });
    const windows = windowsResponse.data;
    
    if (!windows || windows.length === 0) {
      return [];
    }
    
    // Determine which windows to fetch based on scanRange filter
    const scanLimit = filters?.scanRange === "last_5" ? 5 : filters?.scanRange === "all" ? windows.length : 3;
    const windowsToFetch = windows.slice(0, Math.min(scanLimit, windows.length));
    
    // Fetch reflections from all selected windows
    let allReflections: ReflectionSummary[] = [];
    
    for (const window of windowsToFetch) {
      try {
        const reflectionsResponse = await api.get(`/competencies/windows/${window.id}/reflections`);
        const apiReflections = reflectionsResponse.data.items || [];
        
        // Transform API response to our format
        const windowReflections: ReflectionSummary[] = apiReflections.map((r: {
          id: number;
          user_id: number;
          user_name: string;
          class_name: string | null;
          text: string;
          goal_id: number | null;
          goal_text: string | null;
          submitted_at: string;
          updated_at: string;
        }) => ({
          id: r.id,
          studentId: r.user_id,
          studentName: r.user_name,
          className: r.class_name,
          categoryId: null,
          categoryName: null,
          scanId: window.id,
          scanLabel: window.title,
          createdAt: r.submitted_at,
          reflectionText: r.text,
        }));
        
        allReflections = allReflections.concat(windowReflections);
      } catch (error) {
        console.error(`Failed to fetch reflections for window ${window.id}:`, error);
      }
    }
    
    return allReflections;
  },

  /**
   * Get filter options (academic years, courses, scans, categories)
   */
  async getFilterOptions(): Promise<FilterOptions> {
    // Get windows for scans
    const windowsResponse = await api.get("/competencies/windows/", {
      params: { status: "all" },
    });
    const windows = windowsResponse.data;
    
    // Get categories
    const categoriesResponse = await api.get("/competencies/categories");
    const categories = categoriesResponse.data;
    
    // Get academic years
    const academicYearsResponse = await api.get("/overview/academic-years");
    const academicYears = academicYearsResponse.data;
    
    // Get courses
    const coursesResponse = await api.get("/overview/courses");
    const courses = coursesResponse.data;
    
    return {
      academicYears: academicYears.map((ay: { id: number; label: string }) => ({
        id: ay.id,
        label: ay.label,
      })),
      courses: courses.map((c: { id: number; name: string }) => ({
        id: c.id,
        name: c.name,
      })),
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
  },

  /**
   * Get detailed data for a single student
   */
  async getStudentDetail(studentId: number): Promise<StudentDetailData | null> {
    // Get the latest competency window
    const windowsResponse = await api.get("/competencies/windows/", {
      params: { status: "all" },
    });
    const windows = windowsResponse.data;
    
    if (!windows || windows.length === 0) {
      return null;
    }
    
    const latestWindow = windows[0];
    
    // Get student overview from backend
    try {
      const studentOverviewResponse = await api.get(`/competencies/windows/${latestWindow.id}/student/${studentId}/overview`);
      const data = studentOverviewResponse.data;
      
      // Transform to our format
      const currentCategoryScores = data.scores.map((s: { competency_id: number; competency_name: string; category_name: string | null; self_score: number | null }) => ({
        categoryId: s.competency_id,
        categoryName: s.competency_name,
        score: s.self_score,
      }));
      
      const currentOverallScore = currentCategoryScores
        .filter((s: { score: number | null }) => s.score !== null)
        .reduce((sum: number, s: { score: number }) => sum + s.score, 0) / currentCategoryScores.filter((s: { score: number | null }) => s.score !== null).length;
      
      return {
        studentId: data.user_id,
        name: data.user_name,
        className: null,
        email: null,
        currentOverallScore: currentOverallScore || null,
        currentCategoryScores,
        trendDelta: null,
        strongestCategory: null,
        weakestCategory: null,
        scans: [], // Would need historical data
        learningGoals: data.goals || [],
        reflections: data.reflection ? [data.reflection] : [],
      };
    } catch (error) {
      console.error("Failed to fetch student detail:", error);
      return null;
    }
  },
};
