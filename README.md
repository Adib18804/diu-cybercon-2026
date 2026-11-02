# DIU_CYBERCON 2026

**LEARN · SECURE · DEFEND**

The official conference platform for DIU_CYBERCON 2026, hosted by the Cyber Security Club, Department of CSE, Daffodil International University. The application supports public conference information, participant accounts, event registration, team management, manual bKash payments, sponsor administration, and event operations.

## Conference information

- **Day 1 · 24 October 2026:** Online CTF preliminary round
- **Day 2 · 14 November 2026:** Project Showcase, Poster Presentation, Trace & Route, and workshops
- **Day 3 · 15 November 2026:** CTF finals, panel discussion, prize giving, and closing ceremony
- **Venue:** Daffodil Smart City, Birulia, Savar, Dhaka-1216, Bangladesh

## Features

- Public home, about, event, schedule, speaker, sponsor, FAQ, gallery, and venue pages.
- Participant accounts, profile management, email verification, and role-based admin access.
- Individual and team registrations with event-specific registration IDs such as `CYB26-C-101-A7F3K9`.
- Signed QR passes containing a registration ID claim and standard token metadata, without participant PII.
- Per-event registration dates, deadlines, fee, and open/closed toggle managed by authorized admins and recorded in the audit log.
- Registration review queue with approve/reject actions, participant email notifications, and confirmation invoices.
- Manual bKash payment submission and admin verification. Transaction IDs are validated and excluded from payment API responses.
- Sponsor logo upload with server-side validation and Sharp image processing, plus tier-based sponsor grids.
- Admin analytics for registrations, payment revenue, team sizes, and pending approvals.
- QR check-in, registration and team management, student verification, submissions, workshops, announcements, and site settings.
- Red, black, and white interface palette with responsive navigation and horizontally scrollable data tables.

## Technology

| Area | Technology |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 3.4 and shared design tokens |
| Database | PostgreSQL 16 and Prisma ORM |
| Authentication | NextAuth.js / Auth.js (NextAuth 5 beta dependency in this repository) |
| Validation | Zod |
| Email | Resend |
| Media storage | Cloudinary |
| Image processing | Sharp |
| Charts | Recharts |
| QR | `qrcode` with signed JWT tokens |
| PDF invoices | `pdf-lib` |
| Rate limiting | `rate-limiter-flexible`, optional Redis |

## Requirements

- Node.js 20 or later
- npm 10 or later
- Docker Compose for the local PostgreSQL and Redis services
- Cloudinary credentials for upload workflows
- A Resend API key and verified sender for actual email delivery

## Local setup

1. Install dependencies and prepare environment configuration:

   ```bash
   npm install
   cp .env.example .env.local
   ```

   On Windows PowerShell, use `Copy-Item .env.example .env.local` instead of `cp`.

2. Edit `.env.local`. Generate unique secrets for `AUTH_SECRET` and `QR_SIGNING_SECRET` (at least 32 characters); set `NEXT_PUBLIC_APP_URL` and `AUTH_URL` to `http://localhost:3000`. The example configuration uses PostgreSQL at port `5433` and Redis at port `6380`, matching `docker-compose.yml`.

   Configure valid Cloudinary credentials to test uploads. Configure `RESEND_API_KEY` and `EMAIL_FROM` to deliver email. Without a Resend API key, the email service logs the delivery failure and returns safely; it does not deliver messages.

3. Start PostgreSQL and Redis:

   ```bash
   docker compose up -d
   docker compose ps
   ```

4. Generate the Prisma client, apply database migrations, and seed development data:

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   npm run prisma:seed
   ```

   The seed script reads the initial Super Admin credentials from environment variables. Change the development seed password before using any shared or production environment. Seed the `payment.bkashNumber` site setting with the receiving number before testing paid registration.

5. Start the application:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). The admin console is at `/admin` and requires an assigned admin role.

To start the optional pgAdmin service, use `docker compose --profile tools up -d`; it is available at `http://localhost:5050`.

## Useful commands

```bash
npm run dev                 # Local development server
npm run type-check          # TypeScript validation
npm run lint                # ESLint
npm run build               # Production build
npm run start               # Serve a production build
npm run prisma:generate     # Regenerate Prisma client
npm run prisma:migrate      # Create/apply development migrations
npm run prisma:migrate:prod # Apply committed migrations
npm run prisma:seed         # Populate development data
npm run prisma:studio       # Open Prisma Studio
```

There is no test or E2E script in the current `package.json`; use the manual checklist in [`test.md`](./test.md) for local verification.

## Payment and registration lifecycle

- Free event registrations start as `PENDING` and are reviewed by an admin.
- For a paid event, the participant submits a bKash transaction ID. The registration becomes `PENDING_PAYMENT` while the payment is reviewed.
- A verified payment confirms the registration and sends a confirmation email with a paid invoice. A rejected payment sends the participant a reason and permits another transaction submission.
- A payment amount is derived from the event fee on the server. Admins must compare the transaction against the bKash merchant portal before verification.
- Registration IDs are allocated using a per-event database counter. The QR value is a signed token that contains the registration ID claim; it does not contain participant details.

The bKash receiving number is stored in the `payment.bkashNumber` `SiteSetting`. Set it through the authorized site settings interface before accepting paid registrations.

## Admin sections

Admin routes are protected by server-side permissions. Available sections depend on the signed-in admin's role.

| Route | Purpose |
|---|---|
| `/admin` and `/admin/analytics` | Conference operations overview and analytics |
| `/admin/events` | Event list, dates, registration state, and fees |
| `/admin/registrations` | Registration review and status management |
| `/admin/payments` | bKash transaction verification queue |
| `/admin/sponsors` | Sponsor records and logo management |
| `/admin/check-in` | QR lookup and check-in actions |
| `/admin/teams` and `/admin/participants` | Participant and team management |
| `/admin/settings` | Site settings, including the bKash receiving number |
| `/admin/audit-logs` | Recorded administrative and security events |

## Database additions

The schema includes event registration fees, `Payment` records, per-event registration counters, and the `PENDING_PAYMENT` registration state. Payment statuses are `PENDING`, `VERIFIED`, and `REJECTED`; the supported payment method is `BKASH`. Apply schema changes through Prisma migrations rather than editing a deployed database manually.

## Security notes

- API handlers enforce authentication or role permissions server-side and validate request data with Zod.
- Payment amounts are taken from the database; users cannot set their own payable amount.
- Payment transaction IDs are not returned in payment API responses. They are visible only to authorized admins in the verification interface.
- Uploaded images are validated and re-encoded with Sharp. Student identity documents use private storage and signed access URLs.
- QR tokens are HMAC/JWT signed. The QR payload contains a registration ID claim and standard token metadata, not PII.
- Administrative event and payment changes are audit-logged.
- Keep `.env.local` and production secrets out of version control. Do not use development seed credentials outside a private local environment.

## Deployment

Before deployment, configure production environment variables, provision PostgreSQL and storage, set a production bKash number and verified email sender, and restrict allowed origins. Apply committed migrations with:

```bash
npm run prisma:migrate:prod
npm run build
npm run start
```

The project can be deployed to a Next.js-compatible host such as Vercel. Configure all required environment variables in the hosting provider; never rely on local development defaults in production.

## License

Private — Cyber Security Club, Department of CSE, Daffodil International University. All rights reserved.
