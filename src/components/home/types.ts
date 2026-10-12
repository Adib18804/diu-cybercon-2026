// =============================================================================
// Homepage — shared prop types
// =============================================================================
// Serializable shapes passed from the server page into section components.
// Dates are ISO strings so everything survives the RSC boundary.
// =============================================================================

export interface HomeEvent {
  id: string
  type: string
  slug: string
  name: string
  shortDescription: string
  fullDescription: string
  registrationOpen: boolean
  registrationDeadline: string | null
  participantLimit: number | null
  isTeamEvent: boolean
  minTeamSize: number | null
  maxTeamSize: number | null
  eventDay: number | null
  startDate: string | null
  endDate: string | null
  venue: string | null
  prizes: string | null
  rules: string | null
  eligibility: string | null
  iconName: string | null
  accentColor: string | null
}

export interface HomeFaq {
  id: string
  question: string
  answer: string
  category: string
}

export interface HomeSpeaker {
  id: string
  name: string
  title: string
  organization: string
  bio: string | null
  expertise: string[]
  photoKey: string | null
  linkedinUrl: string | null
}

export interface HomeScheduleItem {
  id: string
  day: number
  startTime: string
  endTime: string
  title: string
  description: string | null
  venue: string | null
  type: string
  isHighlight: boolean
}

export interface HomeSponsor {
  id: string
  name: string
  tier: string
  logoKey: string
  websiteUrl: string | null
  description: string | null
}

export interface HomePartner {
  id: string
  name: string
  category: string
  logoKey: string | null
  websiteUrl: string | null
}

export interface HomeGalleryImage {
  id: string
  title: string | null
  publicUrl: string | null
  altText: string
  category: string
}

export interface HomeStats {
  moduleCount: number
  dayCount: number
  teams2025: number | null
  universities2025: number | null
  colleges2025: number | null
  schools2025: number | null
  professionals2025: number | null
}
