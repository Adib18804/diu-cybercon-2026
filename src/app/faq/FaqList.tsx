"use client"

import { Search } from "lucide-react"
import * as React from "react"

import { Accordion, Input } from "@/components/ui"
import { cn } from "@/lib/utils"

// =============================================================================
// FaqList — category filter + search over the published FAQ items
// =============================================================================

export interface FaqItem {
  id: string
  question: string
  answer: string
  category: string
}

const CATEGORY_ORDER = [
  "general",
  "registration",
  "ctf",
  "trace-route",
  "submissions",
  "venue",
  "sponsorship",
] as const

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  registration: "Registration",
  ctf: "CTF",
  "trace-route": "Trace & Route",
  submissions: "Project & Poster",
  venue: "Venue & Logistics",
  sponsorship: "Sponsorship",
}

const ALL = "all"

function orderIndex(category: string): number {
  const i = (CATEGORY_ORDER as readonly string[]).indexOf(category)
  return i === -1 ? CATEGORY_ORDER.length : i
}

function categoryLabel(category: string): string {
  return (
    CATEGORY_LABELS[category] ??
    category
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  )
}

function FaqList({ items }: { items: FaqItem[] }) {
  const [category, setCategory] = React.useState<string>(ALL)
  const [query, setQuery] = React.useState("")

  const categories = React.useMemo(() => {
    const seen: string[] = []
    for (const item of items) {
      if (!seen.includes(item.category)) {seen.push(item.category)}
    }
    return seen.sort((a, b) => orderIndex(a) - orderIndex(b))
  }, [items])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (category !== ALL && item.category !== category) {return false}
      if (!q) {return true}
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q)
      )
    })
  }, [items, category, query])

  const accordionItems = React.useMemo(
    () =>
      filtered.map((item) => ({
        value: item.id,
        trigger: <span className="whitespace-normal">{item.question}</span>,
        content: item.answer,
        ...(category === ALL ? { badge: categoryLabel(item.category) } : {}),
      })),
    [filtered, category],
  )

  return (
    <div className="space-y-8">
      {/* ── Controls ── */}
      <div className="space-y-4">
        <div className="max-w-md">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions…"
            aria-label="Search frequently asked questions"
            leftIcon={<Search size={16} />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            active={category === ALL}
            onClick={() => setCategory(ALL)}
          >
            All
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
        </div>
      </div>

      {/* ── Results ── */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-bg-panel/50 px-6 py-12 text-center">
          <p className="font-body text-sm text-text-muted">
            No questions match your search.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("")
              setCategory(ALL)
            }}
            className="btn-ghost mt-4 !py-2 text-xs"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <Accordion
            items={accordionItems}
            type="single"
            variant="cyber"
            iconStyle="chevron"
          />
          <p
            aria-live="polite"
            className="font-mono text-[0.625rem] uppercase tracking-widest text-text-faint"
          >
            Showing {filtered.length} of {items.length} questions
          </p>
        </>
      )}
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

export { FaqList }
