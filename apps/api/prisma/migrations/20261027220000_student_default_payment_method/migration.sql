-- AlterTable
ALTER TABLE "students" ADD COLUMN "default_payment_method_code" TEXT;

-- CreateIndex
CREATE INDEX "students_default_payment_method_code_idx" ON "students"("default_payment_method_code");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_default_payment_method_code_fkey" FOREIGN KEY ("default_payment_method_code") REFERENCES "payment_methods"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
