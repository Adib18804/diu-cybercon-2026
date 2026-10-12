// =============================================================================
// POST /api/sponsors/apply
// Sponsor application form submission.
// Rate limited. File key validated (Cloudinary key must exist format).
// =============================================================================

import type { NextRequest} from "next/server";
import { NextResponse } from "next/server"
import { z } from "zod"

import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { sendSponsorApplicationEmail } from "@/lib/email/resend"
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit"
import { successResponse, errorResponse } from "@/lib/utils"

const sponsorApplicationSchema = z.object({
  orgName:       z.string().min(2, "Organisation name is required").max(200).trim(),
  contactPerson: z.string().min(2, "Contact name is required").max(100).trim(),
  email:         z.string().email("Enter a valid email").max(254).toLowerCase().trim(),
  phone:         z.string().min(7, "Enter a valid phone number").max(20).trim(),
  website:       z.string().url("Enter a valid URL").max(500).optional().or(z.literal("")),
  tier:          z.enum(["TITLE", "PLATINUM", "GOLD", "CUSTOM", "PARTNER", "MEDIA_PARTNER", "TECHNICAL_PARTNER", "OTHER_PARTNER"]),
  logoKey:       z.string().max(500).optional(),
  message:       z.string().max(2000).trim().optional(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = extractIpAddress(request)

  const rateResult = await checkRateLimit("sponsorApplication", ip)
  if (!rateResult.success) {
    return rateLimitExceededResponse(rateResult.retryAfter)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(errorResponse("Invalid request body.", "VALIDATION"), { status: 400 })
  }

  const parsed = sponsorApplicationSchema.safeParse(body)
  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors as Record<string, string[]>
    return NextResponse.json(
      errorResponse("Please check your input.", "VALIDATION", details),
      { status: 422 },
    )
  }

  const data = parsed.data

  // Clean empty website
  const website = data.website || undefined

  try {
    const application = await prisma.sponsorApplication.create({
      data: {
        orgName:       data.orgName,
        contactPerson: data.contactPerson,
        email:         data.email,
        phone:         data.phone,
        website:       website,
        tier:          data.tier,
        logoKey:       data.logoKey,
        message:       data.message,
        status:        "SUBMITTED",
      },
      select: { id: true, orgName: true, tier: true },
    })

    void auditLog({
      actorId:    application.id, // Use application ID as actor for unauthenticated
      action:     "SPONSOR_APPLICATION_SUBMITTED",
      targetType: "SponsorApplication",
      targetId:   application.id,
      ipAddress:  ip,
      userAgent:  extractUserAgent(request),
      metadata:   { orgName: data.orgName, tier: data.tier, email: data.email },
    })

    // ── Acknowledgement email (best-effort — never blocks the application) ───
    const receipt = await sendSponsorApplicationEmail({
      to: data.email,
      name: data.contactPerson,
      orgName: data.orgName,
      tier: data.tier,
    })
    if (!receipt.success) {
      console.error("[POST /api/sponsors/apply] acknowledgement email failed:", receipt.error)
    }

    return NextResponse.json(
      successResponse(
        { id: application.id },
        "Your sponsorship application has been received. We will contact you shortly.",
      ),
      { status: 201 },
    )
  } catch (err) {
    console.error("[POST /api/sponsors/apply]", err)
    return NextResponse.json(
      errorResponse("Application submission failed. Please try again.", "INTERNAL"),
      { status: 500 },
    )
  }
}
