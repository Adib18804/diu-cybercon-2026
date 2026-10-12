// =============================================================================
// Dashboard — My Documents
// Student ID verification status + confirmation pass downloads.
// Student ID files live in private storage — only the verification team can
// open them; this page shows review metadata only.
// =============================================================================

import { Download, FileText, ShieldCheck } from "lucide-react"
import type { Metadata } from "next"

import { EmptyState, StatusBadge } from "@/components/dashboard"
import { Card, CardContent } from "@/components/ui"
import { getMyRegistrations, getMyVerifications } from "@/lib/dashboard/queries"
import { getSessionUser } from "@/lib/rbac"
import { formatDate } from "@/lib/utils"

export const metadata: Metadata = {
  title: "My Documents",
}

export const dynamic = "force-dynamic"

export default async function DashboardDocumentsPage() {
  const user = await getSessionUser()
  if (!user) {return null}

  const [verifications, registrations] = await Promise.all([
    getMyVerifications(user.id),
    getMyRegistrations(user.id),
  ])

  const activeRegistrations = registrations.filter(
    (reg) => reg.status !== "CANCELLED",
  )

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-xl font-bold text-text-primary">
          My Documents
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Student ID verification status and your confirmation passes.
        </p>
      </div>

      {/* ── Student ID verification ─────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-cyan" />
          <h3 className="font-mono text-xs uppercase tracking-widest text-text-muted">
            Student ID verification
          </h3>
        </div>

        {verifications.length === 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-bg-panel p-4 text-sm text-text-muted">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-text-faint" />
            <p>
              No student ID documents uploaded yet. Your student ID is collected
              during event registration and reviewed by the verification team.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {verifications.map((doc) => (
              <Card key={doc.id} padding="none">
                <CardContent className="p-0">
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-text-faint" />
                      <h4 className="min-w-0 truncate font-body text-sm text-text-primary">
                        {doc.fileName}
                      </h4>
                      <StatusBadge status={doc.status} size="sm" />
                    </div>

                    <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1.5 text-xs sm:grid-cols-2">
                      <div className="flex gap-2">
                        <dt className="text-text-faint">Context</dt>
                        <dd className="text-text-muted">{doc.contextLabel}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-text-faint">Uploaded</dt>
                        <dd className="text-text-muted">
                          {formatDate(doc.uploadedAt)}
                        </dd>
                      </div>
                    </dl>

                    {doc.reviewNote ? (
                      <p className="mt-3 rounded-md border border-border bg-bg-elevated px-3 py-2 text-xs text-text-muted">
                        <span className="font-mono uppercase tracking-widest text-text-faint">
                          Review note:
                        </span>{" "}
                        {doc.reviewNote}
                      </p>
                    ) : null}

                    {doc.status === "REVISION_REQUIRED" ||
                    doc.status === "REJECTED" ? (
                      <p className="mt-3 text-xs text-amber">
                        To replace this document, remove the member from{" "}
                        <span className="text-text-muted">My Team</span> and add
                        them again with the corrected student ID.
                      </p>
                    ) : null}

                    <p className="mt-3 text-[11px] leading-relaxed text-text-faint">
                      For privacy and security, student ID files are stored in
                      private storage and can only be opened by the verification
                      team. Every view is logged.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Confirmation passes ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-cyan" />
          <h3 className="font-mono text-xs uppercase tracking-widest text-text-muted">
            Confirmation passes
          </h3>
        </div>

        {activeRegistrations.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No confirmation passes yet"
            description="Once you register for an event, your confirmation pass PDF will appear here for download."
          />
        ) : (
          <Card padding="none">
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {activeRegistrations.map((reg) => (
                  <li
                    key={reg.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-text-primary">
                          {reg.eventName}
                        </span>
                        <StatusBadge status={reg.status} size="sm" />
                      </div>
                      <p className="mt-1 font-mono text-xs text-text-faint">
                        {reg.registrationId}
                      </p>
                    </div>
                    <a
                      href={`/api/registrations/${reg.registrationId}/confirmation`}
                      className="btn-secondary !px-3 !py-1.5 !text-xs"
                      download
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Download PDF
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}
