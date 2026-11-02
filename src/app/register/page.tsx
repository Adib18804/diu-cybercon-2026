// =============================================================================
// Register — /register
// Public entry point to the registration wizard. Event availability is computed
// server-side (status, deadline, capacity, team limits, "already registered")
// and merely mirrored by the client — the registration APIs remain the single
// source of truth and re-enforce every rule.
// =============================================================================

import type { Metadata } from "next"

import { PageHeader } from "@/components/layout"
import {
  RegisterAuthGate,
  RegistrationWizard,
  type UniversityOption,
  type Viewer,
  type WizardEvent,
  type WizardWorkshop,
} from "@/components/register"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/rbac"
import { resolveTeamLimits } from "@/lib/registrations/service"
import { formatDate, isDeadlinePassed } from "@/lib/utils"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Register",
  description:
    "Register for DIU_CYBERCON 2026 — CTF, Innovation Symposium, Panel Discussion, and Hands-on Activities.",
}

// ─── Data (defensive — a cold DB shows an empty state, never a crash) ────────

async function safe<T>(query: Promise<T>, fallback: T): Promise<T> {
  try {
    return await query
  } catch {
    return fallback
  }
}

interface ViewerRow {
  id: string
  name: string | null
  email: string
}

interface RegisterData {
  events: WizardEvent[]
  workshops: WizardWorkshop[]
  universities: UniversityOption[]
  viewer: Viewer | null
  bkashNumber: string
}

async function getRegisterData(user: ViewerRow | null): Promise<RegisterData> {
  const userId = user?.id ?? null

  const myEventRegsQuery: Promise<{ eventId: string }[]> = userId
    ? safe(
        prisma.eventRegistration.findMany({
          where: { userId, status: { not: "CANCELLED" } },
          select: { eventId: true },
        }),
        [],
      )
    : Promise.resolve([])

  const myWorkshopRegsQuery: Promise<{ workshopId: string }[]> = userId
    ? safe(
        prisma.workshopRegistration.findMany({
          where: { userId },
          select: { workshopId: true },
        }),
        [],
      )
    : Promise.resolve([])

  const profileQuery: Promise<{
    fullName: string
    studentId: string
    department: string
    phone: string
    tshirtSize: string
    universityId: string
  } | null> = userId
    ? safe(
        prisma.participantProfile.findUnique({
          where: { userId },
          select: {
            fullName: true,
            studentId: true,
            department: true,
            phone: true,
            tshirtSize: true,
            universityId: true,
          },
        }),
        null,
      )
    : Promise.resolve(null)

  const [
    events,
    bkashSetting,
    handsOnSettings,
    activeCounts,
    myEventRegs,
    workshops,
    myWorkshopRegs,
    universities,
    profile,
  ] = await Promise.all([
    safe(
      prisma.event.findMany({
        where: {
          type: { not: "HANDS_ON" },
          status: { in: ["OPEN", "CLOSED", "COMPLETED"] },
        },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          type: true,
          name: true,
          slug: true,
          shortDescription: true,
          venue: true,
          prizes: true,
          isTeamEvent: true,
          minTeamSize: true,
          maxTeamSize: true,
          participantLimit: true,
          registrationFee: true,
          registrationDeadline: true,
          status: true,
          registrationOpen: true,
          rules: true,
        },
      }),
      [],
    ),
    safe(
      prisma.siteSetting.findUnique({
        where: { key: "payment.bkashNumber" },
        select: { value: true },
      }),
      null,
    ),
    safe(
      prisma.event.findUnique({
        where: { type: "HANDS_ON" },
        select: { registrationFee: true, venue: true },
      }),
      null,
    ),
    safe(
      prisma.eventRegistration.groupBy({
        by: ["eventId"],
        where: { status: { in: ["PENDING", "PRELIM_APPROVED", "PAYMENT_PENDING", "PENDING_PAYMENT", "CONFIRMED", "WAITLISTED"] } },
        _count: { _all: true },
      }),
      [],
    ),
    myEventRegsQuery,
    safe(
      prisma.workshop.findMany({
        where: { status: "OPEN" },
        orderBy: [{ displayOrder: "asc" }, { date: "asc" }],
        select: {
          id: true,
          title: true,
          skillLevel: true,
          date: true,
          startTime: true,
          endTime: true,
          venue: true,
          totalSeats: true,
          registeredCount: true,
          registrationDeadline: true,
        },
      }),
      [],
    ),
    myWorkshopRegsQuery,
    safe(
      prisma.university.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, shortName: true },
      }),
      [],
    ),
    profileQuery,
  ])

  // ── Map to the serializable wizard boundary ─────────────────────────────────

  const countByEvent = new Map(
    activeCounts.map((row) => [row.eventId, row._count._all]),
  )
  const myEvents = new Set(myEventRegs.map((row) => row.eventId))
  const myWorkshops = new Set(myWorkshopRegs.map((row) => row.workshopId))

  const wizardEvents: WizardEvent[] = events.map((event) => {
    const deadline = event.registrationDeadline
    const limits = resolveTeamLimits(event)
    return {
      id: event.id,
      type: event.type,
      name: event.name,
      slug: event.slug,
      shortDescription: event.shortDescription,
      venue: event.venue,
      prizes: event.prizes,
      isTeamEvent: event.isTeamEvent,
      minTeamSize: limits.min,
      maxTeamSize: limits.max,
      participantLimit: event.participantLimit,
      registrationFee: event.registrationFee.toString(),
      registeredCount: countByEvent.get(event.id) ?? 0,
      registrationDeadline: deadline ? deadline.toISOString() : null,
      deadlineLabel: deadline ? formatDate(deadline) : null,
      isOpen:
        event.status === "OPEN" &&
        event.registrationOpen &&
        (!deadline || !isDeadlinePassed(deadline)),
      alreadyRegistered: myEvents.has(event.id),
      rules: event.rules,
    }
  })

  const wizardWorkshops: WizardWorkshop[] = workshops
    .filter(
      (workshop) =>
        !isDeadlinePassed(workshop.registrationDeadline) ||
        myWorkshops.has(workshop.id),
    )
    .map((workshop) => ({
      id: workshop.id,
      title: workshop.title,
      skillLevel: workshop.skillLevel,
      dateLabel: formatDate(workshop.date),
      startTime: workshop.startTime,
      endTime: workshop.endTime,
      venue: handsOnSettings?.venue ?? workshop.venue,
      registrationFee: handsOnSettings?.registrationFee.toString() ?? "300",
      seatsLeft: Math.max(0, workshop.totalSeats - workshop.registeredCount),
      alreadyRegistered: myWorkshops.has(workshop.id),
    }))

  const viewer: Viewer | null = user
    ? {
        name: user.name,
        email: user.email,
        profile: profile
          ? {
              fullName: profile.fullName,
              studentId: profile.studentId,
              department: profile.department,
              phone: profile.phone,
              tshirtSize: profile.tshirtSize,
              universityId: profile.universityId,
            }
          : null,
      }
    : null

  return {
    events: wizardEvents,
    workshops: wizardWorkshops,
    universities,
    viewer,
    bkashNumber: bkashSetting?.value.trim() ?? "",
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RegisterPage() {
  const user = await getSessionUser()
  const data = await getRegisterData(user)

  return (
    <>
      <PageHeader
        label="Registration"
        title="Register for DIU_CYBERCON 2026"
        description="Pick your event, verify your student identity, and lock in your spot. Register for the CTF, submit an Innovation Symposium idea, or join the Panel Discussion and Hands-on Activities."
        crumbs={[{ label: "Home", href: "/" }, { label: "Register" }]}
      />

      <section className="section">
        <div className="section-inner">
          <div className="mx-auto max-w-4xl">
            {user && data.viewer ? (
              <RegistrationWizard
                events={data.events}
                workshops={data.workshops}
                universities={data.universities}
                viewer={data.viewer}
                bkashNumber={data.bkashNumber}
              />
            ) : (
              <RegisterAuthGate />
            )}
          </div>
        </div>
      </section>
    </>
  )
}
