import api from "@/lib/api";

export type CalendarTokenResponse = {
  token: string;
  webcal_url: string;
  https_url: string;
  google_calendar_url: string;
  outlook_url: string;
};

export const calendarFeedService = {
  /**
   * Generate (or regenerate) a personal iCal feed token.
   * Returns token and all subscription URLs.
   */
  async generateToken(): Promise<CalendarTokenResponse> {
    const response = await api.post<CalendarTokenResponse>(
      "/calendar/generate-token",
    );
    return response.data;
  },

  /**
   * Revoke the current iCal feed token.
   * Existing calendar subscriptions will stop working after this.
   */
  async revokeToken(): Promise<void> {
    await api.delete("/calendar/revoke-token");
  },

  /**
   * Get the current token and subscription URLs, or null if no token exists.
   */
  async getToken(): Promise<CalendarTokenResponse | null> {
    const response = await api.get<CalendarTokenResponse | null>(
      "/calendar/token-status",
    );
    return response.data;
  },
};
