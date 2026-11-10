import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth";
import { prisma } from "../lib/prisma";

export const MINIMUM_TRUST_SCORE = 50.0;

export interface TrustEvaluation {
  score: number;
  passed: boolean;
  phoneVerified: boolean;
  reasons: string[];
}

/**
 * Evaluates the dynamic trust score of a user.
 * Base score starts at the user's persisted trustScore (default 80.0).
 * Penalties apply for restrictions, missing verified credentials, and prior flagged content.
 * Bonuses apply for account tenure, profile completeness, and positive community engagement.
 */
export async function evaluateUserTrust(userId: string): Promise<TrustEvaluation> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          posts: true,
          saves: true,
          comments: true,
        },
      },
    },
  });

  if (!user) {
    // If user account is not yet created in DB, grant default verified guest/creator trust
    return {
      score: 80.0,
      passed: true,
      phoneVerified: true,
      reasons: ["Default verified author trust"],
    };
  }

  const reasons: string[] = [];

  // Immediate block if explicitly restricted by admin/system
  if (user.isRestricted) {
    return {
      score: 0,
      passed: false,
      phoneVerified: user.phoneVerified,
      reasons: ["Account is currently restricted due to policy violations"],
    };
  }

  let calculatedScore = user.trustScore ?? 80.0;

  // 1. Phone Verification Check (Mandatory requirement)
  const isPhoneVerified = Boolean(user.phoneVerified && user.phone && user.phone.length >= 10);
  if (!isPhoneVerified) {
    calculatedScore -= 40;
    reasons.push("Phone number is unverified");
  } else {
    calculatedScore += 5;
  }

  // 2. Account Age Bonus
  const accountAgeMs = Date.now() - new Date(user.createdAt).getTime();
  const accountAgeHours = accountAgeMs / (1000 * 60 * 60);

  if (accountAgeHours >= 24) {
    calculatedScore += 5;
  }
  if (accountAgeHours >= 168) {
    // 7 days+
    calculatedScore += 5;
  }

  // 3. Profile Completeness Bonus
  if (user.avatar) calculatedScore += 5;
  if (user.fullName) calculatedScore += 5;
  if (user.bio) calculatedScore += 5;

  // 4. Past Flagged Content Penalty
  const flaggedPostsCount = await prisma.post.count({
    where: { authorId: userId, isFlagged: true },
  });
  const flaggedCommentsCount = await prisma.comment.count({
    where: { authorId: userId, isFlagged: true },
  });
  const totalFlagged = flaggedPostsCount + flaggedCommentsCount;

  if (totalFlagged > 0) {
    const penalty = totalFlagged * 20;
    calculatedScore -= penalty;
    reasons.push(`${totalFlagged} previously flagged item(s) detected (-${penalty} pts)`);
  }

  // Clamp score between 0 and 100
  const finalScore = Math.max(0, Math.min(100, Math.round(calculatedScore * 10) / 10));
  const passed = isPhoneVerified && finalScore >= MINIMUM_TRUST_SCORE;

  return {
    score: finalScore,
    passed,
    phoneVerified: isPhoneVerified,
    reasons,
  };
}

/**
 * Middleware: restrictUntrustedUser
 * Restricts users from publishing posts if their account lacks a verified phone number
 * or fails the minimum required community trust score (50.0).
 */
export async function restrictUntrustedUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authorId = req.user?.userId || (req.body as any)?.authorId;

    if (!authorId) {
      res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Authentication required to publish posts",
      });
      return;
    }

    const evaluation = await evaluateUserTrust(authorId);

    // Check 1: Phone verification
    if (!evaluation.phoneVerified) {
      res.status(403).json({
        success: false,
        code: "PHONE_NOT_VERIFIED",
        message:
          "Account security restriction: A verified mobile phone number is required to publish content on Sift.",
        details: evaluation.reasons,
      });
      return;
    }

    // Check 2: Minimum Trust Score
    if (!evaluation.passed) {
      res.status(403).json({
        success: false,
        code: "INSUFFICIENT_TRUST_SCORE",
        message: `Account trust threshold not met. Your trust score (${evaluation.score}) is below the minimum required (${MINIMUM_TRUST_SCORE}) to create posts.`,
        trustScore: evaluation.score,
        minimumRequired: MINIMUM_TRUST_SCORE,
        reasons: evaluation.reasons,
      });
      return;
    }

    // Attach trust metadata to request
    (req as any).userTrust = evaluation;
    next();
  } catch (error) {
    next(error);
  }
}

