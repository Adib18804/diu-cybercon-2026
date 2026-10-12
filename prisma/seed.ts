// =============================================================================
// DIU CyberCon 2026 — Database Seed Script
// Run: npm run prisma:seed
// =============================================================================

import { PrismaClient, EventType, EventStatus, AdminRole, UserRole, InstitutionType } from "@prisma/client"
import argon2 from "argon2"

const prisma = new PrismaClient()

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  })
}

// ─── Seed Functions ───────────────────────────────────────────────────────────

async function seedAdminUser() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@diucybercon.com"
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe@2026!"
  const name = process.env.SEED_ADMIN_NAME ?? "Super Admin"

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`  ↳ Admin user already exists: ${email}`)
    return existing
  }

  const passwordHash = await hashPassword(password)

  const admin = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: UserRole.ADMIN,
      adminRole: AdminRole.SUPER_ADMIN,
      emailVerified: new Date(),
    },
  })

  console.log(`  ↳ Super admin created: ${email}`)
  console.log(`  ↳ IMPORTANT: Change this password immediately after first login!`)
  return admin
}

async function seedUniversities() {
  const universities = [
    // Dhaka
    { name: "Daffodil International University", shortName: "DIU", type: InstitutionType.UNIVERSITY },
    { name: "University of Dhaka", shortName: "DU", type: InstitutionType.UNIVERSITY },
    { name: "Bangladesh University of Engineering and Technology", shortName: "BUET", type: InstitutionType.UNIVERSITY },
    { name: "North South University", shortName: "NSU", type: InstitutionType.UNIVERSITY },
    { name: "BRAC University", shortName: "BRACU", type: InstitutionType.UNIVERSITY },
    { name: "Independent University Bangladesh", shortName: "IUB", type: InstitutionType.UNIVERSITY },
    { name: "American International University-Bangladesh", shortName: "AIUB", type: InstitutionType.UNIVERSITY },
    { name: "East West University", shortName: "EWU", type: InstitutionType.UNIVERSITY },
    { name: "United International University", shortName: "UIU", type: InstitutionType.UNIVERSITY },
    { name: "Southeast University", shortName: "SEU", type: InstitutionType.UNIVERSITY },
    { name: "Bangladesh University", shortName: "BU", type: InstitutionType.UNIVERSITY },
    { name: "Metropolitan University", shortName: "MU", type: InstitutionType.UNIVERSITY },
    { name: "Green University of Bangladesh", shortName: "GUB", type: InstitutionType.UNIVERSITY },
    { name: "University of Liberal Arts Bangladesh", shortName: "ULAB", type: InstitutionType.UNIVERSITY },
    { name: "Stamford University Bangladesh", shortName: "SUB", type: InstitutionType.UNIVERSITY },
    { name: "Notre Dame College", shortName: "NDC", type: InstitutionType.COLLEGE },
    // Chittagong
    { name: "Chittagong University of Engineering and Technology", shortName: "CUET", type: InstitutionType.UNIVERSITY },
    { name: "University of Chittagong", shortName: "CU", type: InstitutionType.UNIVERSITY },
    { name: "International Islamic University Chittagong", shortName: "IIUC", type: InstitutionType.UNIVERSITY },
    { name: "Port City International University", shortName: "PCIU", type: InstitutionType.UNIVERSITY },
    // Rajshahi
    { name: "Rajshahi University of Engineering and Technology", shortName: "RUET", type: InstitutionType.UNIVERSITY },
    { name: "University of Rajshahi", shortName: "RU", type: InstitutionType.UNIVERSITY },
    // Sylhet
    { name: "Shahjalal University of Science and Technology", shortName: "SUST", type: InstitutionType.UNIVERSITY },
    { name: "Sylhet Agricultural University", shortName: "SAU", type: InstitutionType.UNIVERSITY },
    // Khulna
    { name: "Khulna University of Engineering and Technology", shortName: "KUET", type: InstitutionType.UNIVERSITY },
    { name: "Khulna University", shortName: "KU", type: InstitutionType.UNIVERSITY },
    // Other
    { name: "Jahangirnagar University", shortName: "JU", type: InstitutionType.UNIVERSITY },
    { name: "Jagannath University", shortName: "JnU", type: InstitutionType.UNIVERSITY },
    { name: "Military Institute of Science and Technology", shortName: "MIST", type: InstitutionType.UNIVERSITY },
    { name: "Bangladesh Army University of Engineering and Technology", shortName: "BAUET", type: InstitutionType.UNIVERSITY },
    // Professionals
    { name: "Industry / Professional", shortName: "PRO", type: InstitutionType.PROFESSIONAL },
    { name: "Other Institution", shortName: "OTHER", type: InstitutionType.OTHER },
  ]

  let created = 0
  for (const uni of universities) {
    await prisma.university.upsert({
      where: { name: uni.name },
      update: {},
      create: uni,
    })
    created++
  }

  console.log(`  ↳ ${created} universities upserted`)
}

async function seedEvents() {
  const events = [
    {
      type: EventType.CTF,
      name: "Capture The Flag",
      slug: "ctf",
      shortDescription:
        "Test your hacking skills across 8 domains — Web, Crypto, Forensics, Reverse Engineering, Pwn, OSINT, Network, and Misc.",
      fullDescription:
        "DIU CyberCon CTF is a team-based Capture The Flag competition designed for university and college students passionate about cybersecurity. Compete in online preliminary rounds before qualifying for the on-site finals. Solve challenges across Web Security & Exploitation, Cryptography, Digital Forensics, Reverse Engineering, Binary Exploitation/Pwn, OSINT, Network Security, and Miscellaneous domains.\n\nThe online preliminary round determines which teams advance to the on-site final round at Daffodil Smart City.",
      status: EventStatus.OPEN,
      registrationOpen: true,
      registrationDeadline: new Date("2026-10-20T23:59:59Z"),
      isTeamEvent: true,
      minTeamSize: 2,
      maxTeamSize: 5,
      eventDay: 1,
      startDate: new Date("2026-10-24T00:00:00Z"),
      endDate: new Date("2026-11-15T23:59:59Z"),
      venue: "Online (Prelim) → Daffodil Smart City (Finals)",
      displayOrder: 1,
      iconName: "terminal",
      accentColor: "#00e5ff",
    },
    {
      type: EventType.TRACE_ROUTE,
      name: "Trace & Route",
      slug: "trace-route",
      shortDescription:
        "A solo networking contest covering routing, packet tracing, and network security in a professional environment.",
      fullDescription:
        "Trace & Route is a solo networking competition that challenges participants on their knowledge of network routing, packet analysis, network troubleshooting, and network security. Participants work through scenarios involving real network topologies, trace packets, configure routing protocols, and identify network vulnerabilities.\n\nThis is a professional-grade competition — not a gaming experience. Participants are expected to demonstrate practical, real-world networking skills.",
      status: EventStatus.OPEN,
      registrationOpen: true,
      registrationDeadline: new Date("2026-11-10T23:59:59Z"),
      isTeamEvent: false,
      eventDay: 2,
      startDate: new Date("2026-11-14T09:00:00Z"),
      endDate: new Date("2026-11-14T17:00:00Z"),
      venue: "Daffodil Smart City, Birulia, Savar",
      displayOrder: 2,
      iconName: "network",
      accentColor: "#39ff14",
    },
    {
      type: EventType.PROJECT_SHOWCASE,
      name: "Project Showcasing",
      slug: "project-showcase",
      shortDescription:
        "Present your cybersecurity project to industry experts and academic judges. Top projects are published in the public showcase.",
      fullDescription:
        "The Project Showcasing event provides students and researchers an opportunity to present cybersecurity-focused projects to a panel of industry professionals and academic judges. Teams submit their projects for review — approved submissions are published in the public DIU CyberCon Project Showcase.\n\nSubmission workflow: Submit → Under Review → Approved / Rejected / Revision Required → Published.",
      status: EventStatus.OPEN,
      registrationOpen: true,
      registrationDeadline: new Date("2026-11-10T23:59:59Z"),
      isTeamEvent: true,
      minTeamSize: 1,
      maxTeamSize: 5,
      eventDay: 2,
      startDate: new Date("2026-11-14T09:00:00Z"),
      endDate: new Date("2026-11-14T17:00:00Z"),
      venue: "Daffodil Smart City, Birulia, Savar",
      displayOrder: 3,
      iconName: "folder-open",
      accentColor: "#7c3aed",
    },
    {
      type: EventType.POSTER_PRESENTATION,
      name: "Poster Presentation",
      slug: "poster",
      shortDescription:
        "Present your cybersecurity research through a poster. Approved posters are displayed and published publicly.",
      fullDescription:
        "The Poster Presentation event showcases cybersecurity research through academic-style poster presentations. Teams design and submit a research poster covering their topic, methodology, findings, and conclusions. Approved posters are displayed at the event venue and published in the online gallery.\n\nSubmission workflow: Submit → Under Review → Approved / Rejected / Revision Required → Published.",
      status: EventStatus.OPEN,
      registrationOpen: true,
      registrationDeadline: new Date("2026-11-10T23:59:59Z"),
      isTeamEvent: true,
      minTeamSize: 1,
      maxTeamSize: 4,
      eventDay: 2,
      startDate: new Date("2026-11-14T09:00:00Z"),
      endDate: new Date("2026-11-14T17:00:00Z"),
      venue: "Daffodil Smart City, Birulia, Savar",
      displayOrder: 4,
      iconName: "image",
      accentColor: "#ff2e88",
    },
    {
      type: EventType.PANEL_DISCUSSION,
      name: "Panel Discussion",
      slug: "panel",
      shortDescription:
        "An expert panel discussion on cutting-edge cybersecurity topics. Open for attendance registration.",
      fullDescription:
        "The Panel Discussion brings together cybersecurity experts, industry leaders, and academic researchers to discuss critical topics shaping the future of digital security in Bangladesh and beyond. Topics, moderator, and panelists will be announced as confirmations are received.\n\nOpen for attendance — register to reserve your seat.",
      status: EventStatus.DRAFT,
      registrationOpen: false,
      isTeamEvent: false,
      eventDay: 3,
      startDate: new Date("2026-11-15T10:00:00Z"),
      endDate: new Date("2026-11-15T12:00:00Z"),
      venue: "Daffodil Smart City, Birulia, Savar",
      displayOrder: 5,
      iconName: "users",
      accentColor: "#ffb020",
    },
    {
      type: EventType.HANDS_ON,
      name: "Hands-on Activities",
      slug: "workshops",
      shortDescription:
        "Practical cybersecurity workshops led by industry professionals. Limited seats per activity — register early.",
      fullDescription:
        "The Hands-on Activities program offers focused, practical workshops led by experienced cybersecurity professionals. Each activity covers a specific skill or tool and is designed for different experience levels — from beginner to advanced.\n\nSeats are strictly limited. Each activity has its own registration deadline and capacity. Activities will be announced and opened for registration as confirmations are received.",
      status: EventStatus.DRAFT,
      registrationOpen: false,
      isTeamEvent: false,
      eventDay: 2,
      startDate: new Date("2026-11-14T09:00:00Z"),
      endDate: new Date("2026-11-14T17:00:00Z"),
      venue: "Daffodil Smart City, Birulia, Savar",
      displayOrder: 6,
      iconName: "wrench",
      accentColor: "#7c3aed",
    },
  ]

  let created = 0
  let updated = 0
  for (const event of events) {
    const existing = await prisma.event.findUnique({ where: { type: event.type } })
    if (existing) {
      await prisma.event.update({ where: { type: event.type }, data: event })
      updated++
    } else {
      await prisma.event.create({ data: event })
      created++
    }
  }

  console.log(`  ↳ Events: ${created} created, ${updated} updated`)
}

async function seedSiteSettings() {
  const settings = [
    // Hero
    { key: "hero.title", value: "DIU CyberCon 2026", type: "string", description: "Hero section main title", group: "hero" },
    { key: "hero.tagline", value: "LEARN · SECURE · DEFEND", type: "string", description: "Hero tagline", group: "hero" },
    { key: "hero.description", value: "Bangladesh's flagship national cybersecurity conference, competition, and talent platform. Hosted by the Cyber Security Club, Department of CSE, Daffodil International University.", type: "string", description: "Hero description text", group: "hero" },

    // Event dates
    { key: "event.day1.date", value: "2026-10-24", type: "string", description: "Day 1 date (online CTF prelim)", group: "dates" },
    { key: "event.day2.date", value: "2026-11-14", type: "string", description: "Day 2 date (on-site)", group: "dates" },
    { key: "event.day3.date", value: "2026-11-15", type: "string", description: "Day 3 date (on-site finals)", group: "dates" },
    { key: "event.countdown.target", value: "2026-11-14T09:00:00+06:00", type: "string", description: "Countdown timer target datetime (ISO 8601)", group: "dates" },

    // Venue
    { key: "venue.name", value: "Daffodil Smart City (DSC)", type: "string", description: "Venue name", group: "venue" },
    { key: "venue.address", value: "Birulia, Savar, Dhaka-1216, Bangladesh", type: "string", description: "Venue address", group: "venue" },
    { key: "venue.mapEmbedUrl", value: "", type: "string", description: "Google Maps embed URL", group: "venue" },
    { key: "venue.directions", value: "", type: "string", description: "Directions text (markdown supported)", group: "venue" },

    // Statistics (from 2025 — labeled as historical)
    { key: "stats.2025.teams", value: "212", type: "number", description: "CyberCon 2025: participating teams", group: "legacy" },
    { key: "stats.2025.universities", value: "53", type: "number", description: "CyberCon 2025: universities", group: "legacy" },
    { key: "stats.2025.colleges", value: "5", type: "number", description: "CyberCon 2025: colleges", group: "legacy" },
    { key: "stats.2025.schools", value: "3", type: "number", description: "CyberCon 2025: schools", group: "legacy" },
    { key: "stats.2025.professionals", value: "5", type: "number", description: "CyberCon 2025: professional orgs", group: "legacy" },

    // Registration
    { key: "registration.open", value: "true", type: "boolean", description: "Global registration toggle", group: "registration" },
    { key: "registration.ctf.maxTeamSize", value: "5", type: "number", description: "CTF maximum team size (hard cap)", group: "registration" },
    { key: "registration.project.maxTeamSize", value: "5", type: "number", description: "Project Showcase maximum team size", group: "registration" },
    { key: "registration.poster.maxTeamSize", value: "4", type: "number", description: "Poster Presentation maximum team size", group: "registration" },

    // Contact
    { key: "contact.email", value: "info@diucybercon.com", type: "string", description: "Main contact email", group: "contact" },
    { key: "contact.phone", value: "", type: "string", description: "Contact phone number", group: "contact" },
    { key: "contact.facebook", value: "", type: "string", description: "Facebook page URL", group: "contact" },
    { key: "contact.linkedin", value: "", type: "string", description: "LinkedIn page URL", group: "contact" },
    { key: "contact.twitter", value: "", type: "string", description: "Twitter/X handle URL", group: "contact" },
    { key: "contact.youtube", value: "", type: "string", description: "YouTube channel URL", group: "contact" },

    // Organizer
    { key: "organizer.name", value: "Cyber Security Club, Department of CSE, Daffodil International University", type: "string", description: "Organizer full name", group: "organizer" },
    { key: "organizer.shortName", value: "DIU CSC", type: "string", description: "Organizer short name", group: "organizer" },
    { key: "organizer.website", value: "https://diu.edu.bd", type: "string", description: "Organizer website", group: "organizer" },

    // SEO
    { key: "seo.title", value: "DIU CyberCon 2026 — Bangladesh's National Cybersecurity Conference", type: "string", description: "Default SEO title", group: "seo" },
    { key: "seo.description", value: "DIU CyberCon 2026 is Bangladesh's flagship national cybersecurity conference, competition, and talent platform. Join for CTF, Trace & Route, Project Showcase, Poster Presentation, Hands-on Activities, and Panel Discussion.", type: "string", description: "Default SEO meta description", group: "seo" },

    // Maintenance
    { key: "site.maintenanceMode", value: "false", type: "boolean", description: "Enable maintenance mode", group: "system" },
    { key: "site.announcementBarText", value: "Registration is now open for DIU CyberCon 2026! Join us on 24 Oct (Online) and 14–15 Nov (On-site) at Daffodil Smart City.", type: "string", description: "Announcement bar scrolling text", group: "system" },
    { key: "site.announcementBarVisible", value: "true", type: "boolean", description: "Show announcement bar", group: "system" },
  ]

  let upserted = 0
  for (const setting of settings) {
    await prisma.siteSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, type: setting.type, description: setting.description, group: setting.group },
      create: setting,
    })
    upserted++
  }

  console.log(`  ↳ ${upserted} site settings upserted`)
}

async function seedFAQ() {
  const faqs = [
    {
      question: "Who can participate in DIU CyberCon 2026?",
      answer: "DIU CyberCon 2026 is open to university students, college students, cybersecurity enthusiasts, ethical hackers, security researchers, and industry professionals from across Bangladesh. Each event module may have specific eligibility requirements.",
      category: "general",
      displayOrder: 1,
    },
    {
      question: "Is participation free?",
      answer: "Registration and participation details will be announced. Please check the official website and our social media channels for the latest updates on fees and registration.",
      category: "general",
      displayOrder: 2,
    },
    {
      question: "How many members can a CTF team have?",
      answer: "CTF teams must have a minimum of 2 members and a maximum of 5 members. One member must register as the Team Leader. All team members must complete individual registration including student ID verification.",
      category: "ctf",
      displayOrder: 3,
    },
    {
      question: "Can I participate in multiple events?",
      answer: "Yes, you can register for multiple event modules — for example, you can participate in CTF and also register for a Hands-on Activity workshop. Each event requires a separate registration.",
      category: "general",
      displayOrder: 4,
    },
    {
      question: "What is the CTF format?",
      answer: "The CTF has two rounds: an online preliminary round on 24 October 2026, and an on-site final round on 15 November 2026 at Daffodil Smart City. Teams that qualify in the preliminary round advance to the finals. The actual CTF challenges are hosted on an external platform.",
      category: "ctf",
      displayOrder: 5,
    },
    {
      question: "Is Trace & Route a solo or team event?",
      answer: "Trace & Route is a SOLO event. Each participant registers individually. This is a professional networking contest — not a team competition.",
      category: "trace-route",
      displayOrder: 6,
    },
    {
      question: "What documents do I need to register?",
      answer: "All participants must upload a valid Student ID card image or equivalent student proof during registration. Accepted formats are JPG, JPEG, PNG, and WebP. Maximum file size is 5MB. Professional participants should upload relevant proof of professional status.",
      category: "registration",
      displayOrder: 7,
    },
    {
      question: "Where is the venue?",
      answer: "The on-site events (Day 2 and Day 3) will be held at Daffodil Smart City (DSC), Birulia, Savar, Dhaka-1216, Bangladesh. The Day 1 CTF preliminary round is online.",
      category: "venue",
      displayOrder: 8,
    },
    {
      question: "How will I receive my registration confirmation?",
      answer: "After completing registration, you will receive a confirmation email with your unique Registration ID (e.g., CYB26-XXXXXX) and a QR code. You can also access your QR code and registration details from your participant dashboard.",
      category: "registration",
      displayOrder: 9,
    },
    {
      question: "Can I submit both a Project and a Poster?",
      answer: "Yes, if you are part of different teams for each submission, you may participate in both Project Showcasing and Poster Presentation. Each submission requires a separate team registration.",
      category: "submissions",
      displayOrder: 10,
    },
    {
      question: "How are project and poster submissions reviewed?",
      answer: "Submissions go through an admin review pipeline: Submitted → Under Review → Approved / Rejected / Revision Required. If approved, they are Published and visible in the public showcase. You will receive email notifications at each status change.",
      category: "submissions",
      displayOrder: 11,
    },
    {
      question: "How do I become a sponsor?",
      answer: "Visit the Sponsors page and click 'Become a Sponsor'. Fill out the application form with your organization details and preferred sponsorship tier. Our team will contact you to discuss the arrangement. All sponsorships are subject to organizer approval.",
      category: "sponsorship",
      displayOrder: 12,
    },
  ]

  // Clear existing FAQ and reseed
  await prisma.fAQ.deleteMany({})
  await prisma.fAQ.createMany({ data: faqs })
  console.log(`  ↳ ${faqs.length} FAQ items seeded`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════╗")
  console.log("║     DIU CyberCon 2026 — Database Seed           ║")
  console.log("╚══════════════════════════════════════════════════╝\n")

  console.log("▶ Seeding admin user...")
  await seedAdminUser()

  console.log("▶ Seeding universities...")
  await seedUniversities()

  console.log("▶ Seeding events...")
  await seedEvents()

  console.log("▶ Seeding site settings...")
  await seedSiteSettings()

  console.log("▶ Seeding FAQ...")
  await seedFAQ()

  console.log("\n✅ Seed complete.\n")
  console.log("┌─────────────────────────────────────────────────┐")
  console.log("│  Next steps:                                    │")
  console.log("│  1. Visit http://localhost:3000/admin           │")
  console.log("│  2. Login: admin@diucybercon.com                │")
  console.log("│  3. Password: ChangeMe@2026!                    │")
  console.log("│  4. CHANGE THE PASSWORD IMMEDIATELY             │")
  console.log("└─────────────────────────────────────────────────┘\n")
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error: unknown) => {
    console.error("Seed failed:", error)
    await prisma.$disconnect()
    process.exit(1)
  })
