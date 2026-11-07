import { prisma } from "../lib/prisma";

export interface CreateBoardDTO {
  name: string;
  description?: string;
  isPrivate?: boolean;
  ownerId: string;
}

export interface AddCollaboratorDTO {
  boardId: string;
  username: string; // Accepts raw username or "@username"
  role?: string;    // "editor" | "viewer" | "admin"
}

/**
 * Creates a new collaborative board and adds the creator as the initial owner collaborator.
 */
export async function createBoard(data: CreateBoardDTO) {
  // Ensure owner exists
  const owner = await prisma.user.findUnique({
    where: { id: data.ownerId },
  });

  if (!owner) {
    const error: any = new Error(`Owner with ID "${data.ownerId}" does not exist.`);
    error.status = 404;
    throw error;
  }

  // Create board and associate owner collaborator in a transaction
  const board = await prisma.board.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim() ?? null,
      isPrivate: data.isPrivate ?? true,
      ownerId: data.ownerId,
      collaborators: {
        create: {
          userId: data.ownerId,
          role: "owner",
        },
      },
    },
    include: {
      owner: {
        select: { id: true, username: true, fullName: true, avatar: true },
      },
      collaborators: {
        include: {
          user: {
            select: { id: true, username: true, fullName: true, avatar: true },
          },
        },
      },
      _count: {
        select: { saves: true, collaborators: true },
      },
    },
  });

  return board;
}

/**
 * Invites / adds a collaborator to a board by their @username handle.
 */
export async function addCollaborator(data: AddCollaboratorDTO) {
  const { boardId, role = "editor" } = data;
  const cleanUsername = data.username.replace(/^@/, "").trim().toLowerCase();

  if (!cleanUsername) {
    const error: any = new Error("A valid username is required.");
    error.status = 400;
    throw error;
  }

  // 1. Verify target board exists
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      collaborators: true,
      owner: true,
    },
  });

  if (!board) {
    const error: any = new Error(`Board with ID "${boardId}" not found.`);
    error.status = 404;
    throw error;
  }

  // 2. Lookup invitee user by username
  const targetUser = await prisma.user.findFirst({
    where: {
      username: {
        equals: cleanUsername,
      },
    },
  });

  if (!targetUser) {
    const error: any = new Error(`User "@${cleanUsername}" not found.`);
    error.status = 404;
    throw error;
  }

  // 3. Guard against adding the board owner again
  if (board.ownerId === targetUser.id) {
    const error: any = new Error(`User "@${cleanUsername}" is already the owner of this board.`);
    error.status = 400;
    throw error;
  }

  // 4. Check if user is already a collaborator
  const existingCollab = board.collaborators.find((c) => c.userId === targetUser.id);
  if (existingCollab) {
    // Update role if changed
    const updated = await prisma.boardCollaborator.update({
      where: {
        boardId_userId: {
          boardId,
          userId: targetUser.id,
        },
      },
      data: { role },
      include: {
        user: { select: { id: true, username: true, fullName: true, avatar: true } },
      },
    });

    return {
      message: `User "@${cleanUsername}" is already a collaborator. Updated role to "${role}".`,
      collaborator: updated,
    };
  }

  // 5. Create new collaborator association
  const collaborator = await prisma.boardCollaborator.create({
    data: {
      boardId,
      userId: targetUser.id,
      role,
    },
    include: {
      user: {
        select: { id: true, username: true, fullName: true, avatar: true },
      },
    },
  });

  return {
    message: `User "@${cleanUsername}" added as a collaborator successfully.`,
    collaborator,
  };
}

/**
 * Returns all boards where the user is an owner or collaborator, with saves preview thumbnails.
 */
export async function getUserBoards(userId: string) {
  return prisma.board.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { collaborators: { some: { userId } } },
      ],
    },
    include: {
      owner: {
        select: { id: true, username: true, fullName: true, avatar: true },
      },
      collaborators: {
        include: {
          user: {
            select: { id: true, username: true, fullName: true, avatar: true },
          },
        },
      },
      saves: {
        take: 4,
        orderBy: { createdAt: "desc" },
        include: {
          post: {
            select: { id: true, title: true, images: true },
          },
        },
      },
      _count: {
        select: { saves: true, collaborators: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Returns a single board with full saved posts and collaborator details.
 */
export async function getBoardById(boardId: string) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      owner: {
        select: { id: true, username: true, fullName: true, avatar: true },
      },
      collaborators: {
        include: {
          user: {
            select: { id: true, username: true, fullName: true, avatar: true },
          },
        },
      },
      saves: {
        orderBy: { createdAt: "desc" },
        include: {
          post: {
            include: {
              author: { select: { id: true, username: true, avatar: true } },
              _count: { select: { saves: true, likes: true, comments: true } },
            },
          },
        },
      },
      _count: {
        select: { saves: true, collaborators: true },
      },
    },
  });

  if (!board) {
    const error: any = new Error(`Board with ID "${boardId}" not found.`);
    error.status = 404;
    throw error;
  }

  return board;
}

