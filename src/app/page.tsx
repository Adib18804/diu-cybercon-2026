import {
  EventIntro,
  EventStats,
  FaqPreview,
  FinalCta,
  GalleryPreview,
  Hero,
  ModuleGrid,
  PartnersSection,
  SchedulePreview,
  SponsorsSection,
  SpeakersPreview,
  VenueSection,
  formatISODateShort,
} from "@/components/home"
import type {
  HomeEvent,
  HomeFaq,
  HomeGalleryImage,
  HomePartner,
  HomeScheduleItem,
  HomeSpeaker,
  HomeSponsor,
  HomeStats,
} from "@/components/home"
import { APP_TAGLINE, EVENT_DATES, ORGANIZER, VENUE } from "@/lib/constants"
import { prisma } from "@/lib/db"

// =============================================================================
// Homepage — Phase 11
// Fully DB-driven: every section reads from the database with honest
// fallbacks (Part 22 — never fabricate speakers, sponsors, stats or prizes).
// Sections 01 (announcement bar) & 02 (navbar) live in the root layout.
// =============================================================================

export const revalidate = 120

// ─── Data loading ─────────────────────────────────────────────────────────────

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback
}

async function getHomepageData() {
  const [eventsR, faqsR, speakersR, scheduleR, sponsorsR, partnersR, galleryR, settingsR] =
    await Promise.allSettled([
      prisma.event.findMany({
        where: { type: { in: ["CTF", "INNOVATION_SYMPOSIUM", "PANEL_DISCUSSION", "HANDS_ON"] }, status: { not: "DRAFT" } },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.fAQ.findMany({
        where: { isPublished: true },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.speaker.findMany({
        where: { isVisible: true },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.scheduleItem.findMany({
        where: {
          OR: [
            { eventId: null },
            { event: { type: { in: ["CTF", "INNOVATION_SYMPOSIUM", "PANEL_DISCUSSION", "HANDS_ON"] }, status: { not: "DRAFT" } } },
          ],
        },
        orderBy: [{ day: "asc" }, { displayOrder: "asc" }],
      }),
      prisma.sponsor.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.partner.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.galleryImage.findMany({
        where: { isPublished: true },
        orderBy: { displayOrder: "asc" },
        take: 6,
      }),
      prisma.siteSetting.findMany(),
    ])

  // Settings → map with typed accessors
  const settingsMap = new Map(
    settledValue(settingsR, []).map((setting) => [setting.key, setting.value]),
  )
  const str = (key: string, fallback: string): string => {
    const value = settingsMap.get(key)
    return value !== undefined && value.length > 0 ? value : fallback
  }
  const bool = (key: string, fallback: boolean): boolean => {
    const value = settingsMap.get(key)
    if (value === undefined || value.length === 0) {return fallback}
    return value === "true"
  }

  // Events → serializable HomeEvent
  const events: HomeEvent[] = settledValue(eventsR, []).map((event) => ({
    id: event.id,
    type: event.type,
    slug: event.slug,
    name: event.name,
    shortDescription: event.shortDescription,
    fullDescription: event.fullDescription,
    registrationOpen: event.registrationOpen,
    registrationDeadline: event.registrationDeadline
      ? event.registrationDeadline.toISOString()
      : null,
    participantLimit: event.participantLimit,
    isTeamEvent: event.isTeamEvent,
    minTeamSize: event.minTeamSize,
    maxTeamSize: event.maxTeamSize,
    eventDay: event.eventDay,
    startDate: event.startDate ? event.startDate.toISOString() : null,
    endDate: event.endDate ? event.endDate.toISOString() : null,
    venue: event.venue,
    prizes: event.prizes,
    rules: event.rules,
    eligibility: event.eligibility,
    iconName: event.iconName,
    accentColor: event.accentColor,
  }))

  const faqs: HomeFaq[] = settledValue(faqsR, []).map((faq) => ({
    id: faq.id,
    question: faq.question,
    answer: faq.answer,
    category: faq.category,
  }))

  const speakers: HomeSpeaker[] = settledValue(speakersR, []).map((speaker) => ({
    id: speaker.id,
    name: speaker.name,
    title: speaker.title,
    organization: speaker.organization,
    bio: speaker.bio,
    expertise: speaker.expertise,
    photoKey: speaker.photoKey,
    linkedinUrl: speaker.linkedinUrl,
  }))

  const schedule: HomeScheduleItem[] = settledValue(scheduleR, []).map((item) => ({
    id: item.id,
    day: item.day,
    startTime: item.startTime,
    endTime: item.endTime,
    title: item.title,
    description: item.description,
    venue: item.venue,
    type: item.type,
    isHighlight: item.isHighlight,
  }))

  const sponsors: HomeSponsor[] = settledValue(sponsorsR, []).map((sponsor) => ({
    id: sponsor.id,
    name: sponsor.name,
    tier: sponsor.tier,
    logoKey: sponsor.logoKey,
    websiteUrl: sponsor.websiteUrl,
    description: sponsor.description,
  }))

  const partners: HomePartner[] = settledValue(partnersR, []).map((partner) => ({
    id: partner.id,
    name: partner.name,
    category: partner.category,
    logoKey: partner.logoKey,
    websiteUrl: partner.websiteUrl,
  }))

  const gallery: HomeGalleryImage[] = settledValue(galleryR, []).map((image) => ({
    id: image.id,
    title: image.title,
    publicUrl: image.publicUrl,
    altText: image.altText,
    category: image.category,
  }))

  // Earliest registration deadline among open events ("first deadline")
  const openDeadlines = events
    .filter((event) => event.registrationOpen && event.registrationDeadline !== null)
    .map((event) => event.registrationDeadline as string)
    .sort()
  const firstDeadlineLabel =
    openDeadlines.length > 0 && openDeadlines[0] !== undefined
      ? formatISODateShort(openDeadlines[0])
      : null

  const stats: HomeStats = {
    moduleCount: events.length,
    dayCount: 3,
  }

  return {
    hero: {
      title: str("hero.title", "DIU_CYBERCON 2026"),
      tagline: str("hero.tagline", APP_TAGLINE),
      description: str(
        "hero.description",
        "Join the CTF, present at the Innovation Symposium, or take part in a hands-on workshop on 12 December 2026 at Daffodil International University.",
      ),
      countdownTarget: str("event.countdown.target", EVENT_DATES.countdownTarget),
      registrationOpen: bool("registration.open", true),
      organizerName: str("organizer.name", ORGANIZER.name),
      firstDeadlineLabel,
    },
    events,
    faqs,
    speakers,
    schedule,
    sponsors,
    partners,
    gallery,
    stats,
    venue: {
      name: str("venue.name", VENUE.name),
      address: str("venue.address", VENUE.address),
      mapEmbedUrl: settingsMap.get("venue.mapEmbedUrl") ?? "",
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const data = await getHomepageData()

  return (
    <>
      {/* 03 · Hero — what / when / where / how to register (Part 28) */}
      <Hero
        title={data.hero.title}
        tagline={data.hero.tagline}
        description={data.hero.description}
        countdownTarget={data.hero.countdownTarget}
        registrationOpen={data.hero.registrationOpen}
        organizerName={data.hero.organizerName}
        firstDeadlineLabel={data.hero.firstDeadlineLabel}
      />

      {/* 04 · Event introduction + pillars */}
      <EventIntro
        description={data.hero.description}
        organizerName={data.hero.organizerName}
      />

      {/* 05 · 2026 event facts */}
      <EventStats stats={data.stats} />

      {/* 06 · CTF and Innovation Symposium */}
      <ModuleGrid events={data.events} />

      {/* 13 · Speakers — honest placeholder until confirmed */}
      <SpeakersPreview speakers={data.speakers} />

      {/* 14 · Schedule preview — timetable or day overview */}
      <SchedulePreview schedule={data.schedule} events={data.events} />

      {/* 15 · Sponsors — confirmed partners or tier prospectus */}
      <SponsorsSection sponsors={data.sponsors} />

      {/* 16 · Partner organisations */}
      <PartnersSection partners={data.partners} />

      {/* 17 · Gallery preview */}
      <GalleryPreview images={data.gallery} />

      {/* 19 · Venue + map */}
      <VenueSection
        name={data.venue.name}
        address={data.venue.address}
        mapEmbedUrl={data.venue.mapEmbedUrl}
      />

      {/* 20 · FAQ preview */}
      <FaqPreview faqs={data.faqs} />

      {/* 21 · Final registration CTA */}
      <FinalCta
        countdownTarget={data.hero.countdownTarget}
        registrationOpen={data.hero.registrationOpen}
      />
    </>
  )
}
