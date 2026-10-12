// =============================================================================
// Admin Component Library — Barrel Export
// Import from "@/components/admin" instead of individual files.
// =============================================================================

// ── Client data layer ─────────────────────────────────────────────────────────
export {
  AdminApiError,
  adminFetch,
  adminMutate,
  adminUploadImage,
  toastApiError,
} from "./api"
export type {
  ApiEnvelope,
  AdminApiErrorDetails,
  AdminUploadCategory,
  AdminUploadResult,
} from "./api"

export { useAdminList } from "./useAdminList"
export type {
  AdminListResponse,
  PaginationMeta,
  UseAdminListOptions,
  UseAdminListResult,
} from "./useAdminList"

// ── Presentation ──────────────────────────────────────────────────────────────
export { AdminShell } from "./AdminShell"
export type { AdminShellProps } from "./AdminShell"

export {
  DataTable,
  AdminSearchInput,
  AdminFilterSelect,
} from "./DataTable"
export type {
  Column,
  DataTableProps,
  AdminSearchInputProps,
  AdminFilterSelectProps,
} from "./DataTable"

export { Toggle, ImageUrlField, TagsField, FormGrid } from "./fields"
export type {
  ToggleProps,
  ImageUrlFieldProps,
  TagsFieldProps,
} from "./fields"

export { AdminStatCard } from "./StatCard"
export type { AdminStatCardProps, StatAccent } from "./StatCard"

export {
  AdminLineChart,
  AdminBarChart,
  AdminPieChart,
  ChartBreakdown,
  CHART_PALETTE,
} from "./charts"
export type {
  ChartPoint,
  ChartCardProps,
  AdminLineChartProps,
  AdminBarChartProps,
  AdminPieChartProps,
} from "./charts"

export { StatusPill, AdminRoleBadge, humanizeStatus } from "./status"
export type { StatusPillProps } from "./status"
