-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- AlterTable
ALTER TABLE "ledger_entries" ADD COLUMN     "lesson_id" UUID,
ALTER COLUMN "created_by_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "cancel_reasons" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cancel_reasons_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'SCHEDULED',
    "charged" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason_code" TEXT,
    "comment" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_participants" (
    "lesson_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,

    CONSTRAINT "lesson_participants_pkey" PRIMARY KEY ("lesson_id","student_id")
);

-- CreateIndex
CREATE INDEX "lessons_teacher_id_starts_at_idx" ON "lessons"("teacher_id", "starts_at");

-- CreateIndex
CREATE INDEX "lessons_status_starts_at_idx" ON "lessons"("status", "starts_at");

-- CreateIndex
CREATE INDEX "lessons_cancel_reason_code_idx" ON "lessons"("cancel_reason_code");

-- CreateIndex
CREATE INDEX "lesson_participants_student_id_idx" ON "lesson_participants"("student_id");

-- CreateIndex
CREATE INDEX "ledger_entries_lesson_id_idx" ON "ledger_entries"("lesson_id");

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_cancel_reason_code_fkey" FOREIGN KEY ("cancel_reason_code") REFERENCES "cancel_reasons"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_participants" ADD CONSTRAINT "lesson_participants_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_participants" ADD CONSTRAINT "lesson_participants_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
