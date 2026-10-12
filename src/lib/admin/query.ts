// =============================================================================
// DIU CyberCon 2026 — Admin list-query parsing
// Standard page/pageSize/q parsing for every admin list endpoint so all
// admin tables paginate + search identically.
// =============================================================================

import { PAGINATION } from "@/lib/constants"
import { getPaginationParams } from "@/lib/utils"

export type AdminListParams = {
  page: number
  pageSize: number
  skip: number
  take: number
  /** Search text — trimmed, capped, undefined when empty. */
  q: string | undefined
}

/**
 * Parse `page`, `pageSize`, `q` from a request URL or URLSearchParams.
 * - page ≥ 1 (default 1)
 * - pageSize defaults to PAGINATION.adminDefaultPageSize, capped at adminMaxPageSize
 * - q is trimmed + capped at 100 chars; empty string → undefined
 */
export function parseAdminListParams(
  input: Request | URLSearchParams,
): AdminListParams {
  const params =
    input instanceof URLSearchParams ? input : new URL(input.url).searchParams

  const rawPage = Number.parseInt(params.get("page") ?? "1", 10)
  const rawPageSize = Number.parseInt(
    params.get("pageSize") ?? String(PAGINATION.adminDefaultPageSize),
    10,
  )

  const { page, pageSize, skip, take } = getPaginationParams(
    Number.isFinite(rawPage) ? rawPage : 1,
    Number.isFinite(rawPageSize) ? rawPageSize : PAGINATION.adminDefaultPageSize,
    PAGINATION.adminMaxPageSize,
  )

  const rawQ = (params.get("q") ?? "").trim().slice(0, 100)

  return { page, pageSize, skip, take, q: rawQ.length > 0 ? rawQ : undefined }
}

/**
 * Parse an enum-style filter against a whitelist. Unknown values are
 * ignored (treated as "no filter") — never forwarded to Prisma unchecked.
 */
export function parseEnumFilter<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const raw = params.get(key)
  if (!raw) {return undefined}
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined
}

/**
 * Build an OR-array of case-insensitive contains clauses for Prisma.
 * Usage: where.OR = buildSearchOr(q, ["name", "email"]) ?? undefined
 */
export function buildSearchOr(
  q: string | undefined,
  fields: string[],
): Array<Record<string, { contains: string; mode: "insensitive" }>> | undefined {
  if (!q || q.length === 0 || fields.length === 0) {return undefined}
  return fields.map((field) => ({
    [field]: { contains: q, mode: "insensitive" as const },
  }))
}
