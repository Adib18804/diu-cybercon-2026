// =============================================================================
// Dashboard — QR Pass
// One entry pass per active registration. QR tokens are signed server-side
// and contain only the registration ID (never PII).
// =============================================================================

import { QrCode } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { EmptyState, QrPassCard } from "@/components/dashboard"
import { getDashboardProfile, getMyRegistrations } from "@/lib/dashboard/queries"
import { getSessionUser } from "@/lib/rbac"
import { generateQrDataUrl, signQrToken } from "@/lib/security/qr"

export const metadata: Metadata = {
  title: "QR Pass",
}

export const dynamic = "force-dynamic"

export default async function DashboardQrPage() {
  const user = await getSessionUser()
  if (!user) {return null}

  const [registrations, profile] = await Promise.all([
    getMyRegistrations(user.id),
    getDashboardProfile(user.id),
  ])

  const active = registrations.filter((r) => r.status === "CONFIRMED")
  const participantName =
    profile?.fullName ?? user.name?.trim() ?? user.email.split("@")[0] ?? "Participant"

  const passes = await Promise.all(
    active.map(async (reg) => {
      let qrDataUrl: string | null = null
      try {
        const token = await signQrToken(reg.registrationId)
        qrDataUrl = await generateQrDataUrl(token, "neon")
      } catch (err) {
        console.error("[dashboard/qr] QR generation failed:", err)
      }
      return { reg, qrDataUrl }
    }),
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-text-primary">
          QR Pass
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Present this code at the check-in desk on event day. Each pass belongs
          to one registration.
        </p>
      </div>

      {passes.length === 0 ? (
        <EmptyState
          icon={<QrCode className="h-6 w-6" />}
          title="No active passes"
          description="Your QR pass appears here once you have a confirmed event registration."
          action={
            <Link href="/register" className="btn-primary">
              Register for an Event
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {passes.map(({ reg, qrDataUrl }) => (
            <QrPassCard
              key={reg.id}
              eventName={reg.eventName}
              participantName={participantName}
              registrationId={reg.registrationId}
              qrDataUrl={qrDataUrl}
              status={reg.status}
              checkedIn={reg.checkInStatus !== "NOT_ARRIVED"}
            />
          ))}
        </div>
      )}
    </div>
  )
}
