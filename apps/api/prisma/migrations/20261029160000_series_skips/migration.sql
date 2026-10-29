-- CreateTable
CREATE TABLE "series_skips" (
    "series_id" UUID NOT NULL,
    "original_date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "conflict_lesson_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "series_skips_pkey" PRIMARY KEY ("series_id","original_date")
);

-- AddForeignKey
ALTER TABLE "series_skips" ADD CONSTRAINT "series_skips_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "lesson_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
