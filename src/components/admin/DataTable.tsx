"use client"

// =============================================================================
// DataTable — generic admin list table with loading/error/empty states,
// optional toolbar and pagination bar. Purely presentational: data comes from
// useAdminList (or any { items, pagination } source).
// =============================================================================

import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Search,
} from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

import type { PaginationMeta } from "./useAdminList"

// ─── Column definition ────────────────────────────────────────────────────────

export interface Column<T> {
  /** Stable identity for the column (React key). */
  key: string
  /** Header cell content. */
  header: React.ReactNode
  /** Cell renderer. */
  render: (item: T) => React.ReactNode
  /** Extra classes for both the th and every td in this column. */
  className?: string
  /** Hide this column below lg breakpoint (row expands on mobile). */
  desktopOnly?: boolean
}

// ─── Table ────────────────────────────────────────────────────────────────────

export interface DataTableProps<T> {
  columns: Column<T>[]
  items: T[]
  /** Stable row key — also used for skeleton keys. */
  rowKey: (item: T) => string
  loading?: boolean
  error?: string | null
  /** Shown as a "Retry" button in the error state. */
  onRetry?: () => void
  emptyTitle?: string
  emptyDescription?: string
  /** Rendered above the table inside the card (search box, filters, actions). */
  toolbar?: React.ReactNode
  pagination?: PaginationMeta | null
  onPageChange?: (page: number) => void
  onRowClick?: (item: T) => void
  /** Skeleton row count while loading. */
  skeletonRows?: number
}

export function DataTable<T>({
  columns,
  items,
  rowKey,
  loading = false,
  error = null,
  onRetry,
  emptyTitle = "Nothing here yet",
  emptyDescription = "Records will appear here as they are created.",
  toolbar,
  pagination,
  onPageChange,
  onRowClick,
  skeletonRows = 8,
}: DataTableProps<T>) {
  const showEmpty = !loading && !error && items.length === 0

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg-panel">
      {toolbar && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          {toolbar}
        </div>
      )}

      {/* ── Error state ──────────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-pink/30 bg-pink/5 text-pink">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-text-primary">
            Could not load data
          </p>
          <p className="max-w-sm text-xs leading-relaxed text-text-muted">
            {error}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-cyan/40 hover:text-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {showEmpty && (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-bg-elevated text-text-faint">
            <Inbox className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-text-primary">{emptyTitle}</p>
          <p className="max-w-sm text-xs leading-relaxed text-text-muted">
            {emptyDescription}
          </p>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {!error && (loading || items.length > 0) && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-bg-elevated/50">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      "whitespace-nowrap px-4 py-2.5 font-mono text-micro uppercase tracking-wider text-text-muted",
                      col.desktopOnly && "hidden lg:table-cell",
                      col.className,
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: skeletonRows }).map((_, rowIdx) => (
                    <tr
                      key={`skeleton-${rowIdx}`}
                      className="border-b border-border-subtle last:border-b-0"
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            "px-4 py-3",
                            col.desktopOnly && "hidden lg:table-cell",
                          )}
                        >
                          <div
                            className="h-3.5 animate-pulse rounded bg-bg-elevated"
                            style={{ width: `${45 + ((rowIdx * 17 + col.key.length * 13) % 45)}%` }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                : items.map((item) => (
                    <tr
                      key={rowKey(item)}
                      onClick={onRowClick ? () => onRowClick(item) : undefined}
                      className={cn(
                        "border-b border-border-subtle last:border-b-0",
                        onRowClick &&
                          "cursor-pointer transition-colors hover:bg-bg-elevated/60",
                      )}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            "px-4 py-3 align-middle text-sm text-text-primary",
                            col.desktopOnly && "hidden lg:table-cell",
                            col.className,
                          )}
                        >
                          {col.render(item)}
                        </td>
                      ))}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination bar ───────────────────────────────────────────────── */}
      {pagination && !error && pagination.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="font-mono text-micro uppercase tracking-wider text-text-faint">
            Showing{" "}
            <span className="text-text-muted">
              {(pagination.page - 1) * pagination.pageSize + 1}–
              {Math.min(
                pagination.page * pagination.pageSize,
                pagination.total,
              )}
            </span>{" "}
            of <span className="text-text-muted">{pagination.total}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!pagination.hasPrevPage || loading}
              onClick={() => onPageChange?.(pagination.page - 1)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-cyan/40 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Prev
            </button>
            <span className="font-mono text-micro uppercase tracking-wider text-text-faint">
              Page {pagination.page} / {Math.max(1, pagination.totalPages)}
            </span>
            <button
              type="button"
              disabled={!pagination.hasNextPage || loading}
              onClick={() => onPageChange?.(pagination.page + 1)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-cyan/40 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Toolbar helpers ──────────────────────────────────────────────────────────

export interface AdminSearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function AdminSearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: AdminSearchInputProps) {
  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-faint"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-md border border-border bg-bg-elevated pl-9 pr-3 text-sm text-text-primary placeholder:text-text-faint transition-colors focus:border-cyan focus:outline-none focus:ring-0"
      />
    </div>
  )
}

export interface AdminFilterSelectProps {
  value: string
  onChange: (value: string | undefined) => void
  options: { value: string; label: string }[]
  allLabel?: string
  ariaLabel: string
  className?: string
}

export function AdminFilterSelect({
  value,
  onChange,
  options,
  allLabel = "All",
  ariaLabel,
  className,
}: AdminFilterSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value || undefined)}
      aria-label={ariaLabel}
      className={cn(
        "h-9 rounded-md border border-border bg-bg-elevated px-2.5 text-xs font-medium text-text-primary transition-colors focus:border-cyan focus:outline-none focus:ring-0",
        className,
      )}
    >
      <option value="">{allLabel}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
