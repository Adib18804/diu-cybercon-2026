import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

import { APP_NAME, APP_TAGLINE } from "@/lib/constants"
import { pdfSafe } from "@/lib/registrations/confirmation-pdf"

export interface RegistrationInvoiceInput {
  registrationId: string
  participantName: string
  eventName: string
  teamName: string | null
  amount: string
  issuedAt: Date
  payment?: { method: string; transactionId: string; paidAt: Date }
}

export async function buildRegistrationInvoicePdf(
  input: RegistrationInvoiceInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89])
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const ink = rgb(0.039, 0.039, 0.039)
  const muted = rgb(0.4, 0.4, 0.4)
  const border = rgb(0.82, 0.82, 0.82)
  const width = page.getWidth()

  page.drawRectangle({ x: 0, y: 741, width, height: 101, color: ink })
  page.drawText(pdfSafe(APP_NAME.toUpperCase()), {
    x: 48, y: 788, size: 20, font: bold, color: rgb(0.882, 0.114, 0.282),
  })
  page.drawText(pdfSafe(APP_TAGLINE), {
    x: 48, y: 768, size: 9, font: regular, color: rgb(0.65, 0.65, 0.65),
  })

  page.drawText("REGISTRATION INVOICE", {
    x: 48, y: 690, size: 17, font: bold, color: ink,
  })
  page.drawText(`Invoice date: ${input.issuedAt.toISOString().slice(0, 10)}`, {
    x: 48, y: 667, size: 10, font: regular, color: muted,
  })
  page.drawText(`Registration ID: ${pdfSafe(input.registrationId)}`, {
    x: 48, y: 648, size: 10, font: bold, color: ink,
  })

  page.drawLine({ start: { x: 48, y: 620 }, end: { x: width - 48, y: 620 }, thickness: 1, color: border })
  const details = [
    ["Participant", input.participantName],
    ["Event", input.eventName],
    ["Team", input.teamName ?? "Individual participation"],
  ] as const
  let y = 588
  for (const [label, value] of details) {
    page.drawText(pdfSafe(label.toUpperCase()), { x: 48, y, size: 8, font: bold, color: muted })
    page.drawText(pdfSafe(value), { x: 48, y: y - 18, size: 12, font: regular, color: ink })
    y -= 56
  }

  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Invalid registration fee for invoice")
  }
  const amountLabel = `BDT ${amount.toFixed(2)}`
  page.drawRectangle({ x: 40, y: 344, width: width - 80, height: 62, color: rgb(0.96, 0.96, 0.96) })
  page.drawText("Registration fee", { x: 58, y: 379, size: 11, font: regular, color: ink })
  page.drawText(amountLabel, { x: 430, y: 377, size: 12, font: bold, color: ink })
  page.drawLine({ start: { x: 58, y: 363 }, end: { x: width - 58, y: 363 }, thickness: 0.6, color: border })
  page.drawText(input.payment ? "Total paid" : "Total due", { x: 58, y: 349, size: 10, font: bold, color: ink })
  page.drawText(amountLabel, { x: 430, y: 349, size: 11, font: bold, color: ink })

  if (input.payment) {
    page.drawText(`Payment method: ${pdfSafe(input.payment.method)}`, {
      x: 48, y: 312, size: 9, font: regular, color: muted,
    })
    page.drawText(`Transaction ID: ${pdfSafe(input.payment.transactionId)}`, {
      x: 48, y: 296, size: 9, font: regular, color: muted,
    })
    page.drawText(`Paid at: ${input.payment.paidAt.toISOString().replace("T", " ").slice(0, 19)} UTC`, {
      x: 48, y: 280, size: 9, font: regular, color: muted,
    })
  } else {
    page.drawText(
      amount === 0
        ? "No payment is due for this registration."
        : "Please follow the payment instructions provided by the organizers.",
      { x: 48, y: 312, size: 9, font: regular, color: muted },
    )
  }
  page.drawLine({ start: { x: 48, y: 64 }, end: { x: width - 48, y: 64 }, thickness: 0.7, color: border })
  page.drawText("Generated automatically by DIU_CYBERCON 2026.", {
    x: 48, y: 46, size: 8, font: regular, color: muted,
  })

  return pdf.save()
}
