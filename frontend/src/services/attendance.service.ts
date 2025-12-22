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
