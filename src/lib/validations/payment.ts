// =============================================================================
// DIU_CYBERCON 2026 — Payment Validation Schemas (Zod)
// Shared payment input validation. Sensitive payment data must not be returned
// in public API responses.
// =============================================================================

import { z } from "zod"

export const paymentMethodSchema = z.enum(["BKASH"])

export const paymentStatusSchema = z.enum(["PENDING", "VERIFIED", "REJECTED"])
export const paymentIdSchema = z.string().cuid()

export const paymentSubmissionSchema = z.object({
  registrationId: z
    .string()
    .trim()
    .regex(/^CYB26-(?:C|IS|TR|P|PJ|PN|W)-\d{3,}-[A-HJ-NP-Z2-9]{6}$/i, "Enter a valid registration ID"),
  finalizationToken: z.string().trim().min(32).max(2048).optional(),
  transactionId: z
    .string()
    .trim()
    .min(1, "Transaction ID is required")
    .max(100)
    .regex(/^[A-Za-z0-9]+$/, "Transaction ID must be alphanumeric"),
})

export const paymentDecisionSchema = z
  .object({
    status: z.enum(["VERIFIED", "REJECTED"]),
    reason: z.string().trim().min(5).max(500).optional(),
  })
  .refine((data) => data.status !== "REJECTED" || Boolean(data.reason), {
    message: "A reason is required when rejecting a payment.",
    path: ["reason"],
  })

export type PaymentSubmissionInput = z.infer<typeof paymentSubmissionSchema>
export type PaymentDecisionInput = z.infer<typeof paymentDecisionSchema>
