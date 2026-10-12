"use client"

import * as React from "react"

import { Modal } from "@/components/ui"
import { cn } from "@/lib/utils"

// =============================================================================
// GalleryGrid — category/year filter + lightbox over published photos
// =============================================================================

export interface GalleryItem {
  id: string
  title: string | null
  src: string
  category: string
  altText: string
  year: number
}

const ALL = "all"

function categoryLabel(category: string): string {
  return category
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const [category, setCategory] = React.useState<string>(ALL)
  const [year, setYear] = React.useState<number | null>(null)
  const [active, setActive] = React.useState<GalleryItem | null>(null)

  const categories = React.useMemo(() => {
    const seen: string[] = []
    for (const item of items) {
      if (!seen.includes(item.category)) {seen.push(item.category)}
    }
    return seen
  }, [items])

  const years = React.useMemo(() => {
    const seen: number[] = []
    for (const item of items) {
      if (!seen.includes(item.year)) {seen.push(item.year)}
    }
    return seen.sort((a, b) => b - a)
  }, [items])

  const filtered = React.useMemo(
    () =>
      items.filter(
        (item) =>
          (category === ALL || item.category === category) &&
          (year === null || item.year === year),
      ),
    [items, category, year],
  )

  return (
    <div className="space-y-8">
      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={category === ALL} onClick={() => setCategory(ALL)}>
          All photos
        </FilterChip>
        {categories.map((c) => (
          <FilterChip
            key={c}
            active={category === c}
            onClick={() => setCategory(c)}
          >
            {categoryLabel(c)}
          </FilterChip>
        ))}

        {years.length > 1 && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <FilterChip active={year === null} onClick={() => setYear(null)}>
              All years
            </FilterChip>
            {years.map((y) => (
              <FilterChip
                key={y}
                active={year === y}
                onClick={() => setYear(y)}
              >
                {y}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-bg-panel/50 px-6 py-12 text-center">
          <p className="font-body text-sm text-text-muted">
            No photos in this selection yet.
          </p>
          <button
            type="button"
            onClick={() => {
              setCategory(ALL)
              setYear(null)
            }}
            className="btn-ghost mt-4 !py-2 text-xs"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setActive(item)}
                aria-label={`View photo: ${item.title ?? item.altText}`}
                className={cn(
                  "group block w-full overflow-hidden rounded-xl border border-border bg-bg-panel text-left",
                  "transition-all duration-400 hover:-translate-y-1 hover:border-cyan/40 hover:shadow-card-hover",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
                )}
              >
                <span className="relative block aspect-[4/3] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.src}
                    alt={item.altText}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 block bg-gradient-to-t from-bg-deep/90 via-bg-deep/40 to-transparent p-4 pt-10">
                    {item.title && (
                      <span className="block truncate font-display text-sm font-semibold text-text-primary">
                        {item.title}
                      </span>
                    )}
                    <span className="mt-1 flex items-center gap-2">
                      <span className="badge-muted">
                        {categoryLabel(item.category)}
                      </span>
                      <span className="font-mono text-[0.625rem] uppercase tracking-widest text-text-faint">
                        {item.year}
                      </span>
                    </span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ── Lightbox ── */}
      <Modal
        open={active !== null}
        onClose={() => setActive(null)}
        title={active?.title ?? "Photo"}
        description={
          active ? `${categoryLabel(active.category)} · ${active.year}` : undefined
        }
        size="xl"
      >
        {active && (
          <figure className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.src}
              alt={active.altText}
              className="w-full rounded-lg border border-border"
            />
            <figcaption className="font-body text-xs text-text-faint">
              {active.altText}
            </figcaption>
          </figure>
        )}
      </Modal>
    </div>
  )
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-4 py-2 font-mono text-xs uppercase tracking-wider",
        "transition-all duration-250 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
        active
          ? "border-cyan/50 bg-cyan/10 text-cyan"
          : "border-border text-text-muted hover:border-cyan/30 hover:text-text-primary",
      )}
    >
      {children}
    </button>
  )
}

export { GalleryGrid }
