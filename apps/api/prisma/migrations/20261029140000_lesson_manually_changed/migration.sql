-- AlterTable
ALTER TABLE "lessons" ADD COLUMN "manually_changed" BOOLEAN NOT NULL DEFAULT false;

-- backfill: series lessons that left their Moscow slot or were cancelled / marked no-show by hand
UPDATE "lessons" l
SET "manually_changed" = true
FROM "lesson_series" s
WHERE l."series_id" = s."id"
  AND (
    l."starts_at" <> ((l."original_date" + s."start_time"::time) AT TIME ZONE 'Europe/Moscow') AT TIME ZONE 'UTC'
    OR l."duration_min" <> s."duration_min"
    OR l."status" IN ('CANCELLED', 'NO_SHOW')
  );
