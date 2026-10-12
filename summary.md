# DIU CyberCon 2026 — Website Summary

> Complete technical summary of the official DIU CyberCon 2026 website — Bangladesh's flagship national cybersecurity conference platform, built for Daffodil International University Cyber Security Club (Department of CSE).

---

## 1. What This Is

The official production website for **DIU CyberCon 2026** — a fully dynamic, database-driven, secure event platform covering the entire conference lifecycle: public marketing site, participant registration with document verification, team management, submission workflows, and a full role-based admin console.

**Event facts:**

| Item | Detail |
|---|---|
| Online CTF Prelims | October 24, 2026 |
| Onsite Main Event | November 14–15, 2026 |
| Venue | Daffodil Smart City (DSC), Birulia, Savar, Dhaka-1216 |
| Tagline | LEARN · SECURE · DEFEND |
| Domain | www.diucybercon.com |

**The 6 event modules:**

1. **CTF (Capture The Flag)** — team competition (2–5 members), registration only (no in-browser challenge engine)
2. **Project Showcasing** — team-based project submissions with file/image uploads
3. **Poster Presentation** — team-based poster submissions
4. **Trace & Route** — solo competition
5. **Panel Discussion** — speakers/panelists managed from admin
6. **Hands-on Activities / Workshops** — seat-limited workshop registrations

**Content integrity rule:** no fabricated content anywhere — empty states render "Coming Soon" / "To Be Announced" instead of fake speakers, sponsors, winners, prizes, or statistics.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js **14.2.13** (App Router, `output: standalone`) |
| Language | TypeScript (strict) |
| UI | React 18.3.1, Tailwind CSS 3, Radix UI primitives, framer-motion animations, lucide-react icons, recharts (admin charts) |
| Forms | react-hook-form + zod (shared client/server schemas) |
| Database | PostgreSQL via Prisma ORM (**32 models, 13 enums**) |
| Auth | NextAuth (Auth.js) v4 — **database sessions**, argon2id password hashing |
| Cache / rate limiting | Redis (ioredis) + `rate-limiter-flexible` |
| Email | Resend + React Email templates (verification, password reset, broadcast, unsubscribe) |
| Files | Sharp (re-encode, EXIF strip), private local storage for student IDs, Cloudinary-ready env config |
| QR | `qrcode` library — signed tokens only |
| PDF | pdf-lib — registration confirmation PDFs |
| Validation | zod + zod-prisma-types |
| Quality gates | Build enforces **typecheck + ESLint**; Prettier + prettier-plugin-tailwindcss |

**Database migrations:** 2 Prisma migrations (`20261005090316_init`, `20261005141220_email_log_optout_broadcast`) in `prisma/migrations/`. Seed script (`prisma/seed.ts`, 443 lines) creates enums-driven site settings, events, FAQs, and the initial super admin.

---

## 3. Architecture

### 3.1 Request pipeline

Every request flows through `src/middleware.ts` (344 lines) before reaching any route:

1. **Anti-spoofing** — strips inbound `x-nonce`, `x-user-*`, and `content-security-policy` request headers so clients can never forge identity/nonce context.
2. **Per-request CSP nonce** — fresh nonce generated per request, threaded through both the forwarded *request* headers (Next.js stamps it on framework scripts; root layout adds it to hand-written inline scripts) and the *response* CSP header the browser enforces.
3. **Security headers** — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` set dynamically per request (belt-and-suspenders alongside the static `next.config.mjs` headers).
4. **Maintenance mode** — non-admin requests served a rewrite to `/maintenance` when enabled.
5. **CORS** — explicit origin whitelist for `/api/*` (`ALLOWED_ORIGINS` env). **Wildcard is never set, not even as fallback.**
6. **Auth gates** — JWT/session token read via `getToken` (explicit `cookieName` + `salt`); AUTH_ONLY routes → `/login?callbackUrl=…`; protected routes → `/login`; suspended users → `/suspended`; admin routes with insufficient role → rewrite to `/403` (genuine 403 page, not a redirect).

### 3.2 CSP (nonce-based, dev/prod aware)

```
default-src 'self'
script-src 'self' 'nonce-<per-request>' 'strict-dynamic'   [dev adds 'unsafe-eval']
style-src 'self' 'unsafe-inline'        (framer-motion/react-hot-toast set runtime style attrs)
img-src 'self' data: blob: https:
frame-src https://www.google.com https://maps.google.com   (venue map embed)
connect-src 'self'                       [dev adds ws: wss: for HMR]
object-src 'none' · base-uri 'self' · form-action 'self' · frame-ancestors 'none'
[prod adds upgrade-insecure-requests]
```

`'strict-dynamic'` means modern browsers trust only nonce-carrying scripts (plus what those load) — injected `<script>` tags are dead on arrival. Verified in production: nonce in CSP header **matches** the nonce in the HTML on the same response and **rotates** on every request; prod build contains no `unsafe-eval` and no `ws:`.

### 3.3 Caching strategy

| Surface | Policy |
|---|---|
| `/api/*` responses | `Cache-Control: no-store, no-cache, must-revalidate` (deliberate — security posture for dynamic data) |
| `/_next/static/*`, `/fonts/*` | `public, max-age=31536000, immutable` (content-hashed filenames) |
| 6 public read APIs | **ISR** — deliberate `export const revalidate`: events 60s, schedule 120s, speakers 120s, workshops 30s, sponsors 300s, sponsor packages 3600s. Served with `x-nextjs-cache: HIT` server-side while clients receive no-store — the best of both. |
| `/sitemap.xml` | `force-dynamic` + DB-aware — pulls live `lastModified` timestamps from announcements/events, falls back to `now` if DB is unavailable |

### 3.4 Upload security chain

Student ID / submission uploads pass: **extension allow-list → MIME check → magic-byte sniff → size limit** → renamed with generated keys → **EXIF stripped + re-encoded via Sharp**. Student IDs go to **private storage only** — served exclusively through admin-authenticated signing endpoints with **signed URLs TTL ≤ 300 s**, every view written to `VerificationAccessLog`.

---

## 4. Page Surface (63 routes)

### Public site
`/` (home) · `/about` · `/events` + 6 module detail pages (`/events/ctf`, `/events/project-showcase`, `/events/poster`, `/events/trace-route`, `/events/panel`, `/events/workshops`) · `/schedule` · `/speakers` · `/sponsors` · `/partners` · `/gallery` · `/announcements` · `/faq` · `/venue` · `/contact` · `/register` · `/sponsor-portal`

### Auth flows — `(auth)` group
`/login` · `/signup` · `/forgot-password` · `/reset-password` · `/verify-email`

### Participant dashboard
`/dashboard` (overview) · `/dashboard/profile` · `/dashboard/qr` (check-in pass) · `/dashboard/events` · `/dashboard/team` · `/dashboard/submissions` · `/dashboard/documents` · `/dashboard/workshops`

### Admin console — 25 pages
`/admin` (live stats dashboard) · `/admin/participants` (+`/[id]` detail) · `/admin/verifications` (+`/[id]` review with private doc viewing) · `/admin/registrations` · `/admin/teams` (+`/[id]`) · `/admin/projects` · `/admin/posters` · `/admin/workshops` (+`/[id]`) · `/admin/panels` · `/admin/speakers` · `/admin/schedule` · `/admin/announcements` · `/admin/faq` · `/admin/gallery` · `/admin/sponsors` · `/admin/sponsor-apps` · `/admin/partners` · `/admin/contact-messages` · `/admin/audit-logs` · `/admin/check-in` · `/admin/analytics` · `/admin/roles` · `/admin/settings`

### System pages
`/403` · `/suspended` · `/maintenance` · `/not-found` (custom) · `/error` (error boundary) · `/sitemap.xml` (dynamic) · `/robots.txt` (static) · `/site.webmanifest` + icons

---

## 5. API Surface (80 routes)

### Auth & account
`/api/auth/[...nextauth]` · `/api/auth/register` · `/api/auth/verify-email` · `/api/auth/forgot-password` · `/api/auth/reset-password` · `/api/profile` · `/api/email/unsubscribe`

### Public reads (6 accelerated with ISR)
`/api/events` · `/api/events/[slug]` · `/api/schedule` · `/api/schedule/[day]` · `/api/speakers` · `/api/sponsors` · `/api/sponsors/packages` · `/api/workshops` · `/api/workshops/[id]` · `/api/announcements` · `/api/announcements/[id]` · `/api/faq` · `/api/gallery` · `/api/contact`

### Registration, teams, submissions
`/api/registrations` · `/api/registrations/[id]/confirmation` (PDF) · `/api/registrations/workshop` · `/api/teams/[id]` · `/api/teams/[id]/members` · `/api/teams/[id]/members/[memberId]` · `/api/submissions/project` (+`/[id]`) · `/api/submissions/poster` (+`/[id]`) · `/api/upload/document` · `/api/upload/submission` · `/api/files/verification/[id]` (signed, admin-gated, logged) · `/api/sponsors/apply`

### Admin (43 routes)
Full CRUD for every content domain: announcements (+broadcast), audit-logs, check-in (lookup + action), contact-messages, faq, gallery, panels, participants (+suspend), partners, posters, projects, registrations, roles, schedule, settings, speakers, sponsor-apps, sponsors, stats, teams, upload, verifications (+`/[id]/view-url` — the signed-URL minter), workshops.

---

## 6. Component Library (74 components)

| Group | Highlights |
|---|---|
| `admin/` | `AdminShell` (permission-filtered sidebar), `DataTable`, `StatCard`, `charts`, `fields`, `status`, `useAdminList` |
| `ui/` | 21 primitives: Button, Input, Select, Checkbox, RadioGroup, Accordion, Tabs, Modal, Drawer, Tooltip, Badge, Alert, Card, FileInput, Spinner, StepIndicator, Marquee, Reveal, SectionHeading, Textarea, EventWidgets |
| `effects/` | Cyber-themed animations: MatrixBg, ScanLine, Cursor, Preloader, ScrollProgress, BackgroundEffects |
| `home/` | 14 landing sections: Hero, EventIntro, EventStats, ModuleGrid/Previews/Features, SchedulePreview, SpeakersPreview, SponsorsSection, PartnersSection, GalleryPreview, FaqPreview, VenueSection, FinalCta, LegacySection |
| `register/` | `RegistrationWizard` (multi-step), `ParticipantFields`, `RegisterAuthGate`, `UploadField` |
| `dashboard/` | `DashboardShell`, `QrPassCard`, `TeamPanel`, `ProjectSubmissionPanel`, `PosterSubmissionPanel`, `ProfileForm`, `SubmissionUploadField` |
| `auth/` | `AuthCard`, `PasswordStrengthMeter` |
| `layout/` | `Navbar`, `Footer`, `AnnouncementBar`, `PageHeader`, `ComingSoon`, `BackButton` |

---

## 7. Data Model (32 models · 13 enums)

**Identity & auth:** `User`, `Account`, `Session`, `VerificationToken`, `PasswordReset`, `EmailVerification`
**Participants:** `ParticipantProfile`, `University`, `EventRegistration`, `Team`, `TeamMember`
**Verification:** `StudentVerification`, `VerificationAccessLog` (every private-doc view logged)
**Content & events:** `Event`, `Project`, `Poster`, `Workshop`, `WorkshopRegistration`, `Speaker`, `Panel`, `Panelist`, `ScheduleItem`
**Sponsors & partners:** `Sponsor`, `SponsorApplication`, `Partner`
**Site content:** `Announcement`, `GalleryImage`, `FAQ`, `ContactMessage`, `SiteSetting`
**Operations:** `AuditLog` (who/what/when/IP + before→after diff on every sensitive action), `EmailLog`

**Key enums:** `UserRole`, `AdminRole` (SUPER_ADMIN, EVENT_ADMIN, REGISTRATION_ADMIN, CONTENT_ADMIN, SPONSORSHIP_ADMIN, VERIFICATION_ADMIN), `VerificationStatus`, `EventType`, `EventStatus`, `RegistrationStatus`, `SubmissionStatus`, `SponsorTier`, `SponsorApplicationStatus`, `CheckInStatus`, `TShirtSize`, `SkillLevel`, `InstitutionType`.

---

## 8. Security Model

| Control | Implementation |
|---|---|
| Passwords | **argon2id** hashing |
| Sessions | NextAuth database sessions, `httpOnly` + `secure` + `sameSite=strict` cookies |
| Student ID documents | **Private storage only** — never in public APIs/URLs/indexes; admin-only signed URLs, **TTL ≤ 300 s**, each view audit-logged |
| QR check-in pass | Contains **only a signed registrationId token** (HMAC, expiry) — never PII |
| Input validation | zod schema validation **server-side on every route** (client validation is UX sugar only) |
| Uploads | extension + MIME + magic bytes + size → rename → Sharp re-encode (EXIF stripped) |
| Rate limiting | `rate-limiter-flexible` on Redis — per-endpoint limits (auth, registration, contact, uploads…) |
| CORS | Explicit whitelist, never wildcard |
| Headers | CSP (nonce + strict-dynamic) · HSTS · nosniff · X-Frame-Options DENY · Referrer-Policy |
| Error handling | No stack traces to clients; no `alert()` — toast notifications only |
| Secrets | Server-only env vars; no secrets in client bundle |
| Audit | Every sensitive admin action + every private document view logged with actor/IP/diff |
| 403 handling | Admin-gate failures produce a real 403 page (curl-verified body content) |

---

## 9. Running the Project

### Prerequisites
PostgreSQL and Redis. Local dev uses Docker Compose (`docker-compose.yml`): **postgres on host port 5433→5432** and **redis on host port 6380→6379** (password `cybercon_redis_dev`) — deliberately offset so they never collide with other local containers.

### Commands

```bash
# Install + generate Prisma client (postinstall runs automatically)
npm install

# Database
npm run prisma:migrate        # dev migrations
npm run prisma:migrate:prod   # production migrations
npm run prisma:seed           # seed events, settings, FAQs, super admin

# Develop
npm run dev                   # http://localhost:3000

# Quality gates
npm run type-check            # tsc --noEmit
npm run lint                  # next lint
npm run build                 # production build (typecheck + lint enforced)

# Production (standalone output)
node .next/standalone/server.js
```

### Key environment variables (see `.env.example` — 20+ vars)
`DATABASE_URL` · `AUTH_SECRET` + `AUTH_URL` · `RESEND_API_KEY` + `EMAIL_FROM` · `REDIS_URL` · `QR_SIGNING_SECRET` · `SIGNED_URL_TTL_SECONDS` (≤300) · `ALLOWED_ORIGINS` (whitelist) · `REGISTRATION_ID_PREFIX` (CYB26) · `SEED_ADMIN_*` (change password immediately after first login) · `NEXT_PUBLIC_REGISTRATION_OPEN` / `NEXT_PUBLIC_MAINTENANCE_MODE` feature flags.

---

## 10. Verification Status

The site has been verified end-to-end, not just built:

- **Build:** green with zero type errors and zero lint errors.
- **Runtime E2E:** `.e2e/admin-api-e2e.sh` — **141 checks, 141 passed, 0 failed** — covering every admin API plus security negatives (participant calling admin API → 403; no session → 401; tampered signature → 403; expired signed URL → 403; TTL enforced at 300 s; private file without signature → 403).
- **CSP audit (production build):** `upgrade-insecure-requests` present; no `unsafe-eval`, no `ws:`; nonce matches header↔HTML per response and rotates per request.
- **Auth gates:** curl-verified with body-content checks — participant gets the genuine 403 page; admin gets the console with live data.
- **SEO:** `/sitemap.xml` live with 19 URLs and dynamic `lastmod` from the database; `robots.txt` correct.
- **Browser pass:** home, login, register, and the full admin console rendered through the production build with **zero console errors**; server log clean (only expected `RESEND_API_KEY` warnings in this offline environment — emails activate as soon as a real key is set).
- **ISR:** confirmed `x-nextjs-cache: HIT` on the 6 accelerated public read APIs.

---

## 11. Repository Layout

```
├── .e2e/                  # 141-check E2E harness + smoke scripts + fixtures
├── docker/                # postgres / redis / pgadmin container configs
├── docker-compose.yml     # local infra (ports 5433 / 6380 — isolated from other projects)
├── prisma/
│   ├── schema.prisma      # 32 models · 13 enums
│   ├── migrations/        # init + email-log/optout/broadcast
│   └── seed.ts            # events, settings, FAQs, super admin
├── public/                # favicon, icons, og-image, robots.txt, webmanifest
├── scripts/               # generate-brand-assets.mjs
├── spec-recovered.md      # original project specification
├── src/
│   ├── middleware.ts      # security pipeline (CSP nonce, CORS, auth gates)
│   ├── app/               # 63 pages + 80 API routes (App Router)
│   ├── components/        # 74 components (10 groups)
│   └── lib/               # 27 modules: auth, rbac, audit, email, security,
│                          #   storage, validations, registrations, submissions…
├── next.config.mjs        # security headers, caching, standalone output
└── summary.md             # this document
```

**Scale:** 283 TypeScript/TSX source files — 63 pages, 80 API routes, 74 components, 27 library modules, 32 database models.

---

*Generated after a full repository scan on 2026-10-05. This document describes the site as built and verified.*
