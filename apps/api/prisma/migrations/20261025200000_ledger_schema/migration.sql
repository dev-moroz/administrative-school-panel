-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('PURCHASE', 'LESSON_CHARGE', 'LESSON_REVERSAL', 'MANUAL_ADJUSTMENT');

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "comment" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ledger_entries_student_id_created_at_idx" ON "ledger_entries"("student_id", "created_at");

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
