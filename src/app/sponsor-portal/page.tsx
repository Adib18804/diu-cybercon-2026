// =============================================================================
// Sponsor Portal — /sponsor-portal
// Post-application status for sponsors. Applications are matched to the
// signed-in account's email address (case-insensitive) — no public lookup,
// so applications can never be enumerated by outsiders.
// =============================================================================

import { Building2, ExternalLink, Globe, Handshake, Phone, User } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { EmptyState, StatusBadge } from "@/components/dashboard"
import { Card, CardContent } from "@/components/ui"
import { getSponsorApplicationsByEmail } from "@/lib/dashboard/queries"
import { getSessionUser } from "@/lib/rbac"
import { formatDate } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Sponsor Portal",
  description: "DIU CyberCon 2026 sponsor portal.",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

const TIER_LABELS: Record<string, string> = {
  TITLE: "Title Sponsor",
  PLATINUM: "Platinum Sponsor",
  GOLD: "Gold Sponsor",
  CUSTOM: "Custom Sponsorship",
  PARTNER: "Partner",
  MEDIA_PARTNER: "Media Partner",
  TECHNICAL_PARTNER: "Technical Partner",
  OTHER_PARTNER: "Other Partner",
}

const PIPELINE = [
  "SUBMITTED",
  "CONTACTED",
  "NEGOTIATION",
  "APPROVED",
  "COMPLETED",
] as const

const PIPELINE_LABELS: Record<(typeof PIPELINE)[number], string> = {
  SUBMITTED: "Submitted",
  CONTACTED: "Contacted",
  NEGOTIATION: "In negotiation",
  APPROVED: "Approved",
  COMPLETED: "Completed",
}

export default async function SponsorPortalPage() {
  const user = await getSessionUser()
  if (!user) {return null}

  const applications = await getSponsorApplicationsByEmail(user.email)

  return (
    <main className="section">
      <div className="section-inner mx-auto max-w-3xl">
        <p className="section-label">{"// Sponsor portal"}</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          Sponsor Portal
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-muted">
          Track the status of your sponsorship applications and see where each
          one is in the review pipeline.
        </p>

        <div className="mt-8">
          {applications.length === 0 ? (
            <EmptyState
              icon={<Handshake className="h-6 w-6" />}
              title="No sponsor applications found"
              description={`We could not find a sponsorship application linked to ${user.email}. If you applied with a different email address, please contact the sponsorship team.`}
              action={
                <Link href="/sponsors#apply" className="btn-primary">
                  Apply to Sponsor
                </Link>
              }
            />
          ) : (
            <div className="space-y-5">
              {applications.map((app) => {
                const isRejected = app.status === "REJECTED"
                const currentIndex = isRejected
                  ? -1
                  : PIPELINE.indexOf(
                      app.status as (typeof PIPELINE)[number],
                    )

                return (
                  <Card key={app.id} padding="none">
                    <CardContent className="p-0">
                      <div className="p-5 sm:p-6">
                        {/* Header */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Building2 className="h-4 w-4 shrink-0 text-cyan" />
                          <h2 className="min-w-0 font-display text-base font-semibold text-text-primary">
                            {app.orgName}
                          </h2>
                          <StatusBadge status={app.status} size="sm" />
                        </div>
                        <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-faint">
                          {TIER_LABELS[app.tier] ?? app.tier}
                        </p>

                        {/* Pipeline */}
                        {isRejected ? (
                          <p className="mt-4 rounded-md border border-pink/30 bg-pink/5 px-3 py-2 text-xs leading-relaxed text-text-muted">
                            This application was not taken forward.{" "}
                            <Link
                              href="/contact"
                              className="text-cyan underline-offset-2 hover:underline"
                            >
                              Contact the team
                            </Link>{" "}
                            if you would like to discuss alternatives.
                          </p>
                        ) : (
                          <ol className="mt-5 flex flex-wrap items-center gap-y-2">
                            {PIPELINE.map((step, index) => {
                              const reached = index <= currentIndex
                              return (
                                <li
                                  key={step}
                                  className="flex items-center"
                                  aria-current={
                                    index === currentIndex ? "step" : undefined
                                  }
                                >
                                  <span
                                    className={
                                      reached
                                        ? "flex items-center gap-1.5 rounded-full border border-neon/40 bg-neon/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-neon"
                                        : "flex items-center gap-1.5 rounded-full border border-border bg-bg-elevated px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-text-faint"
                                    }
                                  >
                                    {PIPELINE_LABELS[step]}
                                  </span>
                                  {index < PIPELINE.length - 1 ? (
                                    <span
                                      aria-hidden="true"
                                      className={
                                        index < currentIndex
                                          ? "mx-1 h-px w-4 bg-neon/40"
                                          : "mx-1 h-px w-4 bg-border"
                                      }
                                    />
                                  ) : null}
                                </li>
                              )
                            })}
                          </ol>
                        )}

                        {/* Details */}
                        <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2 text-xs sm:grid-cols-2">
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 shrink-0 text-text-faint" />
                            <dt className="sr-only">Contact person</dt>
                            <dd className="text-text-muted">
                              {app.contactPerson}
                            </dd>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-text-faint" />
                            <dt className="sr-only">Phone</dt>
                            <dd className="text-text-muted">{app.phone}</dd>
                          </div>
                          {app.website ? (
                            <div className="flex items-center gap-2 sm:col-span-2">
                              <Globe className="h-3.5 w-3.5 shrink-0 text-text-faint" />
                              <dt className="sr-only">Website</dt>
                              <dd>
                                <a
                                  href={app.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-cyan underline-offset-2 hover:underline"
                                >
                                  {app.website}
                                  <ExternalLink
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                  />
                                </a>
                              </dd>
                            </div>
                          ) : null}
                          <div className="flex gap-2">
                            <dt className="text-text-faint">Applied</dt>
                            <dd className="text-text-muted">
                              {formatDate(app.createdAt)}
                            </dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="text-text-faint">Last update</dt>
                            <dd className="text-text-muted">
                              {formatDate(app.updatedAt)}
                            </dd>
                          </div>
                        </dl>

                        {app.message ? (
                          <p className="mt-4 rounded-md border border-border bg-bg-elevated px-3 py-2 text-xs leading-relaxed text-text-muted">
                            <span className="font-mono uppercase tracking-widest text-text-faint">
                              Your message:
                            </span>{" "}
                            {app.message}
                          </p>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        <p className="mt-6 text-xs leading-relaxed text-text-faint">
          Applications are matched to your account email ({user.email}). If you
          applied with a different email, contact the sponsorship team so we can
          link it to your account.
        </p>
      </div>
    </main>
  )
}
