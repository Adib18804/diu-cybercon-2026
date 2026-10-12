// =============================================================================
// DIU CyberCon 2026 — Registration Confirmation PDF
// One-page A4 pass with the signed QR code (registration ID only — no PII in
// the QR itself). Built with pdf-lib + StandardFonts (WinAnsi) — all text is
// sanitized through pdfSafe() so unusual unicode can never crash generation.
// =============================================================================

import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

import { APP_NAME, APP_TAGLINE, APP_URL, EVENT_DATES, VENUE } from "@/lib/constants"

// ─── Palette (print-friendly, dark on white) ─────────────────────────────────

const INK = rgb(0.043, 0.078, 0.125) // #0B1420
const MUTED = rgb(0.353, 0.396, 0.471) // #5A6578
const FAINT = rgb(0.573, 0.612, 0.678) // #929CB0
const CYAN = rgb(0, 0.898, 1) // #00E5FF
const PANEL = rgb(0.953, 0.965, 0.98) // #F3F6FA
const BORDER = rgb(0.839, 0.871, 0.91) // #D6DE E8-ish
const NOTE_BG = rgb(1, 0.976, 0.902) // #FFF9E6
const NOTE_BORDER = rgb(0.91, 0.851, 0.659) // #E8D9A8

// ─── Text sanitizer (StandardFonts use WinAnsi encoding) ─────────────────────

/**
 * Make arbitrary user/DB text safe for pdf-lib StandardFonts.
 * Common typographic characters are transliterated; anything outside the
 * WinAnsi range (e.g. Bengali) is dropped rather than throwing at draw time.
 */
export function pdfSafe(text: string): string {
  return text
    .replace(/[\u2018\u2019\u02BC\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u00A0\u202F\u2009]/g, " ")
    .replace(/\u2022/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface ConfirmationPdfInput {
  registrationId: string
  participantName: string
  eventName: string
  teamName: string | null
  qrDataUrl: string // PNG data URL (print style — black on white)
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export async function buildRegistrationConfirmationPdf(
  input: ConfirmationPdfInput,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595.28, 841.89]) // A4 portrait

  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const mono = await doc.embedFont(StandardFonts.CourierBold)

  const { width, height } = page.getSize()

  // ── Top brand band ──────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 100, width, height: 100, color: INK })
  page.drawText(pdfSafe(APP_NAME.toUpperCase()), {
    x: 50,
    y: height - 52,
    size: 21,
    font: bold,
    color: CYAN,
  })
  page.drawText(pdfSafe(APP_TAGLINE), {
    x: 50,
    y: height - 72,
    size: 9,
    font: regular,
    color: rgb(0.6, 0.66, 0.76),
  })
  const orgLine = pdfSafe(
    "Cyber Security Club, Department of CSE — Daffodil International University",
  )
  const orgWidth = regular.widthOfTextAtSize(orgLine, 8)
  page.drawText(orgLine, {
    x: width - 50 - orgWidth,
    y: height - 52,
    size: 8,
    font: regular,
    color: rgb(0.6, 0.66, 0.76),
  })

  // ── Heading ─────────────────────────────────────────────────────────────────
  page.drawText("Registration Confirmed", {
    x: 50,
    y: 706,
    size: 20,
    font: bold,
    color: INK,
  })
  page.drawText(
    pdfSafe(
      "Keep this pass safe. Present the QR code at the check-in desk on event day.",
    ),
    { x: 50, y: 688, size: 10, font: regular, color: MUTED },
  )

  // ── Registration ID panel ───────────────────────────────────────────────────
  page.drawRectangle({
    x: 40,
    y: 600,
    width: 336,
    height: 68,
    color: PANEL,
  })
  page.drawText("REGISTRATION ID", {
    x: 56,
    y: 645,
    size: 8,
    font: bold,
    color: MUTED,
  })
  page.drawText(pdfSafe(input.registrationId), {
    x: 56,
    y: 614,
    size: 24,
    font: mono,
    color: INK,
  })

  // ── QR code (print style, black on white) ───────────────────────────────────
  const qrPng = Buffer.from(
    input.qrDataUrl.replace(/^data:image\/png;base64,/, ""),
    "base64",
  )
  const qrImage = await doc.embedPng(qrPng)
  page.drawRectangle({
    x: 400,
    y: 580,
    width: 156,
    height: 154,
    color: rgb(1, 1, 1),
    borderColor: BORDER,
    borderWidth: 1,
  })
  page.drawImage(qrImage, { x: 414, y: 594, width: 128, height: 128 })
  const caption = "SCAN AT CHECK-IN"
  const captionWidth = bold.widthOfTextAtSize(caption, 8)
  page.drawText(caption, {
    x: 400 + (156 - captionWidth) / 2,
    y: 566,
    size: 8,
    font: bold,
    color: MUTED,
  })

  // ── Details ─────────────────────────────────────────────────────────────────
  page.drawLine({
    start: { x: 50, y: 548 },
    end: { x: width - 50, y: 548 },
    thickness: 0.75,
    color: BORDER,
  })

  const rows: Array<{ label: string; value: string }> = [
    { label: "PARTICIPANT", value: input.participantName },
    { label: "EVENT", value: input.eventName },
    {
      label: input.teamName ? "TEAM" : "MODE",
      value: input.teamName ?? "Individual participation",
    },
    {
      label: "VENUE",
      value: `${VENUE.name}, ${VENUE.address}`,
    },
    {
      label: "EVENT DATES",
      value: `Day 1 (Online): ${EVENT_DATES.day1.date}  ·  Day 2: ${EVENT_DATES.day2.date}  ·  Day 3: ${EVENT_DATES.day3.date}`,
    },
  ]

  let rowY = 522
  for (const row of rows) {
    page.drawText(pdfSafe(row.label), {
      x: 50,
      y: rowY,
      size: 8,
      font: bold,
      color: FAINT,
    })
    page.drawText(pdfSafe(row.value), {
      x: 50,
      y: rowY - 16,
      size: 11,
      font: regular,
      color: INK,
    })
    rowY -= 47
  }

  // ── Important notes ─────────────────────────────────────────────────────────
  const noteLines = [
    "The QR code contains only your signed registration ID — no personal data.",
    "This pass is non-transferable and valid for the registered participant only.",
    "For team events, every member receives their own individual pass.",
    "Carry your student ID card — it will be checked at the venue.",
  ]

  const noteTop = 268
  const noteHeight = 34 + noteLines.length * 14
  page.drawRectangle({
    x: 40,
    y: noteTop - noteHeight,
    width: width - 80,
    height: noteHeight,
    color: NOTE_BG,
    borderColor: NOTE_BORDER,
    borderWidth: 1,
  })
  page.drawText("IMPORTANT", {
    x: 56,
    y: noteTop - 20,
    size: 9,
    font: bold,
    color: INK,
  })
  noteLines.forEach((line, index) => {
    page.drawText(pdfSafe(`- ${line}`), {
      x: 56,
      y: noteTop - 38 - index * 14,
      size: 9,
      font: regular,
      color: MUTED,
    })
  })

  // ── Footer ──────────────────────────────────────────────────────────────────
  const generated = pdfSafe(
    `Generated on ${new Date().toISOString().slice(0, 10)} · ${APP_URL.replace(/^https?:\/\//, "")}`,
  )
  page.drawText(generated, {
    x: 50,
    y: 96,
    size: 9,
    font: regular,
    color: MUTED,
  })
  page.drawText(
    pdfSafe(
      "Questions? Contact info@diucybercon.com — never share your QR code publicly.",
    ),
    { x: 50, y: 82, size: 9, font: regular, color: MUTED },
  )

  // Bottom band
  page.drawRectangle({ x: 0, y: 0, width, height: 36, color: INK })
  const footer = pdfSafe(`${APP_TAGLINE}  ·  www.diucybercon.com`)
  const footerWidth = regular.widthOfTextAtSize(footer, 8)
  page.drawText(footer, {
    x: (width - footerWidth) / 2,
    y: 14,
    size: 8,
    font: regular,
    color: CYAN,
  })

  return doc.save()
}
