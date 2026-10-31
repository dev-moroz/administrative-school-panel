-- AlterTable
ALTER TABLE "school_settings" ADD COLUMN     "day_starts_at" TEXT NOT NULL DEFAULT '12:00',
ADD COLUMN     "evening_starts_at" TEXT NOT NULL DEFAULT '17:00',
ADD COLUMN     "late_window_min" INTEGER NOT NULL DEFAULT 60;
