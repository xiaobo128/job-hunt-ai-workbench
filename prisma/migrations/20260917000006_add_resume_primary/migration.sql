ALTER TABLE "Resume" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;

WITH ranked_resumes AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "ownerId" ORDER BY "updatedAt" DESC, "id" DESC) AS rank
  FROM "Resume"
)
UPDATE "Resume" AS resume
SET "isPrimary" = ranked_resumes.rank = 1
FROM ranked_resumes
WHERE resume."id" = ranked_resumes."id";

CREATE UNIQUE INDEX "Resume_ownerId_primary_key"
ON "Resume"("ownerId")
WHERE "isPrimary" = true;
