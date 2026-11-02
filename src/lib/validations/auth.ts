// =============================================================================
// DIU_CYBERCON 2026 — Auth Validation Schemas (Zod)
// Shared between client (form validation) and server (API validation).
// Server ALWAYS validates independently of the client.
// =============================================================================

import { z } from "zod"

// ─── Reusable field schemas ───────────────────────────────────────────────────

const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Enter a valid email address")
  .max(254, "Email is too long")
  .transform((v) => v.toLowerCase().trim())

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must contain at least one special character",
  )

const nameSchema = z
  .string()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name is too long")
  .regex(/^[a-zA-Z\s\-.]+$/, "Name can only contain letters, spaces, hyphens, and dots")
  .transform((v) => v.trim().replace(/\s+/g, " "))

const tokenSchema = z
  .string()
  .min(32, "Invalid token")
  .max(512, "Invalid token")

// ─── Sign Up ──────────────────────────────────────────────────────────────────

export const signUpSchema = z
  .object({
    name:            nameSchema,
    email:           emailSchema,
    password:        passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export type SignUpInput = z.infer<typeof signUpSchema>

// Server-side variant (no confirmPassword)
export const signUpServerSchema = z.object({
  name:     nameSchema,
  email:    emailSchema,
  password: passwordSchema,
})

export type SignUpServerInput = z.infer<typeof signUpServerSchema>

// ─── Sign In ──────────────────────────────────────────────────────────────────

export const signInSchema = z.object({
  email:    emailSchema,
  password: z.string().min(1, "Password is required").max(128, "Password is too long"),
})

export type SignInInput = z.infer<typeof signInSchema>

// ─── Forgot Password ──────────────────────────────────────────────────────────

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

// ─── Reset Password ───────────────────────────────────────────────────────────

export const resetPasswordSchema = z
  .object({
    token:           tokenSchema,
    password:        passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

// Server-side variant
export const resetPasswordServerSchema = z.object({
  token:    tokenSchema,
  password: passwordSchema,
})

export type ResetPasswordServerInput = z.infer<typeof resetPasswordServerSchema>

// ─── Verify Email ─────────────────────────────────────────────────────────────

export const verifyEmailSchema = z.object({
  token: tokenSchema,
})

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>

// ─── Change Password (authenticated) ─────────────────────────────────────────

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword:     passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from your current password",
    path: ["newPassword"],
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

// ─── Password strength checker ────────────────────────────────────────────────

export type PasswordStrength = "weak" | "fair" | "good" | "strong"

export function getPasswordStrength(password: string): {
  strength: PasswordStrength
  score: number
  feedback: string[]
} {
  const feedback: string[] = []
  let score = 0

  if (password.length >= 8)  {score++}
  else {feedback.push("At least 8 characters")}

  if (password.length >= 12) {score++}
  else if (password.length < 12) {feedback.push("12+ characters recommended")}

  if (/[A-Z]/.test(password)) {score++}
  else {feedback.push("Add uppercase letters")}

  if (/[a-z]/.test(password)) {score++}
  else {feedback.push("Add lowercase letters")}

  if (/[0-9]/.test(password)) {score++}
  else {feedback.push("Add numbers")}

  if (/[^A-Za-z0-9]/.test(password)) {score++}
  else {feedback.push("Add special characters (!@#$...)")}

  // Penalize common patterns
  if (/(.)\1{2,}/.test(password)) { score--; feedback.push("Avoid repeated characters") }
  if (/^(password|123456|qwerty)/i.test(password)) { score = 0; feedback.push("Avoid common passwords") }

  const clampedScore = Math.max(0, Math.min(6, score))
  const strength: PasswordStrength =
    clampedScore <= 1 ? "weak"
    : clampedScore <= 3 ? "fair"
    : clampedScore <= 5 ? "good"
    : "strong"

  return { strength, score: clampedScore, feedback }
}
