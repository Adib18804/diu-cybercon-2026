# DIU CyberCon 2026

**LEARN · SECURE · DEFEND**

Official platform for DIU CyberCon 2026 — Bangladesh's flagship national cybersecurity conference, competition, and talent platform. Hosted by the Cyber Security Club, Department of CSE, Daffodil International University.

**Event Dates**
- Day 01 · 24 October 2026 · Online — CTF Preliminary Round
- Day 02 · 14 November 2026 · On-site — Project Showcase · Poster Presentation · Trace & Route · Workshops
- Day 03 · 15 November 2026 · On-site — CTF Finals · Panel Discussion · Prize Giving · Closing Ceremony

**Venue:** Daffodil Smart City (DSC), Birulia, Savar, Dhaka-1216, Bangladesh

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 3.4 + custom design tokens |
| Animation | Framer Motion |
| Database | PostgreSQL 16 + Prisma ORM |
| Auth | NextAuth.js v5 (Auth.js) |
| Validation | Zod (shared client + server) |
| Forms | React Hook Form |
| Email | Resend |
| Storage | Cloudinary |
| Rate Limiting | rate-limiter-flexible + Redis |
| Deployment | Vercel + Supabase/Neon |

---

## Prerequisites

- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **Docker Desktop** (for local PostgreSQL + Redis)
- Accounts: [Resend](https://resend.com), [Cloudinary](https://cloudinary.com)

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/your-org/diucybercon-2026.git
cd diucybercon-2026
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

| Variable | Where to get it |
|---|---|
| `AUTH_SECRET` | Run: `openssl rand -base64 32` |
| `QR_SIGNING_SECRET` | Run: `openssl rand -base64 32` |
| `RESEND_API_KEY` | [resend.com](https://resend.com) → API Keys |
| `CLOUDINARY_CLOUD_NAME` | [cloudinary.com](https://cloudinary.com) → Dashboard |
| `CLOUDINARY_API_KEY` | Cloudinary → Settings → Access Keys |
| `CLOUDINARY_API_SECRET` | Cloudinary → Settings → Access Keys |

All other values match the Docker Compose defaults and work out of the box.

### 3. Start local services

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 16** on `localhost:5432`
- **Redis 7** on `localhost:6379`

Verify services are healthy:

```bash
docker compose ps
```

To also start pgAdmin (DB GUI at `http://localhost:5050`):

```bash
docker compose --profile tools up -d
```

pgAdmin login: `admin@cybercon.dev` / `pgadmin_dev`

### 4. Run database migrations

```bash
npm run prisma:migrate
```

This creates all tables, indexes, and constraints from `prisma/schema.prisma`.

### 5. Seed the database

```bash
npm run prisma:seed
```

This creates:
- Super admin account (`admin@diucybercon.com` / `ChangeMe@2026!`)
- 31 Bangladeshi universities
- All 6 event modules
- 30+ site settings
- 12 FAQ items

> **Important:** Change the admin password immediately after first login.

### 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Admin panel: [http://localhost:3000/admin](http://localhost:3000/admin)

---

## Development Commands

```bash
# Development server
npm run dev

# Type checking (no emit)
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check

# Prisma
npm run prisma:generate     # Regenerate Prisma client
npm run prisma:migrate      # Run migrations (dev)
npm run prisma:migrate:prod # Deploy migrations (production)
npm run prisma:studio       # Open Prisma Studio GUI
npm run prisma:seed         # Seed the database
npm run prisma:reset        # Reset DB and reseed (WARNING: destroys data)

# Build
npm run build
npm run start

# Bundle analysis
npm run analyze
```

---

## Project Structure

```
diucybercon-2026/
├── prisma/
│   ├── schema.prisma          # Full DB schema
│   └── seed.ts                # Seed script
│
├── docker/
│   ├── postgres/init.sql      # DB extensions + read-only user
│   ├── pgadmin/servers.json   # pgAdmin auto-connect
│   └── redis/redis.conf       # Redis config
│
├── public/
│   ├── robots.txt
│   ├── site.webmanifest
│   └── icons/                 # Favicon + app icons (add manually)
│
└── src/
    ├── app/                   # Next.js App Router
    │   ├── layout.tsx         # Root layout (fonts, metadata, Toaster)
    │   ├── globals.css        # Design system CSS + Tailwind directives
    │   ├── page.tsx           # Homepage (placeholder — Phase 11)
    │   ├── error.tsx          # Global error boundary (500)
    │   ├── not-found.tsx      # 404 page
    │   └── sitemap.ts         # Auto-generated sitemap
    │
    ├── lib/
    │   ├── db.ts              # Prisma client singleton
    │   ├── constants.ts       # All app constants
    │   ├── utils.ts           # Pure utility functions
    │   ├── audit.ts           # Audit log helper
    │   └── security/
    │       ├── rate-limit.ts  # Redis/memory rate limiter
    │       ├── file-validation.ts  # MIME + magic byte validation
    │       └── qr.ts          # QR token sign/verify
    │
    ├── types/
    │   ├── index.ts           # Shared TypeScript types
    │   ├── api.ts             # API request/response shapes
    │   └── next-auth.d.ts     # Session type augmentation
    │
    └── middleware.ts          # Auth guard + CORS + security headers
```

---

## Environment Variables Reference

See `.env.example` for the full annotated list. Key variables:

```bash
# App
NEXT_PUBLIC_APP_URL          # Your domain (http://localhost:3000 in dev)

# Database
DATABASE_URL                 # PostgreSQL connection string
DIRECT_DATABASE_URL          # Direct connection (bypasses pooler)

# Auth
AUTH_SECRET                  # Min 32 chars — generate with openssl rand -base64 32

# Email
RESEND_API_KEY               # From resend.com
EMAIL_FROM                   # Sender address (must be verified in Resend)

# Cloudinary
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET

# Security
QR_SIGNING_SECRET            # Min 32 chars — generate with openssl rand -base64 32
REDIS_URL                    # Optional — uses in-memory if empty

# CORS
ALLOWED_ORIGINS              # Comma-separated, e.g. https://diucybercon.com
```

---

## Database

### Schema overview

The schema covers 25+ entities including:

- `User` + `Account` + `Session` (NextAuth-compatible)
- `ParticipantProfile` + `University`
- `Event` (6 modules) + `EventRegistration` + `Team` + `TeamMember`
- `StudentVerification` + `VerificationAccessLog`
- `Project` + `Poster` (submission + review workflow)
- `Workshop` + `WorkshopRegistration`
- `Speaker` + `Panel` + `Panelist`
- `ScheduleItem`
- `Sponsor` + `SponsorApplication` + `Partner`
- `Announcement` + `GalleryImage` + `FAQ` + `ContactMessage`
- `SiteSetting` (admin-editable, no code changes required)
- `AuditLog` (immutable, append-only)

### Key constraints enforced at DB level

```sql
UNIQUE: User.email
UNIQUE: ParticipantProfile.studentId
UNIQUE: EventRegistration.registrationId
UNIQUE: (EventRegistration.eventId, EventRegistration.userId)
UNIQUE: (Team.name, Team.eventId)
UNIQUE: (TeamMember.teamId, TeamMember.profileId)
UNIQUE: (WorkshopRegistration.workshopId, WorkshopRegistration.userId)
```

### Useful Prisma Studio

```bash
npm run prisma:studio
# Opens at http://localhost:5555
```

---

## Security

This platform is built for a **cybersecurity** event — security is first-class.

| Layer | Implementation |
|---|---|
| Passwords | argon2id (cost 12+) |
| Sessions | httpOnly + Secure + SameSite=Strict cookies |
| Auth | Email verification required |
| RBAC | Server-side on every route + handler |
| Input | Zod schemas, server validates independently |
| Files | Extension + MIME + magic byte + size + Sharp re-encode |
| Student IDs | Private storage, signed URLs (TTL ≤ 5 min), access logged |
| Rate Limiting | Global + per-route (Redis or in-memory) |
| CORS | Explicit allowlist — never wildcard |
| Headers | CSP · HSTS · X-Frame-Options · X-Content-Type-Options |
| Audit | Every sensitive action → AuditLog (immutable) |
| QR Codes | Signed JWT containing only registrationId |

**Student ID files are stored in a private Cloudinary folder and served only via signed URLs with a 5-minute TTL. Every view is logged.**

---

## Admin Access

| URL | Description |
|---|---|
| `/admin` | Dashboard + stats |
| `/admin/verifications` | Student ID queue |
| `/admin/participants` | All participants |
| `/admin/teams` | Team management |
| `/admin/check-in` | QR scanner + check-in |
| `/admin/settings` | Site-wide settings |
| `/admin/audit-logs` | Audit trail |

### Admin roles

| Role | Access |
|---|---|
| `SUPER_ADMIN` | Everything |
| `EVENT_ADMIN` | Events, schedule, speakers, panels, workshops |
| `REGISTRATION_ADMIN` | Participants, teams, registrations, check-in |
| `CONTENT_ADMIN` | Announcements, gallery, FAQ |
| `SPONSORSHIP_ADMIN` | Sponsors, applications, partners |
| `VERIFICATION_ADMIN` | Student ID verification queue only |

Roles are assigned by `SUPER_ADMIN` only via `/admin/roles`.

---

## Build Phases

This project is delivered in 20 phases. Current status:

| Phase | Name | Status |
|---|---|---|
| **01** | Project Scaffolding | ✅ Complete |
| 02 | Design System | Pending |
| 03 | Database Schema | ✅ Complete (in Phase 01) |
| 04 | Backend — Auth | Pending |
| 05 | Backend — Public APIs | Pending |
| 06 | Backend — Registration | Pending |
| 07 | Backend — Submissions | Pending |
| 08 | Backend — Admin APIs | Pending |
| 09 | Backend — Check-in | Pending |
| 10 | Frontend — App Shell | Pending |
| 11 | Frontend — Homepage | Pending |
| 12 | Frontend — Event Pages | Pending |
| 13 | Frontend — Registration Wizard | Pending |
| 14 | Frontend — Participant Dashboard | Pending |
| 15 | Frontend — Admin Dashboard | Pending |
| 16 | Email System | Pending |
| 17 | Security Hardening | Pending |
| 18 | Accessibility + SEO | Pending |
| 19 | Performance | Pending |
| 20 | Deployment | Pending |

---

## Deployment (Production)

### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Set all environment variables from `.env.example` in Vercel dashboard under **Settings → Environment Variables**.

### Database (Supabase / Neon)

1. Create a PostgreSQL database
2. Copy the connection strings to `DATABASE_URL` and `DIRECT_DATABASE_URL`
3. Run migrations: `npm run prisma:migrate:prod`
4. Run seed: `npm run prisma:seed`

### Cloudinary setup

1. Create a Cloudinary account
2. Create two folders:
   - `cybercon2026/private/student-ids` — set access to **private**
   - `cybercon2026/public` — set access to **public**
3. Copy cloud name, API key, and secret to environment variables

### Domain + SSL

Point `diucybercon.com` to Vercel. SSL is handled automatically.
Update `NEXT_PUBLIC_APP_URL` and `ALLOWED_ORIGINS` to the production domain.

---

## Performance Targets

| Metric | Target |
|---|---|
| Lighthouse Performance | ≥ 90 |
| Lighthouse Accessibility | ≥ 95 |
| Lighthouse SEO | ≥ 95 |
| LCP | < 2.5s |
| INP | < 200ms |
| CLS | < 0.1 |
| Bundle (gzipped) | < 500KB |

---

## License

Private — Cyber Security Club, Department of CSE, Daffodil International University. All rights reserved.

---

*Built with purpose. Every byte secured. Every student protected.*
