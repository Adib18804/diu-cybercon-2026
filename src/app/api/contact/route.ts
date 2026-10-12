// =============================================================================
// POST /api/contact
// Contact form submission with rate limiting and honeypot field.
// =============================================================================

import type { NextRequest} from "next/server";
import { NextResponse } from "next/server"
import { z } from "zod"

import { extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit"
import { successResponse, errorResponse } from "@/lib/utils"

const contactSchema = z.object({
  name:     z.string().min(2, "Name is required").max(100).trim(),
  email:    z.string().email("Enter a valid email").max(254).toLowerCase().trim(),
  subject:  z.string().min(3, "Subject is required").max(200).trim(),
  message:  z.string().min(10, "Message must be at least 10 characters").max(3000).trim(),
  // Honeypot field — bots fill this, humans don't
  website:  z.string().max(0, "Bot detected").optional(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = extractIpAddress(request)

  const rateResult = await checkRateLimit("contactForm", ip)
  if (!rateResult.success) {
    return rateLimitExceededResponse(rateResult.retryAfter)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(errorResponse("Invalid request body.", "VALIDATION"), { status: 400 })
  }

  const parsed = contactSchema.safeParse(body)
  if (!parsed.success) {
    // Honeypot triggered
    const isHoneypot = parsed.error.issues.some((i) => i.path[0] === "website")
    if (isHoneypot) {
      // Silently succeed — don't tell bots they were detected
      return NextResponse.json(successResponse(null, "Message sent successfully."))
    }

    const details = parsed.error.flatten().fieldErrors as Record<string, string[]>
    return NextResponse.json(
      errorResponse("Please check your input.", "VALIDATION", details),
      { status: 422 },
    )
  }

  // Honeypot filled — silent success
  if (parsed.data.website) {
    return NextResponse.json(successResponse(null, "Message sent successfully."))
  }

  try {
    await prisma.contactMessage.create({
      data: {
        name:      parsed.data.name,
        email:     parsed.data.email,
        subject:   parsed.data.subject,
        message:   parsed.data.message,
        ipAddress: ip,
        userAgent: extractUserAgent(request),
      },
    })

    return NextResponse.json(
      successResponse(null, "Message sent successfully. We will get back to you soon."),
      { status: 201 },
    )
  } catch (err) {
    console.error("[POST /api/contact]", err)
    return NextResponse.json(
      errorResponse("Failed to send message. Please try again.", "INTERNAL"),
      { status: 500 },
    )
  }
}
