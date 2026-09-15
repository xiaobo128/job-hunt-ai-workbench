ALTER TABLE "Event"
  ADD COLUMN "windowStartAt" TIMESTAMP(3),
  ADD COLUMN "deadlineAt" TIMESTAMP(3),
  ADD COLUMN "receivedAt" TIMESTAMP(3),
  ADD COLUMN "relativeValidityMinutes" INTEGER;
