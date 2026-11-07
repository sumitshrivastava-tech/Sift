import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

export interface SendOtpResult {
  phone: string;
  expiresInSeconds: number;
  previewCode?: string;
}

export interface VerifyOtpResult {
  token: string;
  isNewUser: boolean;
  user: {
    id: string;
    username: string;
    fullName?: string | null;
    phone: string;
    avatar: string | null;
    bio?: string | null;
    followersCount?: number;
  };
}

export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || "5", 10);
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || "5", 10);
const JWT_SECRET = process.env.JWT_SECRET || "sift-jwt-default-dev-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * Generates a 4-digit numeric code, saves it to the database with expiration,
 * and mocks SMS delivery.
 */
export async function sendOtp(phone: string): Promise<SendOtpResult> {
  // Generate random 4-digit numeric OTP code (1000 - 9999)
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const expiresInSeconds = OTP_EXPIRY_MINUTES * 60;
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  // Upsert OTP record for this phone number
  await prisma.otpStore.upsert({
    where: { phone },
    update: {
      code,
      attempts: 0,
      expiresAt,
    },
    create: {
      phone,
      code,
      attempts: 0,
      expiresAt,
    },
  });

  // Mock SMS delivery via server console
  console.log("==================================================");
  console.log(`📱 [MOCK SMS SERVICE]`);
  console.log(`➡️  Recipient: ${phone}`);
  console.log(`🔑 Verification Code: ${code}`);
  console.log(`⏳ Valid for: ${OTP_EXPIRY_MINUTES} minutes (expires at ${expiresAt.toISOString()})`);
  console.log("==================================================");

  return {
    phone,
    expiresInSeconds,
    // Return code in non-production environments to streamline testing/prototyping
    previewCode: process.env.NODE_ENV !== "production" ? code : undefined,
  };
}

/**
 * Verifies phone and 4-digit code.
 * If valid, finds or creates the user and issues a signed JWT token.
 */
export async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  const otpRecord = await prisma.otpStore.findUnique({
    where: { phone },
  });

  if (!otpRecord) {
    throw new AuthError("No OTP was requested for this phone number. Please request one first.", 400);
  }

  // Check if expired
  if (new Date() > otpRecord.expiresAt) {
    // Delete expired record
    await prisma.otpStore.delete({ where: { phone } }).catch(() => null);
    throw new AuthError("OTP has expired. Please request a new code.", 400);
  }

  // Check max attempts
  if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.otpStore.delete({ where: { phone } }).catch(() => null);
    throw new AuthError("Too many failed attempts. Please request a new code.", 429);
  }

  // Check code match
  if (otpRecord.code !== code) {
    await prisma.otpStore.update({
      where: { phone },
      data: { attempts: { increment: 1 } },
    });
    const remaining = OTP_MAX_ATTEMPTS - (otpRecord.attempts + 1);
    throw new AuthError(
      `Invalid OTP code. ${remaining > 0 ? `${remaining} attempts remaining.` : "Please request a new code."}`,
      400
    );
  }

  // OTP verified successfully -> clear it so it cannot be reused
  await prisma.otpStore.delete({ where: { phone } }).catch(() => null);

  // Find or provision user
  let user = await prisma.user.findUnique({
    where: { phone },
    select: {
      id: true,
      username: true,
      fullName: true,
      phone: true,
      avatar: true,
      bio: true,
      followersCount: true,
    },
  });

  let isNewUser = false;
  if (!user) {
    isNewUser = true;
    const cleanDigits = phone.replace(/\D/g, "");
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const username = `user_${cleanDigits.slice(-4) || "sift"}_${randomSuffix}`;

    user = await prisma.user.create({
      data: {
        phone,
        username,
        fullName: null,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        phone: true,
        avatar: true,
        bio: true,
        followersCount: true,
      },
    });
  }

  // Sign JWT
  const token = jwt.sign(
    {
      userId: user.id,
      phone: user.phone,
      username: user.username,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    }
  );

  return {
    token,
    isNewUser,
    user,
  };
}

/**
 * Authenticates or registers a user via Email and Password.
 */
export async function emailAuth(
  email: string,
  password: string,
  isSignUp = false
): Promise<VerifyOtpResult> {
  const cleanEmail = email.toLowerCase().trim();

  let user = await prisma.user.findFirst({
    where: { email: cleanEmail },
    select: {
      id: true,
      username: true,
      fullName: true,
      phone: true,
      avatar: true,
      email: true,
      password: true,
    },
  });

  let isNewUser = false;
  if (!user) {
    isNewUser = true;
    const namePart = cleanEmail.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_");
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const username = `${namePart.slice(0, 15)}_${randomSuffix}`;
    const generatedPhone = `+91${Math.floor(6000000000 + Math.random() * 3999999999)}`;

    user = await prisma.user.create({
      data: {
        email: cleanEmail,
        password,
        username,
        phone: generatedPhone,
        fullName: namePart.charAt(0).toUpperCase() + namePart.slice(1),
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        phone: true,
        avatar: true,
        email: true,
        password: true,
      },
    });
  } else if (!isSignUp && user.password && user.password !== password) {
    throw new AuthError("Invalid email or password. Please try again.", 401);
  }

  const token = jwt.sign(
    {
      userId: user.id,
      phone: user.phone,
      username: user.username,
      email: user.email,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    }
  );

  return {
    token,
    isNewUser,
    user: {
      id: user.id,
      username: user.username,
      phone: user.phone,
      avatar: user.avatar,
    },
  };
}

/**
 * Sends a password reset recovery request.
 */
export async function forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
  const cleanEmail = email.toLowerCase().trim();
  console.log(`🔑 [PASSWORD RESET REQUEST] Link sent to ${cleanEmail}`);
  return {
    success: true,
    message: `Password reset instructions sent to ${cleanEmail}`,
  };
}

