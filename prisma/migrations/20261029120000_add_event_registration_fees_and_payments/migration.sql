-- Add event registration pricing and manual bKash payment records.
ALTER TABLE "Event"
ADD COLUMN "registrationFee" DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE TYPE "PaymentMethod" AS ENUM ('BKASH');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BKASH',
    "transactionId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_transactionId_key" ON "Payment"("transactionId");
CREATE INDEX "Payment_registrationId_idx" ON "Payment"("registrationId");
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_registrationId_fkey"
FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
