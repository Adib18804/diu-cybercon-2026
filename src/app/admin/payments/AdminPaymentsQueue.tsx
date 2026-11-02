"use client"

import { CheckCircle2, Clipboard, CreditCard, XCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import toast from "react-hot-toast"

import { adminMutate, toastApiError } from "@/components/admin"
import { Button, Card, Modal, Textarea } from "@/components/ui"

export interface AdminPaymentRow {
  id: string
  amount: string
  method: string
  transactionId: string | null
  status: string
  createdAt: string
  registrationId: string
  participantName: string
  eventName: string
}

type Decision = "VERIFIED" | "REJECTED"

export function AdminPaymentsQueue({ payments }: { payments: AdminPaymentRow[] }) {
  const router = useRouter()
  const [decision, setDecision] = React.useState<{ payment: AdminPaymentRow; status: Decision } | null>(null)
  const [reason, setReason] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  async function submitDecision() {
    if (!decision || saving) {return}
    if (decision.status === "REJECTED" && reason.trim().length < 5) {
      toast.error("Enter a rejection reason of at least 5 characters.")
      return
    }
    setSaving(true)
    try {
      await adminMutate(
        `/api/admin/payments/${encodeURIComponent(decision.payment.id)}`,
        "PATCH",
        {
          status: decision.status,
          ...(decision.status === "REJECTED" ? { reason: reason.trim() } : {}),
        },
        { successMessage: decision.status === "VERIFIED" ? "Payment verified." : "Payment rejected." },
      )
      setDecision(null)
      setReason("")
      router.refresh()
    } catch (err) {
      toastApiError(err, "Could not review payment.")
    } finally {
      setSaving(false)
    }
  }

  async function copyTransactionId(transactionId: string) {
    try {
      await navigator.clipboard.writeText(transactionId)
      toast.success("Transaction ID copied.")
    } catch {
      toast.error("Could not copy the transaction ID.")
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan">Manual verification</p>
        <h1 className="mt-2 text-2xl font-bold text-text-primary">bKash payments</h1>
        <p className="mt-1 text-sm text-text-muted">Compare each transaction ID in the bKash merchant portal before verifying it.</p>
      </header>

      {payments.length === 0 ? (
        <Card className="p-8 text-center text-sm text-text-muted">No payments are waiting for verification.</Card>
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => (
            <Card key={payment.id} className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">{payment.participantName}</h2>
                  <p className="mt-1 text-sm text-text-muted">{payment.eventName} · {payment.registrationId}</p>
                  <p className="mt-1 text-xs text-text-faint">Submitted {new Date(payment.createdAt).toLocaleString()}</p>
                </div>
                <p className="font-mono text-lg font-bold text-cyan">৳{payment.amount}</p>
              </div>

              <div className="rounded-md border border-border bg-bg-elevated p-4">
                <p className="font-mono text-[0.625rem] uppercase tracking-widest text-text-faint">{payment.method} transaction ID</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <code className="break-all font-mono text-sm text-text-primary">{payment.transactionId ?? "Not provided"}</code>
                  {payment.transactionId && (
                    <Button variant="ghost" size="sm" leftIcon={<Clipboard className="h-3.5 w-3.5" />} onClick={() => void copyTransactionId(payment.transactionId!)}>Copy</Button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                <Button variant="danger" leftIcon={<XCircle className="h-4 w-4" />} onClick={() => {setReason(""); setDecision({ payment, status: "REJECTED" })}}>Reject</Button>
                <Button variant="primary" leftIcon={<CheckCircle2 className="h-4 w-4" />} onClick={() => {setReason(""); setDecision({ payment, status: "VERIFIED" })}}>Verify payment</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={decision !== null}
        onClose={() => {if (!saving) {setDecision(null)}}}
        title={decision?.status === "VERIFIED" ? "Verify payment?" : "Reject payment?"}
        description={decision?.status === "VERIFIED"
          ? "This confirms the registration and emails the participant a paid invoice."
          : "The participant will be emailed this reason and can submit another transaction ID."}
        size="sm"
        footer={(
          <>
            <Button variant="ghost" disabled={saving} onClick={() => setDecision(null)}>Cancel</Button>
            <Button
              variant={decision?.status === "REJECTED" ? "danger" : "primary"}
              loading={saving}
              leftIcon={decision?.status === "VERIFIED" ? <CreditCard className="h-4 w-4" /> : undefined}
              onClick={() => void submitDecision()}
            >
              {decision?.status === "VERIFIED" ? "Verify and confirm" : "Reject payment"}
            </Button>
          </>
        )}
      >
        {decision?.status === "REJECTED" && (
          <Textarea
            label="Reason for rejection"
            required
            minLength={5}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain why the transaction could not be verified."
            showCount
          />
        )}
      </Modal>
    </div>
  )
}
