'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { notificationService } from '@/services/notification.service';
import { NotificationOut } from '@/dtos/notification.dto';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

interface NotificationsListProps {
  onNotificationRead?: () => void;
}

export function NotificationsList({ onNotificationRead }: NotificationsListProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationService.getNotifications(false, 20);
      setNotifications(data.items);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification: NotificationOut) => {
    // Mark as read if not already
    if (!notification.read_at) {
      try {
        await notificationService.markAsRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n
          )
        );
        onNotificationRead?.();
      } catch (err) {
        console.error('Failed to mark as read:', err);
      }
    }

    // Navigate to the link if available
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
      onNotificationRead?.();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-muted-foreground">Laden...</p>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">Geen notificaties</p>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Notificaties</h3>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead}>
            Alles markeren als gelezen
          </Button>
        )}
      </div>

      <ScrollArea className="max-h-96">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
              !notification.read_at ? 'bg-blue-50' : ''
            }`}
            onClick={() => handleNotificationClick(notification)}
          >
            <div className="flex items-start gap-3">
              {!notification.read_at && (
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{notification.title}</p>
                {notification.body && (
                  <p className="text-sm text-muted-foreground mt-1">{notification.body}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {formatDistanceToNow(new Date(notification.created_at), {
                    addSuffix: true,
                    locale: nl,
                  })}
                </p>
              </div>
            </div>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}
