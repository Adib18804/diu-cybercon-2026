import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { successResponse } from "@/lib/utils"

export const dynamic = "force-dynamic"

export async function GET(): Promise<NextResponse> {
  const { error } = await requirePermission("events:view")
  if (error) {return error}

  const events = await prisma.event.findMany({
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      registrationOpen: true,
      registrationDeadline: true,
      registrationFee: true,
      venue: true,
    },
  })

  return NextResponse.json(successResponse(events.map((event) => ({
    ...event,
    registrationFee: event.registrationFee.toString(),
  }))))
}
