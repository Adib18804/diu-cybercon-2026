"use client"

// =============================================================================
// Admin charts — recharts wrappers styled for the dark console theme.
// Data shapes are intentionally simple: { label, value } points and slices.
// =============================================================================

import * as React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { cn } from "@/lib/utils"

// ─── Palette ──────────────────────────────────────────────────────────────────

export const CHART_PALETTE = [
  "#E11D48", // cyan
  "#FB7185", // neon
  "#BE123C", // violet
  "#E11D48", // pink
  "#F43F5E", // amber
  "#9F1239",
  "#FDA4AF", // lavender
  "#BE123C",
  "#F43F5E",
  "#881337",
] as const

const AXIS_STYLE = {
  fill: "#A3A3A3",
  fontSize: 11,
  fontFamily: "'JetBrains Mono', monospace",
} as const

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "#121212",
  border: "1px solid #262626",
  borderRadius: "8px",
  fontSize: "12px",
  fontFamily: "'Inter', sans-serif",
  color: "#FFFFFF",
}

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ChartPoint {
  label: string
  value: number
}

export interface ChartCardProps {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  empty?: boolean
  emptyMessage?: string
  /** Chart height in px. */
  height?: number
}

function ChartCard({
  title,
  description,
  children,
  className,
  empty = false,
  emptyMessage = "Not enough data yet — check back after registrations arrive.",
  height = 260,
}: ChartCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-bg-panel p-4",
        className,
      )}
    >
      <p className="font-mono text-micro uppercase tracking-wider text-text-muted">
        {title}
      </p>
      {description && (
        <p className="mt-1 text-xs text-text-faint">{description}</p>
      )}
      <div className="mt-3" style={{ height }}>
        {empty ? (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border text-xs text-text-faint">
            {emptyMessage}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

// ─── Line chart ───────────────────────────────────────────────────────────────

export interface AdminLineChartProps {
  title: string
  description?: string
  data: ChartPoint[]
  color?: string
  height?: number
  className?: string
}

export function AdminLineChart({
  title,
  description,
  data,
  color = "#E11D48",
  height,
  className,
}: AdminLineChartProps) {
  return (
    <ChartCard
      title={title}
      description={description}
      className={className}
      height={height}
      empty={data.length === 0}
    >
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={{ stroke: "#262626" }}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={40}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ stroke: "#262626" }}
          labelStyle={{ color: "#A3A3A3" }}
        />
        <Line
          type="monotone"
          dataKey="value"
          name="Count"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: color }}
        />
      </LineChart>
    </ChartCard>
  )
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

export interface AdminBarChartProps {
  title: string
  description?: string
  data: ChartPoint[]
  color?: string
  /** "vertical" draws vertical bars (default); "horizontal" draws a ranked list. */
  orientation?: "vertical" | "horizontal"
  height?: number
  className?: string
  valueName?: string
}

export function AdminBarChart({
  title,
  description,
  data,
  color = "#E11D48",
  orientation = "vertical",
  height,
  className,
  valueName = "Count",
}: AdminBarChartProps) {
  const isHorizontal = orientation === "horizontal"
  return (
    <ChartCard
      title={title}
      description={description}
      className={className}
      height={height ?? (isHorizontal ? Math.max(220, data.length * 34) : 260)}
      empty={data.length === 0}
    >
      <BarChart
        data={data}
        layout={isHorizontal ? "vertical" : "horizontal"}
        margin={
          isHorizontal
            ? { top: 4, right: 16, bottom: 0, left: 8 }
            : { top: 4, right: 8, bottom: 0, left: -18 }
        }
      >
        <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={isHorizontal} horizontal={!isHorizontal} />
        {isHorizontal ? (
          <>
            <XAxis
              type="number"
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={{ stroke: "#262626" }}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={false}
              width={132}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey="label"
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={{ stroke: "#262626" }}
              interval={0}
              angle={data.length > 6 ? -30 : 0}
              textAnchor={data.length > 6 ? "end" : "middle"}
              height={data.length > 6 ? 52 : 30}
            />
            <YAxis
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={40}
            />
          </>
        )}
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "rgba(225, 29, 72, 0.06)" }}
          labelStyle={{ color: "#A3A3A3" }}
        />
        <Bar
          dataKey="value"
          name={valueName}
          fill={color}
          radius={isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          maxBarSize={isHorizontal ? 18 : 44}
        />
      </BarChart>
    </ChartCard>
  )
}

// ─── Pie chart ────────────────────────────────────────────────────────────────

export interface AdminPieChartProps {
  title: string
  description?: string
  data: ChartPoint[]
  height?: number
  className?: string
  colors?: readonly string[]
}

export function AdminPieChart({
  title,
  description,
  data,
  height = 260,
  className,
  colors = CHART_PALETTE,
}: AdminPieChartProps) {
  const total = data.reduce((sum, point) => sum + point.value, 0)
  return (
    <ChartCard
      title={title}
      description={description}
      className={className}
      height={height}
      empty={data.length === 0 || total === 0}
    >
      <PieChart>
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: "#A3A3A3" }}
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius="55%"
          outerRadius="82%"
          paddingAngle={2}
          stroke="#121212"
          strokeWidth={2}
        >
          {data.map((point, index) => (
            <Cell
              key={point.label}
              fill={colors[index % colors.length]}
            />
          ))}
        </Pie>
      </PieChart>
    </ChartCard>
  )
}

// ─── Legend / breakdown list ──────────────────────────────────────────────────

export function ChartBreakdown({
  data,
  colors = CHART_PALETTE,
}: {
  data: ChartPoint[]
  colors?: readonly string[]
}) {
  const total = data.reduce((sum, point) => sum + point.value, 0)
  if (total === 0) {return null}
  return (
    <ul className="mt-3 space-y-1.5">
      {data.map((point, index) => (
        <li
          key={point.label}
          className="flex items-center justify-between gap-3 text-xs"
        >
          <span className="flex min-w-0 items-center gap-2 text-text-muted">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: colors[index % colors.length] }}
              aria-hidden="true"
            />
            <span className="truncate">{point.label}</span>
          </span>
          <span className="shrink-0 font-mono text-text-primary">
            {point.value}
            <span className="ml-1 text-text-faint">
              ({Math.round((point.value / total) * 100)}%)
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}
