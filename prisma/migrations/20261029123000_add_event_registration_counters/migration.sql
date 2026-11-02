CREATE TABLE "EventRegistrationCounter" (
    "eventId" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRegistrationCounter_pkey" PRIMARY KEY ("eventId")
);

INSERT INTO "EventRegistrationCounter" ("eventId", "lastValue", "updatedAt")
SELECT e."id", 100 + COUNT(r."id")::INTEGER, CURRENT_TIMESTAMP
FROM "Event" e
LEFT JOIN "EventRegistration" r ON r."eventId" = e."id"
GROUP BY e."id";

ALTER TABLE "EventRegistrationCounter"
ADD CONSTRAINT "EventRegistrationCounter_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
