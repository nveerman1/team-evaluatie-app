import api from "@/lib/api";

export interface AttendanceEvent {
  id: number;
  user_id: number;
  project_id: number | null;
  check_in: string;
  check_out: string | null;
  is_external: boolean;
  location: string | null;
  description: string | null;
  approval_status: string | null;
  approved_by: number | null;
  approved_at: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  duration_seconds: number | null;
}

export interface AttendanceEventListResponse {
  events: AttendanceEvent[];
  total: number;
  page: number;
  per_page: number;
}

export interface OpenSession {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  class_name: string | null;
  check_in: string;
  project_id: number | null;
  project_name: string | null;
  duration_seconds: number;
}

export interface AttendanceTotals {
  user_id: number;
  total_school_seconds: number;
  total_external_approved_seconds: number;
  total_external_pending_seconds: number;
  lesson_blocks: number;
}

export interface ExternalWorkCreate {
  check_in: string;
  check_out: string;
  location: string;
  description: string;
  project_id?: number;
}

export interface RFIDCard {
  id: number;
  user_id: number;
  uid: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: number | null;
}

// ========== Statistics Interfaces ==========

export interface Course {
  id: number;
  name: string;
  code: string | null;
}

export interface StatsSummary {
  school_minutes: number;
  school_blocks: number;
  extern_approved_minutes: number;
  extern_approved_blocks: number;
  total_blocks: number;
  school_percentage: number;
  extern_percentage: number;
}

export interface WeeklyStats {
  week_start: string;
  total_blocks: number;
  school_blocks: number;
  extern_blocks: number;
}

export interface DailyStats {
  date: string;
  unique_students: number;
}

export interface HeatmapCell {
  weekday: number;
  hour: number;
  avg_students: number;
  label: string;
}

export interface HeatmapData {
  cells: HeatmapCell[];
}

export interface StudentSignal {
  student_id: number;
  student_name: string;
  course: string | null;
  value_text: string;
}

export interface SignalsData {
  extern_low_school: StudentSignal[];
  many_pending: StudentSignal[];
  long_open: StudentSignal[];
}

export interface EngagementStudent {
  student_id: number;
  student_name: string;
  course: string | null;
  total_blocks: number;
}

export interface TopBottomData {
  top: EngagementStudent[];
  bottom: EngagementStudent[];
}

export const attendanceService = {
  /**
   * Get list of attendance events with filters
   */
  async listEvents(params?: {
    user_id?: number;
    class_name?: string;
    project_id?: number;
    start_date?: string;
    end_date?: string;
    is_external?: boolean;
    status_open?: boolean;
    approval_status?: string;
    page?: number;
    per_page?: number;
  }): Promise<AttendanceEventListResponse> {
    const response = await api.get<AttendanceEventListResponse>("/attendance/events", { params });
    return response.data;
  },

  /**
   * Get current presence (open sessions)
   */
  async getPresence(): Promise<OpenSession[]> {
    const response = await api.get<OpenSession[]>("/attendance/presence");
    return response.data;
  },

  /**
   * Update an attendance event
   */
  async updateEvent(eventId: number, data: Partial<AttendanceEvent>): Promise<AttendanceEvent> {
    const response = await api.patch<AttendanceEvent>(`/attendance/events/${eventId}`, data);
    return response.data;
  },

  /**
   * Delete an attendance event
   */
  async deleteEvent(eventId: number): Promise<void> {
    await api.delete(`/attendance/events/${eventId}`);
  },

  /**
   * Bulk delete attendance events
   */
  async bulkDeleteEvents(eventIds: number[]): Promise<void> {
    await api.post("/attendance/events/bulk-delete", { event_ids: eventIds });
  },

  /**
   * Create external work registration
   */
  async createExternalWork(data: ExternalWorkCreate): Promise<AttendanceEvent> {
    const response = await api.post<AttendanceEvent>("/attendance/external", data);
    return response.data;
  },

  /**
   * Approve external work
   */
  async approveExternalWork(eventId: number): Promise<AttendanceEvent> {
    const response = await api.patch<AttendanceEvent>(`/attendance/external/${eventId}/approve`, {});
    return response.data;
  },

  /**
   * Reject external work
   */
  async rejectExternalWork(eventId: number, reason?: string): Promise<AttendanceEvent> {
    const response = await api.patch<AttendanceEvent>(`/attendance/external/${eventId}/reject`, { reason });
    return response.data;
  },

  /**
   * Bulk approve external work
   */
  async bulkApproveExternalWork(eventIds: number[]): Promise<void> {
    await api.post("/attendance/external/bulk-approve", { event_ids: eventIds });
  },

  /**
   * Get current user's attendance totals
   */
  async getMyAttendance(): Promise<AttendanceTotals> {
    const response = await api.get<AttendanceTotals>("/attendance/me");
    return response.data;
  },

  // ========== Statistics Endpoints ==========

  /**
   * Get list of courses for filters
   */
  async listCourses(): Promise<Course[]> {
    const response = await api.get<Course[]>("/attendance/courses");
    return response.data;
  },

  /**
   * Get summary statistics
   */
  async getStatsSummary(params: {
    period: string;
    course_id?: number;
    project_id?: number;
  }): Promise<StatsSummary> {
    const response = await api.get<StatsSummary>("/attendance/stats/summary", { params });
    return response.data;
  },

  /**
   * Get weekly trend data
   */
  async getStatsWeekly(params: {
    period: string;
    course_id?: number;
    project_id?: number;
  }): Promise<WeeklyStats[]> {
    const response = await api.get<WeeklyStats[]>("/attendance/stats/weekly", { params });
    return response.data;
  },

  /**
   * Get daily unique student data
   */
  async getStatsDaily(params: {
    period: string;
    course_id?: number;
    project_id?: number;
  }): Promise<DailyStats[]> {
    const response = await api.get<DailyStats[]>("/attendance/stats/daily", { params });
    return response.data;
  },

  /**
   * Get heatmap data
   */
  async getStatsHeatmap(params: {
    period: string;
    course_id?: number;
    project_id?: number;
  }): Promise<HeatmapData> {
    const response = await api.get<HeatmapData>("/attendance/stats/heatmap", { params });
    return response.data;
  },

  /**
   * Get signals/anomalies
   */
  async getStatsSignals(params: {
    period: string;
    course_id?: number;
    project_id?: number;
  }): Promise<SignalsData> {
    const response = await api.get<SignalsData>("/attendance/stats/signals", { params });
    return response.data;
  },

  /**
   * Get top and bottom engagement
   */
  async getStatsTopBottom(params: {
    period: string;
    course_id?: number;
    project_id?: number;
    mode: string;
  }): Promise<TopBottomData> {
    const response = await api.get<TopBottomData>("/attendance/stats/top-bottom", { params });
    return response.data;
  },
};

export const rfidService = {
  /**
   * List RFID cards for a user
   */
  async listCards(userId: number): Promise<RFIDCard[]> {
    const response = await api.get<RFIDCard[]>(`/rfid/${userId}`);
    return response.data;
  },

  /**
   * Create new RFID card for user
   */
  async createCard(userId: number, data: { uid: string; label?: string; is_active?: boolean }): Promise<RFIDCard> {
    const response = await api.post<RFIDCard>(`/rfid/${userId}`, data);
    return response.data;
  },

  /**
   * Update RFID card
   */
  async updateCard(cardId: number, data: { label?: string; is_active?: boolean }): Promise<RFIDCard> {
    const response = await api.patch<RFIDCard>(`/rfid/${cardId}`, data);
    return response.data;
  },

  /**
   * Delete RFID card
   */
  async deleteCard(cardId: number): Promise<void> {
    await api.delete(`/rfid/${cardId}`);
  },
};
