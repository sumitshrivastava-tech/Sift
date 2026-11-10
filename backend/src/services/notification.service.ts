import { prisma } from "../lib/prisma";

export type NotificationType = "NEW_FOLLOWER" | "POST_SAVED" | "NEW_COMMENT";

export interface FormattedNotification {
  id: string;
  type: NotificationType;
  actor: {
    id: string;
    username: string;
    fullName?: string | null;
    avatar: string;
  };
  targetDetails?: {
    postId?: string;
    postTitle?: string;
    postThumbnail?: string;
    boardName?: string;
    commentText?: string;
  };
  timestamp: string;
  isUnread: boolean;
  createdAt: string;
}

// Initial demo notifications to guarantee instant Lemon8 aesthetic activity
const SEED_NOTIFICATIONS: FormattedNotification[] = [
  {
    id: "notif-seed-1",
    type: "POST_SAVED",
    actor: {
      id: "cr-kuro",
      username: "kuro_space",
      fullName: "Kuro Studio",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    },
    targetDetails: {
      postId: "p-brutalist-1",
      postTitle: "Raw Concrete Pavilion",
      postThumbnail:
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=300&q=80",
      boardName: "Minimalist Arch",
    },
    timestamp: "14m ago",
    isUnread: true,
    createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
  },
  {
    id: "notif-seed-2",
    type: "NEW_FOLLOWER",
    actor: {
      id: "cr-marcus",
      username: "marcus_minimal",
      fullName: "Marcus Vance",
      avatar:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    },
    timestamp: "1h ago",
    isUnread: true,
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    id: "notif-seed-3",
    type: "NEW_COMMENT",
    actor: {
      id: "cr-elena",
      username: "elena_design",
      fullName: "Elena Rostova",
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    },
    targetDetails: {
      postId: "p-nordic-1",
      postTitle: "Minimalist Oak Pavilion",
      postThumbnail:
        "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=300&q=80",
      commentText: "The negative space and natural light grading here are mesmerizing.",
    },
    timestamp: "3h ago",
    isUnread: true,
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  },
  {
    id: "notif-seed-4",
    type: "POST_SAVED",
    actor: {
      id: "cr-bijoy",
      username: "studio_mumbai",
      fullName: "Bijoy Jain",
      avatar:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80",
    },
    targetDetails: {
      postId: "p-terracotta-1",
      postTitle: "Courtyard Brick Screen",
      postThumbnail:
        "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=300&q=80",
      boardName: "Earth & Materiality",
    },
    timestamp: "1d ago",
    isUnread: false,
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  },
];

// In-memory read state for starter notifications
let readNotifIds = new Set<string>();

function formatTimestamp(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Normalizes filter type to matching NotificationType strings.
 */
function getMatchingTypes(filterType?: string): string[] | null {
  if (!filterType || filterType.toUpperCase() === "ALL") return null;
  const f = filterType.toUpperCase();
  if (f === "FOLLOWERS" || f === "FOLLOWER" || f === "NEW_FOLLOWER") {
    return ["NEW_FOLLOWER", "FOLLOWER", "FOLLOWERS"];
  }
  if (f === "SAVES" || f === "SAVE" || f === "POST_SAVED") {
    return ["POST_SAVED", "SAVES", "SAVE"];
  }
  if (f === "COMMENTS" || f === "COMMENT" || f === "NEW_COMMENT") {
    return ["NEW_COMMENT", "COMMENTS", "COMMENT"];
  }
  return [f];
}

/**
 * GET /api/notifications
 * Fetches notifications for recipient with actor avatar, username, and post thumbnail.
 */
export async function getNotifications(
  recipientId: string,
  filterType?: string
): Promise<FormattedNotification[]> {
  const types = getMatchingTypes(filterType);

  try {
    const dbNotifs = await prisma.notification.findMany({
      where: {
        recipientId,
        ...(types ? { type: { in: types } } : {}),
      },
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true,
          },
        },
        post: {
          select: {
            id: true,
            title: true,
            images: true,
          },
        },
        comment: {
          select: {
            id: true,
            content: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (dbNotifs && dbNotifs.length > 0) {
      return dbNotifs.map((n) => {
        let postThumbnail: string | undefined;
        if (n.post?.images) {
          try {
            const parsed = JSON.parse(n.post.images);
            postThumbnail = Array.isArray(parsed) ? parsed[0] : n.post.images;
          } catch {
            postThumbnail = n.post.images;
          }
        }

        let normalizedType: NotificationType = "NEW_FOLLOWER";
        const t = n.type.toUpperCase();
        if (t.includes("SAVE")) normalizedType = "POST_SAVED";
        else if (t.includes("COMMENT")) normalizedType = "NEW_COMMENT";

        return {
          id: n.id,
          type: normalizedType,
          actor: {
            id: n.actor.id,
            username: n.actor.username,
            fullName: n.actor.fullName,
            avatar:
              n.actor.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(n.actor.username)}&background=111827&color=fff`,
          },
          targetDetails: {
            postId: n.postId || undefined,
            postTitle: n.post?.title || undefined,
            postThumbnail,
            boardName: n.boardName || undefined,
            commentText: n.comment?.content || n.content || undefined,
          },
          timestamp: formatTimestamp(new Date(n.createdAt)),
          isRead: n.isRead,
          isUnread: !n.isRead,
          createdAt: n.createdAt.toISOString(),
        };
      });
    }
  } catch (err) {
    console.warn("[NotificationService] Fallback to starter feed:", err);
  }

  // Graceful starter notifications when user has no DB notifications yet
  let list = SEED_NOTIFICATIONS.map((item) => ({
    ...item,
    isUnread: !readNotifIds.has(item.id) && item.isUnread,
  }));

  if (types && types.length > 0) {
    list = list.filter((item) => types.includes(item.type));
  }

  return list;
}

/**
 * PATCH /api/notifications/read
 * Marks all notifications for a recipient as read.
 */
export async function markNotificationsAsRead(
  recipientId: string
): Promise<{ success: boolean; unreadCount: number }> {
  try {
    await prisma.notification.updateMany({
      where: {
        recipientId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });
  } catch (err) {
    console.warn("[NotificationService] Prisma updateMany notice:", err);
  }

  // Also mark starter items as read
  SEED_NOTIFICATIONS.forEach((n) => readNotifIds.add(n.id));

  return { success: true, unreadCount: 0 };
}

/**
 * Helper to record a new notification in the database
 */
export async function createNotification(data: {
  type: string;
  actorId: string;
  recipientId: string;
  postId?: string;
  commentId?: string;
  boardName?: string;
  content?: string;
}) {
  try {
    return await prisma.notification.create({
      data: {
        type: data.type,
        actorId: data.actorId,
        recipientId: data.recipientId,
        postId: data.postId,
        commentId: data.commentId,
        boardName: data.boardName,
        content: data.content,
      },
    });
  } catch (err) {
    console.warn("[NotificationService] Failed to create notification:", err);
    return null;
  }
}

