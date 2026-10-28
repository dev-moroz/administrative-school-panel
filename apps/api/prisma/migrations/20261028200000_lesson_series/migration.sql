-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "original_date" DATE,
ADD COLUMN     "series_id" UUID;

-- CreateTable
CREATE TABLE "lesson_series" (
    "id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "time_zone" TEXT NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "generated_until" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_series_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_series_student_id_idx" ON "lesson_series"("student_id");

-- CreateIndex
CREATE INDEX "lesson_series_teacher_id_idx" ON "lesson_series"("teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_series_id_original_date_key" ON "lessons"("series_id", "original_date");

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "lesson_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_series" ADD CONSTRAINT "lesson_series_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_series" ADD CONSTRAINT "lesson_series_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

