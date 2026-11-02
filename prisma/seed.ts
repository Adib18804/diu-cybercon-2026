// =============================================================================
// DIU_CYBERCON 2026 — Database Seed Script
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
        "DIU_CYBERCON CTF is a team-based Capture The Flag competition. The online preliminary round is free; qualifying teams compete in the on-site final on 12 December 2026. The final registration fee is 1200 BDT per team of up to four members.",
      status: EventStatus.OPEN,
      registrationOpen: true,
      registrationDeadline: new Date("2026-12-10T23:59:59Z"),
      isTeamEvent: true,
      minTeamSize: 2,
      maxTeamSize: 4,
      eventDay: 3,
      startDate: new Date("2026-12-12T09:00:00+06:00"),
      endDate: new Date("2026-12-12T18:00:00+06:00"),
      registrationFee: 1200,
      venue: "Library Zone",
      prizes: "Tote bag\nID card\nT-shirt\nstickers\npen\npad\nkey ring\nlunch",
      rules: "CTF Preliminary: Free. CTF Final: 1200 BDT per team (4 members). Venue: Library Zone. Maximum team size is 4 members.",
      displayOrder: 1,
      iconName: "terminal",
      accentColor: "#E11D48",
    },
    {
      type: EventType.INNOVATION_SYMPOSIUM,
      name: "Innovation Symposium",
      slug: "innovation-symposium",
      shortDescription:
        "Present a cybersecurity project or research idea to industry professionals and academic judges.",
      fullDescription:
        "The Innovation Symposium brings together cybersecurity projects and research presentations in one event. Teams of up to three participants submit an idea summary and select a symposium domain for review. Registration is 300 BDT per person.",
      status: EventStatus.OPEN,
      registrationOpen: true,
      registrationDeadline: new Date("2026-11-10T23:59:59Z"),
      isTeamEvent: true,
      minTeamSize: 1,
      maxTeamSize: 3,
      eventDay: 2,
      startDate: new Date("2026-12-12T09:00:00+06:00"),
      endDate: new Date("2026-12-12T17:00:00+06:00"),
      registrationFee: 300,
      venue: "Student Lounge",
      prizes: "T-shirt\nlunch\nPad\nPen\nID",
      rules: "Innovation Symposium: 300 BDT per person (Max 3 members). Venue: Student Lounge.",
      displayOrder: 2,
      iconName: "lightbulb",
      accentColor: "#BE123C",
    },
    {
      type: EventType.PANEL_DISCUSSION,
      name: "Panel Discussion",
      slug: "panel",
      shortDescription:
        "An expert panel discussion on cutting-edge cybersecurity topics. Open for attendance registration.",
      fullDescription:
        "The Panel Discussion brings together cybersecurity experts, industry leaders, and academic researchers. Entry is free; registration is required to reserve a seat.",
      status: EventStatus.OPEN,
      registrationOpen: true,
      registrationFee: 0,
      isTeamEvent: false,
      eventDay: 3,
      startDate: new Date("2026-12-12T10:00:00+06:00"),
      endDate: new Date("2026-12-12T12:00:00+06:00"),
      venue: "Shadinota Shommelon Kendro",
      rules: "Panel Discussion: Free entry. Venue: Shadinota Shommelon Kendro.",
      displayOrder: 3,
      iconName: "users",
      accentColor: "#9F1239",
    },
    {
      type: EventType.HANDS_ON,
      name: "Workshops",
      slug: "workshops",
      shortDescription:
        "Practical cybersecurity workshops led by industry professionals. Each workshop costs 300 BDT per person and has limited seats.",
      fullDescription:
        "Join focused, practical cybersecurity workshops led by experienced professionals. Each workshop costs 300 BDT per person and has limited seats.",
      status: EventStatus.OPEN,
      registrationOpen: true,
      registrationFee: 300,
      isTeamEvent: false,
      eventDay: 2,
      startDate: new Date("2026-12-12T09:00:00+06:00"),
      endDate: new Date("2026-12-12T17:00:00+06:00"),
      venue: "International Conference Hall (ICH)",
      rules: "Workshop: 300 BDT per person. Venue: ICH.",
      prizes: "T-shirt\nlunch\nPad\nPen\nID",
      displayOrder: 4,
      iconName: "wrench",
      accentColor: "#881337",
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

  await prisma.workshop.updateMany({
    data: {
      date: new Date("2026-12-12T09:00:00+06:00"),
      registrationDeadline: new Date("2026-12-11T23:59:59+06:00"),
      venue: "International Conference Hall (ICH)",
    },
  })

  // Remove the retired Trace & Route listing when there are no historical
  // registrations. Keep it hidden if registrations reference it, preserving
  // participant, team, check-in, and audit history.
  const retiredTrace = await prisma.event.findUnique({
    where: { type: EventType.TRACE_ROUTE },
    select: { id: true, _count: { select: { registrations: true, teams: true } } },
  })
  let traceRemoved = 0
  if (retiredTrace && retiredTrace._count.registrations === 0 && retiredTrace._count.teams === 0) {
    await prisma.event.delete({ where: { id: retiredTrace.id } })
    traceRemoved = 1
  } else if (retiredTrace) {
    await prisma.event.update({
      where: { id: retiredTrace.id },
      data: { status: EventStatus.DRAFT, registrationOpen: false },
    })
  }
  const retired = await prisma.event.updateMany({
    where: {
      type: {
        in: [
          EventType.PROJECT_SHOWCASE,
          EventType.POSTER_PRESENTATION,
        ],
      },
    },
    data: { status: EventStatus.DRAFT, registrationOpen: false },
  })

  console.log(
    `  ↳ Events: ${created} created, ${updated} updated, ${traceRemoved} Trace & Route events removed, ${retired.count} other legacy events archived`,
  )
}

async function seedSiteSettings() {
  const settings = [
    // Hero
    { key: "hero.title", value: "DIU_CYBERCON 2026", type: "string", description: "Hero section main title", group: "hero" },
    { key: "hero.tagline", value: "LEARN · SECURE · DEFEND", type: "string", description: "Hero tagline", group: "hero" },
    { key: "hero.description", value: "Join the CTF, present at the Innovation Symposium, or take part in a hands-on workshop on 12 December 2026 at Daffodil International University.", type: "string", description: "Hero description text", group: "hero" },

    // Event dates
    { key: "event.day1.date", value: "2026-10-24", type: "string", description: "Day 1 date (online CTF prelim)", group: "dates" },
    { key: "event.day2.date", value: "2026-12-12", type: "string", description: "On-site event date", group: "dates" },
    { key: "event.day3.date", value: "2026-12-12", type: "string", description: "On-site event date", group: "dates" },
    { key: "event.countdown.target", value: "2026-12-12T09:00:00+06:00", type: "string", description: "Countdown timer target datetime (ISO 8601)", group: "dates" },

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
    { key: "registration.ctf.maxTeamSize", value: "4", type: "number", description: "CTF maximum team size (hard cap)", group: "registration" },
    { key: "registration.symposium.maxTeamSize", value: "3", type: "number", description: "Innovation Symposium maximum team size", group: "registration" },

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
    { key: "seo.title", value: "DIU_CYBERCON 2026 — Bangladesh's National Cybersecurity Conference", type: "string", description: "Default SEO title", group: "seo" },
    { key: "seo.description", value: "DIU_CYBERCON 2026 features CTF, Innovation Symposium, workshops, and Panel Discussion on 12 December 2026.", type: "string", description: "Default SEO meta description", group: "seo" },

    // Maintenance
    { key: "payment.bkashNumber", value: "", type: "string", description: "Official bKash merchant/payment number shown to participants", group: "payments" },
    { key: "site.maintenanceMode", value: "false", type: "boolean", description: "Enable maintenance mode", group: "system" },
    { key: "site.announcementBarText", value: "Registration is now open for DIU_CYBERCON 2026! CTF preliminaries: 24 October. On-site program: 12 December at Daffodil Smart City.", type: "string", description: "Announcement bar scrolling text", group: "system" },
    { key: "site.announcementBarVisible", value: "true", type: "boolean", description: "Show announcement bar", group: "system" },
  ]

  await prisma.siteSetting.deleteMany({
    where: {
      key: {
        in: ["registration.project.maxTeamSize", "registration.poster.maxTeamSize"],
      },
    },
  })

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
      question: "Who can participate in DIU_CYBERCON 2026?",
      answer: "DIU_CYBERCON 2026 is open to university and college students, cybersecurity enthusiasts, ethical hackers, security researchers, and industry professionals from across Bangladesh.",
      category: "general",
      displayOrder: 1,
    },
    {
      question: "Is participation free?",
      answer: "The CTF preliminary round and Panel Discussion are free. CTF finals cost 1200 BDT per team; Innovation Symposium and workshops cost 300 BDT per person.",
      category: "general",
      displayOrder: 2,
    },
    {
      question: "How many members can a CTF team have?",
      answer: "CTF teams can have up to 4 members. The online preliminary round is free; the final costs 1200 BDT per team.",
      category: "ctf",
      displayOrder: 3,
    },
    {
      question: "Can I participate in multiple events?",
      answer: "Yes, you can register for multiple events. Each event requires a separate registration.",
      category: "general",
      displayOrder: 4,
    },
    {
      question: "What is the CTF format?",
      answer: "The CTF has a free online preliminary round and an on-site final on 12 December 2026 at the Library Zone. The final costs 1200 BDT per team of up to four members.",
      category: "ctf",
      displayOrder: 5,
    },
    {
      question: "What documents do I need to register?",
      answer: "All participants must upload a valid Student ID card image or equivalent student proof during registration. Accepted formats are JPG, JPEG, PNG, and WebP. Maximum file size is 5MB. Professional participants should upload relevant proof of professional status.",
      category: "registration",
      displayOrder: 7,
    },
    {
      question: "Where is the venue?",
      answer: "On 12 December 2026, the CTF is at the Library Zone, the Innovation Symposium is in the Student Lounge, Panel Discussion is at Shadinota Shommelon Kendro, and workshops are in the International Conference Hall (ICH). The CTF preliminary round is online.",
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
      question: "What is the Innovation Symposium?",
      answer: "The Innovation Symposium costs 300 BDT per person. Teams of up to three submit an idea summary and select a symposium domain during registration. It is held in the Student Lounge on 12 December 2026.",
      category: "symposium",
      displayOrder: 6,
    },
    {
      question: "How do I become a sponsor?",
      answer: "Visit the Sponsors page and click 'Become a Sponsor'. Fill out the application form with your organization details and preferred sponsorship tier. Our team will contact you to discuss the arrangement. All sponsorships are subject to organizer approval.",
      category: "sponsorship",
      displayOrder: 7,
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
  console.log("║     DIU_CYBERCON 2026 — Database Seed           ║")
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
