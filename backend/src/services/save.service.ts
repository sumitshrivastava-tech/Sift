import { prisma } from "../lib/prisma";
import { createNotification } from "./notification.service";

export interface SaveResult {
  id: string;
  userId: string;
  postId: string;
  boardId?: string | null;
  createdAt: Date;
}

/**
 * Recalculates and updates the engagement score on a post.
 * score = (savesCount * 5.0) + (likesCount * 2.0) + (commentsCount * 1.5) + (viewDuration / 60)
 */
async function syncPostEngagementScore(postId: string): Promise<void> {
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        _count: { select: { saves: true, comments: true, likes: true } },
      },
    });

    if (!post) return;

    const savesCount = post._count.saves;
    const likesCount = (post.likesCount || 0) + (post._count.likes || 0);
    const commentsCount = post._count.comments;
    const viewDuration = post.viewDuration || 0;

    const score =
      savesCount * 5.0 + likesCount * 2.0 + commentsCount * 1.5 + viewDuration / 60.0;

    await prisma.post.update({
      where: { id: postId },
      data: { engagementScore: Math.round(score * 100) / 100 },
    });
  } catch (err) {
    // Non-blocking sync failure
    console.warn(`Failed to update engagement score for post ${postId}:`, err);
  }
}

/**
 * Saves a post for a user, optionally linking it to a Collaborative Canvas Board.
 */
export async function savePost(
  userId: string,
  postId: string,
  boardId?: string | null
): Promise<SaveResult> {
  // Verify user and post exist
  await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.post.findUniqueOrThrow({ where: { id: postId } }),
    boardId ? prisma.board.findUniqueOrThrow({ where: { id: boardId } }) : Promise.resolve(null),
  ]);

  // Idempotency: return existing save if already saved to this target
  const existingSave = await prisma.save.findFirst({
    where: {
      userId,
      postId,
      boardId: boardId ?? null,
    },
    select: { id: true, userId: true, postId: true, boardId: true, createdAt: true },
  });

  if (existingSave) {
    return existingSave;
  }

  const save = await prisma.save.create({
    data: {
      userId,
      postId,
      boardId: boardId ?? null,
    },
    select: { id: true, userId: true, postId: true, boardId: true, createdAt: true },
  });

  // Re-sync weighted score
  await syncPostEngagementScore(postId);

  // Notify post author
  prisma.post
    .findUnique({ where: { id: postId }, select: { authorId: true } })
    .then((p) => {
      if (p && p.authorId !== userId) {
        createNotification({
          type: "POST_SAVED",
          actorId: userId,
          recipientId: p.authorId,
          postId,
          boardName: boardId ? "Canvas Board" : "Collection",
        }).catch(() => {});
      }
    })
    .catch(() => {});

  return save;
}

/**
 * Removes a saved post for a user (optionally scoped to a board).
 */
export async function unsavePost(
  userId: string,
  postId: string,
  boardId?: string | null
): Promise<void> {
  await prisma.save.deleteMany({
    where: {
      userId,
      postId,
      ...(boardId !== undefined ? { boardId: boardId ?? null } : {}),
    },
  });

  // Re-sync weighted score
  await syncPostEngagementScore(postId);
}

/**
 * Returns all saves for a given user with post and board details.
 */
export async function getUserSaves(userId: string) {
  return prisma.save.findMany({
    where: { userId },
    include: {
      board: {
        select: { id: true, name: true, isPrivate: true },
      },
      post: {
        include: {
          author: { select: { id: true, username: true, avatar: true } },
          _count: { select: { saves: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
