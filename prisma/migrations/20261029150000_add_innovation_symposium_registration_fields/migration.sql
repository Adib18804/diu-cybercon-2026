-- Add the merged symposium event type without dropping legacy enum values.
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'INNOVATION_SYMPOSIUM';

-- Keep the existing PENDING_PAYMENT value during the transition while adding
-- the requested phase-workflow status names.
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'PRELIM_APPROVED';
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_PENDING';

CREATE TYPE "RegistrationPhase" AS ENUM ('PRELIMINARY', 'FINAL');

ALTER TABLE "EventRegistration"
  ADD COLUMN "registrationPhase" "RegistrationPhase" NOT NULL DEFAULT 'PRELIMINARY',
  ADD COLUMN "domain" TEXT,
  ADD COLUMN "ideaSummary" TEXT;
