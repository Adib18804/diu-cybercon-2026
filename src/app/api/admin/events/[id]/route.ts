import { Prisma } from "@prisma/client"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, successResponse } from "@/lib/utils"
import { eventSettingsUpdateSchema } from "@/lib/validations/admin"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

function serializeEvent(event: {
  id: string
  name: string
  type: string
  status: string
  registrationOpen: boolean
  startDate: Date | null
  endDate: Date | null
  registrationDeadline: Date | null
  registrationFee: Prisma.Decimal
  venue: string | null
}) {
  return {
    ...event,
    startDate: event.startDate?.toISOString() ?? null,
    endDate: event.endDate?.toISOString() ?? null,
    registrationDeadline: event.registrationDeadline?.toISOString() ?? null,
    registrationFee: event.registrationFee.toString(),
  }
}

function currentRule(type: string, fee: Prisma.Decimal, venue: string | null): string | null {
  const place = venue ?? "To be announced"
  const amount = fee.toString()
  switch (type) {
    case "CTF":
      return `CTF Final: ${amount} BDT per team (4 members). Venue: ${place}. Preliminary is free.`
    case "INNOVATION_SYMPOSIUM":
      return `Innovation Symposium: ${amount} BDT per person (Max 3 members). Venue: ${place}.`
    case "PANEL_DISCUSSION":
      return `Panel Discussion: Free entry. Venue: ${place}.`
    case "HANDS_ON":
      return `Workshop: ${amount} BDT per person. Venue: ${place === "International Conference Hall (ICH)" ? "ICH" : place}.`
    default:
      return null
  }
}

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { error } = await requirePermission("events:view")
  if (error) {return error}

  const { id } = await params
  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      registrationOpen: true,
      startDate: true,
      endDate: true,
      registrationDeadline: true,
      registrationFee: true,
      venue: true,
    },
  })
  if (!event) {
    return NextResponse.json(errorResponse("Event not found.", "NOT_FOUND"), { status: 404 })
  }
  return NextResponse.json(successResponse(serializeEvent(event)))
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { session, error } = await requirePermission("events:edit")
  if (error) {return error}
  if (session.user.adminRole !== "SUPER_ADMIN") {
    return NextResponse.json(errorResponse("Only a Super Admin can update event settings.", "FORBIDDEN"), { status: 403 })
  }

  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(errorResponse("Invalid JSON body.", "INVALID_JSON"), { status: 400 })
  }

  const parsed = eventSettingsUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      errorResponse("Please fix the highlighted fields and try again.", "VALIDATION", parsed.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 422 },
    )
  }

  const existing = await prisma.event.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json(errorResponse("Event not found.", "NOT_FOUND"), { status: 404 })
  }

  const data = parsed.data
  const nextStart = data.startDate === undefined ? existing.startDate : data.startDate
  const nextEnd = data.endDate === undefined ? existing.endDate : data.endDate
  if (nextStart && nextEnd && nextStart > nextEnd) {
    return NextResponse.json(errorResponse("Start date must be before the end date.", "VALIDATION", { startDate: ["Start date must be before the end date."] }), { status: 422 })
  }

  const updateData: Prisma.EventUpdateInput = {}
  if (data.startDate !== undefined) {updateData.startDate = data.startDate}
  if (data.endDate !== undefined) {updateData.endDate = data.endDate}
  if (data.registrationDeadline !== undefined) {updateData.registrationDeadline = data.registrationDeadline}
  if (data.registrationFee !== undefined) {updateData.registrationFee = new Prisma.Decimal(data.registrationFee)}
  if (data.venue !== undefined) {updateData.venue = data.venue}
  if (data.registrationOpen !== undefined) {updateData.registrationOpen = data.registrationOpen}

  if (data.registrationFee !== undefined || data.venue !== undefined) {
    const nextFee = data.registrationFee === undefined
      ? existing.registrationFee
      : new Prisma.Decimal(data.registrationFee)
    const nextVenue = data.venue === undefined ? existing.venue : data.venue
    const rule = currentRule(existing.type, nextFee, nextVenue)
    if (rule) {updateData.rules = rule}
  }

  const updated = await prisma.event.update({ where: { id }, data: updateData })
  const before = {
    startDate: existing.startDate?.toISOString() ?? null,
    endDate: existing.endDate?.toISOString() ?? null,
    registrationDeadline: existing.registrationDeadline?.toISOString() ?? null,
    registrationFee: existing.registrationFee.toString(),
    venue: existing.venue,
    registrationOpen: existing.registrationOpen,
  }
  const after = {
    startDate: updated.startDate?.toISOString() ?? null,
    endDate: updated.endDate?.toISOString() ?? null,
    registrationDeadline: updated.registrationDeadline?.toISOString() ?? null,
    registrationFee: updated.registrationFee.toString(),
    venue: updated.venue,
    registrationOpen: updated.registrationOpen,
  }
  const changedBefore: Record<string, unknown> = {}
  const changedAfter: Record<string, unknown> = {}
  for (const key of Object.keys(after) as Array<keyof typeof after>) {
    if (before[key] !== after[key]) {
      changedBefore[key] = before[key]
      changedAfter[key] = after[key]
    }
  }

  await auditLog({
    actorId: session.user.id,
    action: "EVENT_UPDATED",
    targetType: "Event",
    targetId: updated.id,
    before: changedBefore,
    after: changedAfter,
    ipAddress: extractIpAddress(request),
    userAgent: extractUserAgent(request),
  })

  return NextResponse.json(successResponse(serializeEvent(updated), "Event settings updated."))
}
