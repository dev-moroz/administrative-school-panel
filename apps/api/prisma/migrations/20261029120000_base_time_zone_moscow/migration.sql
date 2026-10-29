-- AlterTable
ALTER TABLE "lesson_series" DROP COLUMN "time_zone";

-- AlterTable
ALTER TABLE "teachers" ALTER COLUMN "time_zone" SET DEFAULT 'Europe/Moscow';
