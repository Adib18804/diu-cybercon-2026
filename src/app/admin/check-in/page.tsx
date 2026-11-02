"use client"

// =============================================================================
// /admin/check-in — event-day check-in desk
// Scan a participant's QR pass with the device camera (BarcodeDetector) or
// fall back to typing the registration ID. Shows the participant summary
// (name, registration ID, registered events, verification status, check-in
// status) and performs CHECK IN / CHECK OUT — every transition is recorded
// server-side with timestamp, admin actor, and IP.
// =============================================================================

import {
  Camera,
  CameraOff,
  CheckCircle2,
  Copy,
  Keyboard,
  LogOut,
  QrCode,
  ScanLine,
  UserRound,
  X,
} from "lucide-react"
import * as React from "react"
import toast from "react-hot-toast"

import { adminMutate, toastApiError } from "@/components/admin/api"
import { StatusPill } from "@/components/admin/status"
import { cn, formatTime, relativeTime } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckInStatus = "NOT_ARRIVED" | "CHECKED_IN" | "CHECKED_OUT"

type LookupPayload = {
  registration: {
    id: string
    registrationId: string
    status: "PENDING" | "CONFIRMED" | "CANCELLED" | "WAITLISTED"
    checkInStatus: CheckInStatus
    checkInTime: string | null
    checkOutTime: string | null
    createdAt: string
    event: { id: string; name: string; type: string }
    team: { id: string; name: string } | null
  }
  participant: {
    userId: string
    name: string
    email: string
    isSuspended: boolean
    studentId: string | null
    department: string | null
    phone: string | null
    university: { name: string; shortName: string | null } | null
    verificationStatus: string
  }
  registeredEvents: {
    registrationId: string
    status: string
    checkInStatus: CheckInStatus
    event: { name: string; type: string }
  }[]
}

// Minimal typings for the experimental BarcodeDetector API (Chromium).
type DetectedBarcode = { rawValue: string }
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>
}
declare global {
  interface Window {
    BarcodeDetector?: new (options?: {
      formats?: string[]
    }) => BarcodeDetectorLike
  }
}

const REGISTRATION_ID_PATTERN = /^CYB26-(?:C|TR|P|PJ|PN|W)-\d{3,}-[A-HJ-NP-Z2-9]{6}$/

function nextAction(status: CheckInStatus): "CHECK_IN" | "CHECK_OUT" {
  return status === "CHECKED_IN" ? "CHECK_OUT" : "CHECK_IN"
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminCheckInPage() {
  const [busy, setBusy] = React.useState(false)
  const [scanning, setScanning] = React.useState(false)
  const [supportChecked, setSupportChecked] = React.useState(false)
  const [scanSupported, setScanSupported] = React.useState(false)
  const [manualId, setManualId] = React.useState("")
  const [result, setResult] = React.useState<LookupPayload | null>(null)

  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const timerRef = React.useRef<number | null>(null)
  const handledRef = React.useRef(false)
  const lookingRef = React.useRef(false)

  // Feature detection after mount (avoids SSR/hydration mismatch).
  React.useEffect(() => {
    setScanSupported(
      typeof window !== "undefined" && "BarcodeDetector" in window,
    )
    setSupportChecked(true)
  }, [])

  // Stop the camera when the page unmounts.
  React.useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
      const stream = streamRef.current
      if (stream) {
        for (const track of stream.getTracks()) {track.stop()}
      }
    }
  }, [])

  // ── Lookup ────────────────────────────────────────────────────────────────

  const runLookup = React.useCallback(
    async (input: { token: string } | { registrationId: string }) => {
      if (lookingRef.current) {return}
      lookingRef.current = true
      setBusy(true)
      try {
        const data = await adminMutate<LookupPayload>(
          "/api/admin/check-in/lookup",
          "POST",
          input,
        )
        setResult(data)
      } catch (err) {
        toastApiError(err, "Lookup failed. Please try again.")
      } finally {
        lookingRef.current = false
        setBusy(false)
      }
    },
    [],
  )

  // ── Camera scanner ────────────────────────────────────────────────────────

  const stopScanner = React.useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const stream = streamRef.current
    if (stream) {
      for (const track of stream.getTracks()) {track.stop()}
      streamRef.current = null
    }
    if (videoRef.current) {videoRef.current.srcObject = null}
    handledRef.current = false
    setScanning(false)
  }, [])

  const startScanner = React.useCallback(async () => {
    if (typeof window === "undefined" || !window.BarcodeDetector) {
      toast.error(
        "This browser can't scan QR codes. Enter the registration ID manually instead.",
      )
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      })
      streamRef.current = stream
      setResult(null)
      setScanning(true)
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        toast.error(
          "Camera permission was denied. Allow camera access or use manual entry.",
        )
      } else if (err instanceof DOMException && err.name === "NotFoundError") {
        toast.error("No camera found on this device. Use manual entry.")
      } else {
        toast.error("Could not start the camera. Use manual entry instead.")
      }
    }
  }, [])

  // Attach the stream and run the detection loop while scanning.
  React.useEffect(() => {
    if (!scanning) {return}
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) {return}
    video.srcObject = stream
    void video.play().catch(() => undefined)

    const Ctor = window.BarcodeDetector
    if (!Ctor) {return}
    const detector = new Ctor({ formats: ["qr_code"] })
    let cancelled = false

    const tick = async () => {
      if (cancelled) {return}
      const el = videoRef.current
      if (el && el.readyState >= 2) {
        try {
          const codes = await detector.detect(el)
          const raw = codes[0]?.rawValue
          if (raw) {
            if (handledRef.current) {return}
            handledRef.current = true
            stopScanner()
            void runLookup({ token: raw })
            return
          }
        } catch {
          // Transient per-frame detection errors are expected — keep scanning.
        }
      }
      timerRef.current = window.setTimeout(() => { void tick() }, 350)
    }
    timerRef.current = window.setTimeout(() => { void tick() }, 600)

    return () => {
      cancelled = true
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [scanning, stopScanner, runLookup])

  // ── Manual lookup ─────────────────────────────────────────────────────────

  const submitManual = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const id = manualId.trim().toUpperCase()
    if (!REGISTRATION_ID_PATTERN.test(id)) {
      toast.error("Enter a valid event registration ID.")
      return
    }
    void runLookup({ registrationId: id })
  }

  // ── Check in / out ────────────────────────────────────────────────────────

  const handleAction = async () => {
    if (!result || busy) {return}
    const action = nextAction(result.registration.checkInStatus)
    setBusy(true)
    try {
      await adminMutate(
        "/api/admin/check-in/action",
        "POST",
        { registrationId: result.registration.registrationId, action },
        {
          successMessage:
            action === "CHECK_IN" ? "Checked in." : "Checked out.",
        },
      )
    } catch (err) {
      toastApiError(err, "Could not record the action.")
    } finally {
      // Always refresh from the server so the card reflects the true state
      // (e.g. a 409 duplicate updates the pill immediately).
      await runLookup({
        registrationId: result.registration.registrationId,
      })
      setBusy(false)
    }
  }

  const handleCopyId = async () => {
    if (!result) {return}
    try {
      await navigator.clipboard.writeText(result.registration.registrationId)
      toast.success("Registration ID copied.")
    } catch {
      toast.error("Could not copy — select the ID manually.")
    }
  }

  const resetForNext = () => {
    stopScanner()
    setResult(null)
    setManualId("")
  }

  const currentAction = result
    ? nextAction(result.registration.checkInStatus)
    : null
  const cancelled = result?.registration.status === "CANCELLED"

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
          <ScanLine className="h-5 w-5 text-cyan" aria-hidden="true" />
          Check-in
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-muted">
          Scan a participant&apos;s QR pass or type their registration ID.
          Every check-in and check-out is recorded with your admin account,
          timestamp, and IP address.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Scanner / manual entry ────────────────────────────────────── */}
        <section className="overflow-hidden rounded-lg border border-border bg-bg-panel">
          <div className="border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              {scanning ? (
                <Camera className="h-4 w-4 text-neon" aria-hidden="true" />
              ) : (
                <Camera className="h-4 w-4 text-text-muted" aria-hidden="true" />
              )}
              Scan participant
            </h2>
          </div>

          <div className="space-y-4 p-4">
            {scanning ? (
              <div className="space-y-3">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="aspect-[4/3] w-full rounded-md border border-border bg-black object-cover"
                />
                <p className="text-xs text-text-muted">
                  Point the camera at the participant&apos;s QR pass — it will
                  be read automatically.
                </p>
                <button
                  type="button"
                  onClick={stopScanner}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-bg-elevated px-3 text-xs font-medium text-text-primary transition-colors hover:border-pink/40 hover:text-pink focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
                >
                  <CameraOff className="h-3.5 w-3.5" aria-hidden="true" />
                  Stop camera
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-bg-elevated/40 text-center">
                  <QrCode className="h-8 w-8 text-text-faint" aria-hidden="true" />
                  <p className="max-w-[240px] text-xs leading-relaxed text-text-faint">
                    The camera preview appears here once scanning starts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void startScanner()}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-cyan/40 bg-cyan/10 px-4 text-sm font-medium text-cyan transition-colors hover:bg-cyan/20 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
                >
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  Start camera scanner
                </button>
                {supportChecked && !scanSupported && (
                  <p className="text-xs leading-relaxed text-amber">
                    Live QR scanning needs a Chromium-based browser (Chrome /
                    Edge on Android). On this device, use manual entry below.
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="font-mono text-micro uppercase tracking-wider text-text-faint">
                or enter manually
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={submitManual} className="flex gap-2">
              <div className="relative flex-1">
                <Keyboard
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-faint"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value.toUpperCase())}
                  placeholder="CYB26-C-101-A7F3K9"
                  aria-label="Registration ID"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="h-10 w-full rounded-md border border-border bg-bg-elevated pl-9 pr-3 font-mono text-sm uppercase tracking-wide text-text-primary placeholder:text-text-faint transition-colors focus:border-cyan focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={busy || manualId.trim().length === 0}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-bg-elevated px-4 text-sm font-medium text-text-primary transition-colors hover:border-cyan/40 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
              >
                {busy ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Look up
              </button>
            </form>
          </div>
        </section>

        {/* ── Result card ───────────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-lg border border-border bg-bg-panel">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <UserRound className="h-4 w-4 text-text-muted" aria-hidden="true" />
              Participant
            </h2>
            {result && (
              <button
                type="button"
                onClick={resetForNext}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-2.5 text-xs font-medium text-text-muted transition-colors hover:border-cyan/40 hover:text-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Next person
              </button>
            )}
          </div>

          <div className="p-4">
            {!result ? (
              <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-bg-elevated text-text-faint">
                  <QrCode className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium text-text-primary">
                  No participant loaded
                </p>
                <p className="max-w-xs text-xs leading-relaxed text-text-muted">
                  Scan a QR pass or enter a registration ID — the participant
                  summary and check-in controls will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Identity */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-text-primary">
                      {result.participant.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-text-muted">
                      {result.participant.email}
                    </p>
                  </div>
                  <StatusPill
                    status={result.registration.checkInStatus}
                    className="shrink-0"
                  />
                </div>

                {result.participant.isSuspended && (
                  <div className="rounded-md border border-pink/30 bg-pink/5 px-3 py-2 text-xs font-medium text-pink">
                    This account is suspended — contact the registration desk
                    before admitting.
                  </div>
                )}
                {cancelled && (
                  <div className="rounded-md border border-pink/30 bg-pink/5 px-3 py-2 text-xs font-medium text-pink">
                    This registration has been cancelled — check-in is blocked.
                  </div>
                )}

                {/* Details */}
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                  <div>
                    <p className="font-mono text-micro uppercase tracking-wider text-text-faint">
                      Registration ID
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="font-mono text-sm font-semibold text-text-primary">
                        {result.registration.registrationId}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopyId()}
                        aria-label="Copy registration ID"
                        className="rounded p-0.5 text-text-faint transition-colors hover:text-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <Detail label="Event" value={result.registration.event.name} />
                  {result.registration.team && (
                    <Detail
                      label="Team"
                      value={result.registration.team.name}
                    />
                  )}
                  {result.participant.studentId && (
                    <Detail
                      label="Student ID"
                      value={result.participant.studentId}
                      mono
                    />
                  )}
                  {result.participant.university && (
                    <Detail
                      label="University"
                      value={
                        result.participant.university.shortName &&
                        result.participant.university.name
                          ? `${result.participant.university.shortName} — ${result.participant.university.name}`
                          : result.participant.university.name
                      }
                    />
                  )}
                  <div>
                    <p className="font-mono text-micro uppercase tracking-wider text-text-faint">
                      Verification
                    </p>
                    <div className="mt-1">
                      <StatusPill
                        status={result.participant.verificationStatus}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="font-mono text-micro uppercase tracking-wider text-text-faint">
                      Registration
                    </p>
                    <div className="mt-1">
                      <StatusPill status={result.registration.status} />
                    </div>
                  </div>
                </div>

                {/* Registered events */}
                <div>
                  <p className="font-mono text-micro uppercase tracking-wider text-text-faint">
                    Registered events
                  </p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {result.registeredEvents.map((reg) => {
                      const isCurrent =
                        reg.registrationId ===
                        result.registration.registrationId
                      return (
                        <li
                          key={reg.registrationId}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                            isCurrent
                              ? "border-cyan/40 bg-cyan/10 text-cyan"
                              : "border-border bg-bg-elevated text-text-muted",
                          )}
                        >
                          {reg.event.name}
                          {isCurrent && (
                            <span className="font-mono text-[0.5625rem] uppercase tracking-wider">
                              current
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>

                {/* Timestamps */}
                <div className="space-y-1.5 rounded-md border border-border-subtle bg-bg-elevated/40 px-3 py-2.5">
                  <p className="text-xs text-text-muted">
                    <span className="text-text-faint">Checked in:</span>{" "}
                    {result.registration.checkInTime ? (
                      <>
                        {formatTime(result.registration.checkInTime)} ·{" "}
                        {relativeTime(result.registration.checkInTime)}
                      </>
                    ) : (
                      "Not yet"
                    )}
                  </p>
                  <p className="text-xs text-text-muted">
                    <span className="text-text-faint">Checked out:</span>{" "}
                    {result.registration.checkOutTime ? (
                      <>
                        {formatTime(result.registration.checkOutTime)} ·{" "}
                        {relativeTime(result.registration.checkOutTime)}
                      </>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>

                {/* Action */}
                {currentAction && (
                  <button
                    type="button"
                    onClick={() => void handleAction()}
                    disabled={busy || cancelled}
                    className={cn(
                      "inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan",
                      currentAction === "CHECK_IN"
                        ? "border-neon/40 bg-neon/10 text-neon hover:bg-neon/20"
                        : "border-cyan/40 bg-cyan/10 text-cyan hover:bg-cyan/20",
                    )}
                  >
                    {busy ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : currentAction === "CHECK_IN" ? (
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                    )}
                    {currentAction === "CHECK_IN"
                      ? result.registration.checkInStatus === "CHECKED_OUT"
                        ? "Check in again"
                        : "Check in"
                      : "Check out"}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Detail({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <p className="font-mono text-micro uppercase tracking-wider text-text-faint">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-sm text-text-primary",
          mono && "font-mono",
        )}
      >
        {value}
      </p>
    </div>
  )
}
