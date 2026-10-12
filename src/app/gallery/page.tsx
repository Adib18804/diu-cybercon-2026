// =============================================================================
// Gallery — /gallery
// Published event photos, filtered by category and year.
// =============================================================================

import { Eye } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { GalleryGrid, type GalleryItem } from "./GalleryGrid"

import { EmptyState, PageHeader } from "@/components/layout"
import { prisma } from "@/lib/db"

export const revalidate = 300

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "Photos and highlights from DIU CyberCon — competition days, showcases, and moments from Daffodil Smart City.",
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getImages(): Promise<GalleryItem[]> {
  try {
    const images = await prisma.galleryImage.findMany({
      where: { isPublished: true },
      orderBy: [{ year: "desc" }, { displayOrder: "asc" }],
      select: {
        id: true,
        title: true,
        imageKey: true,
        publicUrl: true,
        category: true,
        altText: true,
        year: true,
      },
    })

    // Only render publicly reachable URLs — raw storage keys are never exposed.
    const result: GalleryItem[] = []
    for (const img of images) {
      const src = img.publicUrl?.startsWith("http")
        ? img.publicUrl
        : img.imageKey.startsWith("http")
          ? img.imageKey
          : null
      if (!src) {continue}
      result.push({
        id: img.id,
        title: img.title,
        src,
        category: img.category,
        altText: img.altText,
        year: img.year,
      })
    }
    return result
  } catch {
    return []
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function GalleryPage() {
  const images = await getImages()

  return (
    <>
      <PageHeader
        label="Media"
        title="Gallery"
        description="Snapshots from DIU CyberCon — competition days, showcases, and the moments in between. Photos are published here as the event unfolds."
        crumbs={[{ label: "Home", href: "/" }, { label: "Gallery" }]}
        actions={
          <>
            <Link href="/events" className="btn-secondary">
              Explore the Events
            </Link>
            <Link href="/announcements" className="btn-primary">
              Latest Updates
            </Link>
          </>
        }
      />

      <section className="section">
        <div className="section-inner">
          {images.length === 0 ? (
            <EmptyState
              icon={<Eye size={24} />}
              title="Event photos coming soon"
              description="The CyberCon 2026 gallery opens as the event unfolds — highlights from the online CTF preliminary round and the on-site days at Daffodil Smart City will appear here."
              action={
                <>
                  <Link href="/announcements" className="btn-secondary">
                    Get Updates
                  </Link>
                  <Link href="/contact" className="btn-primary">
                    Contact the Team
                  </Link>
                </>
              }
            />
          ) : (
            <GalleryGrid items={images} />
          )}
        </div>
      </section>
    </>
  )
}
