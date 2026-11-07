import { prisma } from "../lib/prisma";
import { moderateText } from "../utils/contentModeration";

export interface CommentWithAuthor {
  id: string;
  content: string;
  postId: string;
  authorId: string;
  isFlagged: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    username: string;
    avatar: string | null;
  };
}

/**
 * Creates a comment on a post with automated content moderation.
 * Filters toxic keywords and spam links before persistence, and updates post engagement score.
 */
export async function createComment(
  postId: string,
  content: string,
  authorId: string
): Promise<CommentWithAuthor> {
  // Ensure post and author exist
  const [post] = await Promise.all([
    prisma.post.findUniqueOrThrow({
      where: { id: postId },
      include: {
        _count: { select: { saves: true, comments: true, likes: true } },
      },
    }),
    prisma.user.findUniqueOrThrow({ where: { id: authorId } }),
  ]);

  // Automated Content Moderation & Masking
  const moderation = moderateText(content);

  const comment = await prisma.comment.create({
    data: {
      content: moderation.cleanText,
      isFlagged: moderation.isFlagged,
      postId,
      authorId,
    },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          avatar: true,
        },
      },
    },
  });

  // Dynamically update post engagement score:
  // score = (savesCount * 5.0) + (likesCount * 2.0) + (commentsCount * 1.5) + (viewDuration / 60)
  const newCommentsCount = post._count.comments + 1;
  const savesCount = post._count.saves;
  const likesCount = (post.likesCount || 0) + (post._count.likes || 0);
  const viewDuration = post.viewDuration || 0;
  const newScore =
    savesCount * 5.0 + likesCount * 2.0 + newCommentsCount * 1.5 + viewDuration / 60.0;

  await prisma.post.update({
    where: { id: postId },
    data: {
      engagementScore: Math.round(newScore * 100) / 100,
    },
  });

  return comment;
}

/**
 * Returns all comments for a post in chronological order.
 */
export async function getCommentsByPostId(postId: string): Promise<CommentWithAuthor[]> {
  return prisma.comment.findMany({
    where: { postId },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          avatar: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

