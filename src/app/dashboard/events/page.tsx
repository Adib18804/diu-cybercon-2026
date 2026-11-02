// =============================================================================
// Dashboard — My Events
// All event registrations with status, team info, QR pass and PDF download.
// =============================================================================

import { CalendarDays, Download, QrCode, Ticket } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { EmptyState, StatusBadge } from "@/components/dashboard"
import { BkashPaymentForm } from "@/components/register/BkashPaymentForm"
import { Card, CardContent } from "@/components/ui"
import { getMyRegistrations } from "@/lib/dashboard/queries"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/rbac"
import { verifyFinalRegistrationToken } from "@/lib/registrations/finalization"
import { formatDate } from "@/lib/utils"

export const metadata: Metadata = {
  title: "My Events",
}

export const dynamic = "force-dynamic"

export default async function DashboardEventsPage({
  searchParams,
}: {
  searchParams?: { registration?: string; finalToken?: string }
}) {
  const user = await getSessionUser()
  if (!user) {return null}

  const [registrations, bkashSetting] = await Promise.all([
    getMyRegistrations(user.id),
    prisma.siteSetting.findUnique({ where: { key: "payment.bkashNumber" }, select: { value: true } }).catch(() => null),
  ])
  const bkashNumber = bkashSetting?.value.trim() ?? ""
  const active = registrations.filter((r) => r.status !== "CANCELLED")
  const cancelled = registrations.filter((r) => r.status === "CANCELLED")
  const finalClaims = verifyFinalRegistrationToken(searchParams?.finalToken)
  const linkedRegistrationId =
    finalClaims?.userId === user.id &&
    finalClaims.registrationId === searchParams?.registration &&
    registrations.some((registration) => registration.registrationId === finalClaims.registrationId)
      ? finalClaims.registrationId
      : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-text-primary">
          My Events
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Your event registrations, check-in status, and confirmation passes.
        </p>
      </div>

      {registrations.length === 0 ? (
        <EmptyState
          icon={<Ticket className="h-6 w-6" />}
          title="No registrations yet"
          description="Register for CTF, Innovation Symposium, Panel Discussion, or Hands-on Activities to get your event pass."
          action={
            <Link href="/register" className="btn-primary">
              Register for an Event
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {[...active, ...cancelled].map((reg) => {
            return (
              <Card key={reg.id} padding="none">
                <CardContent className="p-0">
                  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-semibold text-text-primary">
                          {reg.eventName}
                        </h3>
                        <StatusBadge status={reg.status} size="sm" />
                        {reg.status === "CONFIRMED" ? (
                          <StatusBadge status={reg.checkInStatus} size="sm" />
                        ) : null}
                      </div>

                      <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1.5 text-xs sm:grid-cols-2">
                        <div className="flex gap-2">
                          <dt className="text-text-faint">Registration ID</dt>
                          <dd className="font-mono text-text-muted">
                            {reg.registrationId}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="text-text-faint">Registered</dt>
                          <dd className="text-text-muted">
                            {formatDate(reg.createdAt)}
                          </dd>
                        </div>
                        {reg.teamName ? (
                          <div className="flex gap-2">
                            <dt className="text-text-faint">Team</dt>
                            <dd className="text-text-muted">
                              {reg.teamName}
                              {reg.isLeader ? " (leader)" : ""}
                            </dd>
                          </div>
                        ) : null}
                        {reg.isTeamEvent && !reg.teamName ? (
                          <div className="flex gap-2">
                            <dt className="text-text-faint">Team</dt>
                            <dd className="text-text-muted">Individual entry</dd>
                          </div>
                        ) : null}
                      </dl>
                      {reg.registrationPhase === "FINAL" && reg.domain ? (
                        <div className="mt-3 rounded-md border border-border bg-bg-elevated/50 p-3">
                          <p className="font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">Innovation Symposium domain</p>
                          <p className="mt-1 text-sm text-text-primary">{reg.domain}</p>
                          {reg.ideaSummary ? <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-text-muted">{reg.ideaSummary}</p> : null}
                        </div>
                      ) : null}
                      {(reg.status === "PRELIM_APPROVED" || reg.status === "PAYMENT_PENDING" || reg.status === "PENDING_PAYMENT") && Number(reg.registrationFee) > 0 && (reg.eventType !== "CTF" || reg.isLeader) && (
                        <BkashPaymentForm
                          registrationId={reg.registrationId}
                          amount={reg.registrationFee}
                          bkashNumber={bkashNumber}
                          initialStatus={reg.latestPaymentStatus}
                          finalizationToken={linkedRegistrationId === reg.registrationId ? searchParams?.finalToken : undefined}
                        />
                      )}
                      {reg.eventType === "CTF" && reg.status === "PRELIM_APPROVED" && !reg.isLeader ? (
                        <p className="mt-3 text-xs text-text-muted">Your team leader submits the single CTF final payment for the team.</p>
                      ) : null}
                      {reg.status === "PRELIM_APPROVED" && reg.registrationPhase === "FINAL" && linkedRegistrationId !== reg.registrationId ? (
                        <p className="mt-3 text-xs text-text-muted">Use the secure final-registration link sent to your email to complete payment.</p>
                      ) : null}
                    </div>

                    {reg.status === "CONFIRMED" ? (
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Link
                          href="/dashboard/qr"
                          className="btn-secondary !px-3 !py-1.5 !text-xs"
                        >
                          <QrCode className="mr-1.5 h-3.5 w-3.5" />
                          QR Pass
                        </Link>
                        <a
                          href={`/api/registrations/${reg.registrationId}/confirmation`}
                          className="btn-primary !px-3 !py-1.5 !text-xs"
                          download
                        >
                          <Download className="mr-1.5 h-3.5 w-3.5" />
                          Download Pass
                        </a>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {active.length === 0 && registrations.length > 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-panel p-4 text-sm text-text-muted">
          <CalendarDays className="h-4 w-4 shrink-0 text-cyan" />
          All your registrations are currently cancelled. Register again from the
          events page if you would like to participate.
        </div>
      ) : null}
    </div>
  )
}
