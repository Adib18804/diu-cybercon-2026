import type * as React from "react"

import { cn } from "@/lib/utils"

// =============================================================================
// QrPassCard — a single entry pass: event, participant, signed QR, ID.
// Purely presentational (server-compatible).
// =============================================================================

export interface QrPassCardProps {
  eventName: string
  participantName: string
  registrationId: string
  qrDataUrl: string | null
  status: string
  checkedIn: boolean
  className?: string
}

export function QrPassCard({
  eventName,
  participantName,
  registrationId,
  qrDataUrl,
  status,
  checkedIn,
  className,
}: QrPassCardProps) {
  return (
    <div
      className={cn(
        "gradient-border overflow-hidden rounded-lg border border-border bg-bg-panel",
        className,
      )}
    >
      {/* Header */}
      <div className="border-b border-border bg-bg-elevated/60 px-5 py-3">
        <p className="font-mono text-[0.6rem] uppercase tracking-widest text-text-faint">
          Entry Pass · DIU_CYBERCON 2026
        </p>
        <h3 className="mt-0.5 truncate font-display text-sm font-semibold text-text-primary">
          {eventName}
        </h3>
      </div>

      {/* QR */}
      <div className="flex flex-col items-center px-5 py-6">
        {qrDataUrl ? (
          <div
            className="rounded-lg border border-cyan/25 bg-bg-deep p-3 shadow-glow-cyan-sm"
            role="img"
            aria-label={`QR code for registration ${registrationId}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt=""
              width={200}
              height={200}
              className="h-[200px] w-[200px]"
            />
          </div>
        ) : (
          <div className="flex h-[224px] w-[224px] items-center justify-center rounded-lg border border-dashed border-border">
            <p className="max-w-[160px] text-center text-xs text-text-faint">
              QR could not be generated. Refresh the page to retry.
            </p>
          </div>
        )}

        <p className="mt-4 font-mono text-[0.6rem] uppercase tracking-widest text-text-faint">
          Scan at the check-in desk
        </p>
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-bg-elevated/60 px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-text-primary">
              {participantName}
            </p>
            <p className="font-mono text-xs text-text-muted">{registrationId}</p>
          </div>
          <span
            className={cn(
              "shrink-0 font-mono text-[0.6rem] uppercase tracking-wider",
              checkedIn ? "text-neon" : "text-text-faint",
            )}
          >
            {checkedIn ? "Checked in" : status === "CONFIRMED" ? "Ready" : status}
          </span>
        </div>
        <p className="mt-2 text-[0.65rem] leading-relaxed text-text-faint">
          The QR contains only your signed registration ID — no personal data.
        </p>
      </div>
    </div>
  )
}
