import { redirect } from "next/navigation"

import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"

import { AdminPaymentsQueue, type AdminPaymentRow } from "./AdminPaymentsQueue"

export const dynamic = "force-dynamic"

export default async function AdminPaymentsPage() {
  const { error } = await requirePermission("payments:view")
  if (error) {redirect("/403")}

  const rows = await prisma.payment.findMany({
    where: { status: "PENDING", registration: { status: { in: ["PAYMENT_PENDING", "PENDING_PAYMENT"] } } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      amount: true,
      method: true,
      transactionId: true,
      status: true,
      createdAt: true,
      registration: {
        select: {
          registrationId: true,
          user: { select: { name: true, profile: { select: { fullName: true } } } },
          event: { select: { name: true } },
        },
      },
    },
  })

  const payments: AdminPaymentRow[] = rows.map((payment) => ({
    id: payment.id,
    amount: payment.amount.toString(),
    method: payment.method,
    transactionId: payment.transactionId,
    status: payment.status,
    createdAt: payment.createdAt.toISOString(),
    registrationId: payment.registration.registrationId,
    participantName: payment.registration.user.profile?.fullName ?? payment.registration.user.name ?? "Participant",
    eventName: payment.registration.event.name,
  }))

  return <AdminPaymentsQueue payments={payments} />
}
