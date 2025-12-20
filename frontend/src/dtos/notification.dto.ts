export type NotificationOut = {
  id: number;
  school_id: number;
  recipient_user_id: number;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  read_at?: string | null;
  created_at: string;
};

export type NotificationsResponse = {
  items: NotificationOut[];
  total: number;
  unread_count: number;
};
