import { Router } from "express";
import { sendOtp, verifyOtp, emailLogin, forgotPassword } from "../controllers/auth.controller";
import { validate } from "../middleware/validate";
import { sendOtpSchema, verifyOtpSchema, emailAuthSchema, forgotPasswordSchema } from "../validators/schemas";

const router = Router();

/**
 * @route   POST /api/auth/send-otp
 * @desc    Generate and send a 4-digit OTP via mock SMS
 * @access  Public
 */
router.post("/send-otp", validate(sendOtpSchema), sendOtp);

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify 4-digit OTP code and retrieve JWT
 * @access  Public
 */
router.post("/verify-otp", validate(verifyOtpSchema), verifyOtp);

/**
 * @route   POST /api/auth/email-login
 * @desc    Authenticate or register via Email & Password
 * @access  Public
 */
router.post("/email-login", validate(emailAuthSchema), emailLogin);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset instructions
 * @access  Public
 */
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);

export default router;

