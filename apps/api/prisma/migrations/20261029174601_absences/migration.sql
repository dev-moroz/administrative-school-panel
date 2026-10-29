-- CreateEnum
CREATE TYPE "AbsenceKind" AS ENUM ('STUDENT_FREEZE', 'TEACHER_VACATION');

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "absence_id" UUID;

-- CreateTable
CREATE TABLE "absences" (
    "id" UUID NOT NULL,
    "kind" "AbsenceKind" NOT NULL,
    "student_id" UUID,
    "teacher_id" UUID,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "comment" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "absences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "absences_student_id_starts_on_idx" ON "absences"("student_id", "starts_on");

-- CreateIndex
CREATE INDEX "absences_teacher_id_starts_on_idx" ON "absences"("teacher_id", "starts_on");

-- CreateIndex
CREATE INDEX "lessons_absence_id_idx" ON "lessons"("absence_id");

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_absence_id_fkey" FOREIGN KEY ("absence_id") REFERENCES "absences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Exactly one owner, matching the kind.
ALTER TABLE "absences" ADD CONSTRAINT "absences_owner_check" CHECK (
    (kind = 'STUDENT_FREEZE' AND student_id IS NOT NULL AND teacher_id IS NULL)
    OR (kind = 'TEACHER_VACATION' AND teacher_id IS NOT NULL AND student_id IS NULL)
);
