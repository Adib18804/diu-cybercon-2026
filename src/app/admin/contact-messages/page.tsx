"use client"

// =============================================================================
// Admin — Contact messages inbox (/admin/contact-messages)
// Messages submitted through the public contact form. This page is read-only:
// opening an unread message marks it as read, and replying happens over email
// ("Reply by email" opens the mail client). There is no delete.
// =============================================================================

import {
  CheckCheck,
  Loader2,
  Mail,
  RefreshCw,
} from "lucide-react"
import * as React from "react"

import {
  AdminFilterSelect,
  AdminSearchInput,
  adminFetch,
  adminMutate,
  DataTable,
  toastApiError,
  useAdminList,
  type Column,
} from "@/components/admin"
import { Button, Modal } from "@/components/ui"
import { cn, formatDate, relativeTime } from "@/lib/utils"

// ─── Types (mirror GET /api/admin/contact-messages) ──────────────────────────

type ContactMessageRow = {
  id: string
  name: string
  email: string
  subject: string
  message: string
  isRead: boolean
  repliedAt: string | null
  repliedBy: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

// ─── Filter options ───────────────────────────────────────────────────────────

const READ_FILTER_OPTIONS = [
  { value: "false", label: "Unread" },
  { value: "true", label: "Read" },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminContactMessagesPage() {
  const list = useAdminList<ContactMessageRow>("/api/admin/contact-messages")

  // ── Detail dialog state ────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<ContactMessageRow | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [markingReplied, setMarkingReplied] = React.useState(false)

  const closeDetail = React.useCallback(() => {
    setSelectedId(null)
    setDetail(null)
  }, [])

  const openMessage = React.useCallback(
    async (item: ContactMessageRow) => {
      setSelectedId(item.id)
      setDetail(null)
      setDetailLoading(true)
      try {
        const fresh = await adminFetch<ContactMessageRow>(
          `/api/admin/contact-messages/${item.id}`,
        )
        setDetail(fresh)

        // Opening an unread message marks it as read (silent PATCH — no toast).
        if (!item.isRead) {
          try {
            await adminMutate(
              `/api/admin/contact-messages/${item.id}`,
              "PATCH",
              { isRead: true },
            )
            setDetail((prev) =>
              prev && prev.id === item.id ? { ...prev, isRead: true } : prev,
            )
            list.refresh()
          } catch (err) {
            toastApiError(err, "Could not mark the message as read.")
          }
        }
      } catch (err) {
        toastApiError(err, "Could not load the message.")
        setSelectedId(null)
      } finally {
        setDetailLoading(false)
      }
    },
    [list],
  )

  const handleMarkReplied = React.useCallback(async () => {
    if (!detail || detail.repliedAt) {return}

    setMarkingReplied(true)
    try {
      const updated = await adminMutate<ContactMessageRow>(
        `/api/admin/contact-messages/${detail.id}`,
        "PATCH",
        { markReplied: true },
        { successMessage: "Message marked as replied." },
      )
      setDetail(updated)
      list.refresh()
    } catch (err) {
      toastApiError(err, "Could not mark the message as replied.")
    } finally {
      setMarkingReplied(false)
    }
  }, [detail, list])

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: Column<ContactMessageRow>[] = [
    {
      key: "name",
      header: "Name",
      render: (item) => (
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              item.isRead ? "bg-transparent" : "bg-cyan",
            )}
            title={item.isRead ? undefined : "Unread"}
            aria-hidden="true"
          />
          <span
            className={cn(
              "truncate text-text-primary",
              !item.isRead && "font-semibold",
            )}
          >
            {item.name}
          </span>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (item) => (
        <span className="truncate text-text-muted">{item.email}</span>
      ),
    },
    {
      key: "subject",
      header: "Subject",
      render: (item) => (
        <span className="block max-w-xs truncate text-text-primary">
          {item.subject || "—"}
        </span>
      ),
    },
    {
      key: "received",
      header: "Received",
      render: (item) => (
        <span className="whitespace-nowrap text-xs text-text-faint">
          {relativeTime(item.createdAt)}
        </span>
      ),
    },
  ]

  const replyHref = detail
    ? `mailto:${detail.email}?subject=${encodeURIComponent(
        detail.subject ? `Re: ${detail.subject}` : "Re: your message",
      )}`
    : ""

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/5 text-cyan">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              Contact messages
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
            Messages submitted through the public contact form. Opening an
            unread message marks it as read; replies are sent over email.
          </p>
        </div>

        <button
          type="button"
          onClick={list.refresh}
          disabled={list.loading}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-bg-elevated px-3 text-xs font-medium text-text-primary transition-colors hover:border-cyan/40 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", list.loading && "animate-spin")}
            aria-hidden="true"
          />
          Refresh
        </button>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        items={list.items}
        rowKey={(item) => item.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.refresh}
        emptyTitle="No messages found"
        emptyDescription="Messages submitted through the public contact form will appear here."
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRowClick={(item) => void openMessage(item)}
        toolbar={
          <>
            <AdminSearchInput
              value={list.query}
              onChange={list.setQuery}
              placeholder="Search by name, email, or subject…"
            />
            <AdminFilterSelect
              value={list.filters.isRead ?? ""}
              onChange={(value) => list.setFilter("isRead", value)}
              options={READ_FILTER_OPTIONS}
              allLabel="All messages"
              ariaLabel="Filter by read status"
            />
          </>
        }
      />

      {/* ── Message detail dialog ──────────────────────────────────────────── */}
      <Modal
        open={selectedId !== null}
        onClose={() => {
          if (!markingReplied) {closeDetail()}
        }}
        title={detail ? `Message from ${detail.name}` : "Message"}
        size="lg"
        footer={
          detail ? (
            <>
              <Button
                variant="secondary"
                leftIcon={<CheckCheck className="h-3.5 w-3.5" />}
                disabled={detail.repliedAt !== null}
                loading={markingReplied}
                loadingText="Marking…"
                title={
                  detail.repliedAt
                    ? "This message has already been replied to"
                    : undefined
                }
                onClick={() => void handleMarkReplied()}
              >
                Mark replied
              </Button>
              <a href={replyHref} className="btn-primary">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                Reply by email
              </a>
            </>
          ) : undefined
        }
      >
        {detailLoading || !detail ? (
          <div className="flex items-center justify-center py-12 text-text-faint">
            <Loader2
              className="h-5 w-5 animate-spin"
              aria-hidden="true"
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sender block */}
            <div className="rounded-lg border border-border bg-bg-elevated/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-text-primary">{detail.name}</p>
                  <a
                    href={`mailto:${detail.email}`}
                    className="mt-0.5 inline-block max-w-full truncate text-xs text-cyan hover:underline"
                  >
                    {detail.email}
                  </a>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-micro uppercase tracking-wider text-text-faint">
                    Received
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {formatDate(detail.createdAt)}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid gap-1.5 border-t border-border-subtle pt-3 text-xs sm:grid-cols-2">
                <p className="min-w-0 truncate">
                  <span className="text-text-faint">Subject: </span>
                  <span className="text-text-primary">
                    {detail.subject || "—"}
                  </span>
                </p>
                {detail.repliedAt && (
                  <p>
                    <span className="text-text-faint">Replied: </span>
                    <span className="text-neon">
                      {relativeTime(detail.repliedAt)}
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* Full message */}
            <div className="rounded-lg border border-border bg-bg-panel p-4">
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text-primary">
                {detail.message}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
