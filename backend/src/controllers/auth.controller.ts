import { Request, Response, NextFunction } from "express";
import * as authService from "../services/auth.service";
import { SendOtpInput, VerifyOtpInput, EmailAuthInput, ForgotPasswordInput } from "../validators/schemas";

/**
 * POST /api/auth/send-otp
 * Generates a 4-digit OTP code, stores it with expiry, and mocks SMS delivery.
 */
export async function sendOtp(
  req: Request<{}, {}, SendOtpInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { phone } = req.body;
    const result = await authService.sendOtp(phone);

    res.status(200).json({
      success: true,
      message: "Verification code sent successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/verify-otp
 * Verifies the 4-digit code and issues a JWT token.
 */
export async function verifyOtp(
  req: Request<{}, {}, VerifyOtpInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { phone, code } = req.body;
    const result = await authService.verifyOtp(phone, code);

    res.status(200).json({
      success: true,
      message: "Verification successful",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/email-login
 * Signs in or creates a user with email and password.
 */
export async function emailLogin(
  req: Request<{}, {}, EmailAuthInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password, isSignUp } = req.body;
    const result = await authService.emailAuth(email, password, isSignUp);

    res.status(200).json({
      success: true,
      message: isSignUp ? "Account created successfully" : "Signed in successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/forgot-password
 * Triggers password recovery email.
 */
export async function forgotPassword(
  req: Request<{}, {}, ForgotPasswordInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

