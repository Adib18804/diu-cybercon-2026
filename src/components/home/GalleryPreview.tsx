import { Camera, ImageIcon } from "lucide-react"
import Link from "next/link"

import type { HomeGalleryImage } from "./types"

import { Reveal } from "@/components/ui/Reveal"
import { SectionHeading } from "@/components/ui/SectionHeading"
import { cn } from "@/lib/utils"


// =============================================================================
// GalleryPreview — Section 18
// Shows published gallery images when available; honest placeholder otherwise
// (Part 22 — no placeholder photography pretending to be event photos).
// =============================================================================

export interface GalleryPreviewProps {
  images: HomeGalleryImage[]
}

function PreviewTile({ image }: { image: HomeGalleryImage }) {
  const hasImage = Boolean(image.publicUrl)

  return (
    <div className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-bg-panel">
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image.publicUrl as string}
          alt={image.altText}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-600 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-text-faint">
          <ImageIcon className="h-6 w-6" aria-hidden="true" />
          <span className="font-mono text-[0.6rem] uppercase tracking-widest">
            {image.category}
          </span>
        </div>
      )}

      {image.title && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg-deep/90 to-transparent p-3">
          <p className="truncate text-xs font-medium text-text-primary">{image.title}</p>
        </div>
      )}
    </div>
  )
}

function GalleryPreview({ images }: GalleryPreviewProps) {
  const preview = images.slice(0, 6)
  const placeholders = ["Opening Ceremony", "CTF Finals", "Project Expo", "Poster Hall", "Panel Stage", "Prize Giving"]

  return (
    <section className="section pt-0" id="gallery">
      <div className="section-inner">
        <Reveal>
          <SectionHeading
            label="// Gallery"
            title="Moments from the arena"
            description="CyberCon 2026 photos will be published here as the event unfolds."
            action={
              <Link href="/gallery" className="btn-secondary text-sm">
                Full Gallery
              </Link>
            }
          />
        </Reveal>

        {preview.length > 0 ? (
          <Reveal delay={0.05}>
            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
              {preview.map((image) => (
                <PreviewTile key={image.id} image={image} />
              ))}
            </div>
          </Reveal>
        ) : (
          <Reveal delay={0.05}>
            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3" aria-hidden="true">
              {placeholders.map((label, index) => (
                <div
                  key={label}
                  className={cn(
                    "flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-bg-panel/40",
                    index > 3 && "hidden md:flex",
                  )}
                >
                  <Camera className="h-5 w-5 text-text-faint" />
                  <span className="font-mono text-[0.6rem] uppercase tracking-widest text-text-faint">
                    {label}
                  </span>
                  <span className="font-mono text-[0.55rem] uppercase tracking-widest text-text-faint/60">
                    After the event
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center font-mono text-[0.65rem] uppercase tracking-widest text-text-faint">
              Media will be uploaded by the organising team during and after CyberCon 2026
            </p>
          </Reveal>
        )}
      </div>
    </section>
  )
}

export { GalleryPreview }
