import api from "@/lib/api";
import { NotificationOut, NotificationsResponse } from "@/dtos/notification.dto";

export const notificationService = {
  /**
   * Get notifications for the current user
   */
  async getNotifications(unreadOnly: boolean = false, limit: number = 50): Promise<NotificationsResponse> {
    const params = new URLSearchParams();
    if (unreadOnly) params.set("unread_only", "true");
    params.set("limit", limit.toString());
    const queryString = params.toString();
    const url = queryString ? `/notifications?${queryString}` : "/notifications";
    const response = await api.get<NotificationsResponse>(url);
    return response.data;
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: number): Promise<NotificationOut> {
    const response = await api.patch<NotificationOut>(
      `/notifications/${notificationId}/read`
    );
    return response.data;
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    await api.post("/notifications/mark-all-read");
  },
};
