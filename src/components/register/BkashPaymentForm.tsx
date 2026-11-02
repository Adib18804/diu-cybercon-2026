"use client"

import { BadgeCheck, Send } from "lucide-react"
import * as React from "react"
import toast from "react-hot-toast"

import { Button, Input } from "@/components/ui"
import { paymentSubmissionSchema } from "@/lib/validations/payment"

export function BkashPaymentForm({
  registrationId,
  amount,
  bkashNumber,
  initialStatus,
  finalizationToken,
}: {
  registrationId: string
  amount: string
  bkashNumber: string
  initialStatus?: string | null
  finalizationToken?: string
}) {
  const [transactionId, setTransactionId] = React.useState("")
  const [status, setStatus] = React.useState(initialStatus ?? "")
  const [error, setError] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  async function submit() {
    const parsed = paymentSubmissionSchema.safeParse({
      registrationId,
      transactionId,
      ...(finalizationToken ? { finalizationToken } : {}),
    })
    if (!parsed.success) {
      setError(parsed.error.flatten().fieldErrors.transactionId?.[0] ?? "Enter a valid transaction ID.")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      })
      const payload = await response.json().catch(() => null) as {
        success?: boolean
        error?: string
        data?: { status: string }
      } | null
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error ?? "Could not submit payment.")
      }
      setStatus(payload.data.status)
      setTransactionId("")
      toast.success("bKash transaction submitted for verification.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit payment.")
    } finally {
      setSubmitting(false)
    }
  }

  if (status === "PENDING") {
    return <p className="mt-3 flex items-center gap-2 text-xs text-amber"><BadgeCheck className="h-4 w-4" />Payment submitted and awaiting admin verification.</p>
  }
  if (status === "VERIFIED") {
    return <p className="mt-3 flex items-center gap-2 text-xs text-neon"><BadgeCheck className="h-4 w-4" />Payment verified. Your registration is confirmed.</p>
  }
  if (!bkashNumber) {
    return <p className="mt-3 text-xs text-amber">bKash payments are not configured yet. Please contact the organizers.</p>
  }

  return (
    <div className="mt-4 space-y-3 rounded-md border border-pink/20 bg-pink/5 p-4">
      <div>
        <p className="font-mono text-[0.625rem] uppercase tracking-widest text-text-muted">Pay with bKash</p>
        <p className="mt-1 text-sm text-text-primary">Send ৳{amount} to <span className="font-mono font-semibold text-pink">{bkashNumber}</span></p>
        <p className="mt-1 text-xs text-text-faint">Use the official bKash Send Money instructions. Enter the transaction ID below after payment.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Input
          label="bKash transaction ID"
          value={transactionId}
          onChange={(event) => setTransactionId(event.target.value)}
          maxLength={100}
          autoComplete="off"
          error={error || undefined}
          helper="Letters and numbers only."
        />
        <Button onClick={() => void submit()} loading={submitting} leftIcon={<Send className="h-4 w-4" />}>
          Submit payment
        </Button>
      </div>
    </div>
  )
}
