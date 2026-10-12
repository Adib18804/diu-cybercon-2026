"use client"

// =============================================================================
// useAdminList — paginated, searchable, filterable list state for admin tables.
// One hook powers every admin list page (participants, teams, sponsors, …).
// =============================================================================

import * as React from "react"

import { adminFetch } from "./api"

export type PaginationMeta = {
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export type AdminListResponse<T> = {
  items: T[]
  pagination: PaginationMeta
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

export interface UseAdminListOptions {
  initialPageSize?: number
  initialFilters?: Record<string, string | undefined>
  /** Extra static query params appended to every request (e.g. { eventType: "CTF" }). */
  extraParams?: Record<string, string | undefined>
}

export interface UseAdminListResult<T> {
  items: T[]
  pagination: PaginationMeta | null
  loading: boolean
  error: string | null
  page: number
  pageSize: number
  query: string
  filters: Record<string, string | undefined>
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  setQuery: (q: string) => void
  setFilter: (key: string, value: string | undefined) => void
  refresh: () => void
}

/**
 * Fetch a paginated admin list from `baseUrl` (an /api/admin/* endpoint that
 * returns `{ items, pagination }`). Aborts in-flight requests on change;
 * debounces search input by 300ms.
 */
export function useAdminList<T>(
  baseUrl: string,
  options: UseAdminListOptions = {},
): UseAdminListResult<T> {
  const [items, setItems] = React.useState<T[]>([])
  const [pagination, setPagination] = React.useState<PaginationMeta | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPageState] = React.useState(1)
  const [pageSize, setPageSizeState] = React.useState(
    options.initialPageSize ?? 25,
  )
  const [query, setQueryState] = React.useState("")
  const [filters, setFilters] = React.useState<Record<string, string | undefined>>(
    options.initialFilters ?? {},
  )
  const [refreshToken, setRefreshToken] = React.useState(0)

  const debouncedQuery = useDebounced(query, 300)

  const extraParamsKey = React.useMemo(
    () => JSON.stringify(options.extraParams ?? {}),
    [options.extraParams],
  )

  React.useEffect(() => {
    const controller = new AbortController()

    const params = new URLSearchParams()
    params.set("page", String(page))
    params.set("pageSize", String(pageSize))
    if (debouncedQuery) {params.set("q", debouncedQuery)}
    for (const [key, value] of Object.entries(filters)) {
      if (value) {params.set(key, value)}
    }
    const extra = JSON.parse(extraParamsKey) as Record<string, string | undefined>
    for (const [key, value] of Object.entries(extra)) {
      if (value) {params.set(key, value)}
    }

    setLoading(true)
    adminFetch<AdminListResponse<T>>(`${baseUrl}?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((data) => {
        setItems(data.items)
        setPagination(data.pagination)
        setError(null)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) {return}
        setError(
          err instanceof Error ? err.message : "Failed to load data.",
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) {setLoading(false)}
      })

    return () => controller.abort()
  }, [baseUrl, page, pageSize, debouncedQuery, filters, extraParamsKey, refreshToken])

  const setPage = React.useCallback((next: number) => {
    setPageState(Math.max(1, next))
  }, [])

  const setPageSize = React.useCallback((next: number) => {
    setPageSizeState(Math.max(1, next))
    setPageState(1)
  }, [])

  const setQuery = React.useCallback((next: string) => {
    setQueryState(next)
    setPageState(1)
  }, [])

  const setFilter = React.useCallback(
    (key: string, value: string | undefined) => {
      setFilters((prev) => ({ ...prev, [key]: value || undefined }))
      setPageState(1)
    },
    [],
  )

  const refresh = React.useCallback(() => {
    setRefreshToken((t) => t + 1)
  }, [])

  return {
    items,
    pagination,
    loading,
    error,
    page,
    pageSize,
    query,
    filters,
    setPage,
    setPageSize,
    setQuery,
    setFilter,
    refresh,
  }
}
