import prisma from "../prismaClient";
import { broadcastNotification } from "../socketServer";
import { Logger } from "../utils/logger.util";

type NotificationType = "NEW_MATCH" | "PRICE_DROP" | "SCRAPE_COMPLETE" | "SCRAPE_FAILED" | "SYSTEM";

export class NotificationService {
  /**
   * Create a notification and broadcast via Socket.io
   */
  static async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }) {
    // Respect quiet hours
    try {
      const user = await prisma.user.findUnique({
        where: { id: data.userId },
        select: {
          notifQuietHoursEnabled: true,
          notifQuietStart: true,
          notifQuietEnd: true,
        },
      });

      if (user?.notifQuietHoursEnabled && user.notifQuietStart != null && user.notifQuietEnd != null) {
        const now = new Date();
        const currentHour = now.getHours(); // Server time (Africa/Lagos expected)
        const start = user.notifQuietStart;
        const end = user.notifQuietEnd;

        const isQuiet = start <= end
          ? currentHour >= start && currentHour < end
          : currentHour >= start || currentHour < end;

        if (isQuiet) {
          // Still persist the notification but skip the real-time broadcast
          const notification = await prisma.notification.create({
            data: {
              userId: data.userId,
              type: data.type,
              title: data.title,
              message: data.message,
              data: data.data as any,
            },
          });
          Logger.debug(`[Notification] Created during quiet hours (no broadcast) for user ${data.userId}`);
          return notification;
        }
      }
    } catch (err: any) {
      Logger.warn(`[Notification] Failed to check quiet hours: ${err.message}`);
    }
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data as any,
      },
    });

    // Broadcast real-time via Socket.io
    try {
      broadcastNotification(data.userId, {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        read: notification.read,
        createdAt: notification.createdAt.toISOString(),
      });
    } catch (err: any) {
      Logger.error(`[Notification] Failed to broadcast: ${err.message}`);
    }

    return notification;
  }

  /**
   * List notifications for a user with pagination
   */
  static async list(
    userId: string,
    options: { read?: boolean; limit?: number; offset?: number } = {}
  ) {
    const { read, limit = 20, offset = 0 } = options;

    const where: any = { userId };
    if (read !== undefined) where.read = read;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);

    return { notifications, total, unreadCount };
  }

  /**
   * Get unread count for a user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, read: false },
    });
  }

  /**
   * Mark a single notification as read
   */
  static async markRead(id: string, userId: string) {
    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) return null;

    return prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
  }

  /**
   * Delete old notifications (older than 30 days)
   */
  static async cleanupOld(daysOld = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    const result = await prisma.notification.deleteMany({
      where: { createdAt: { lt: cutoff }, read: true },
    });

    return result.count;
  }
}
