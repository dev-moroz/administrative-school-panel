-- CreateTable
CREATE TABLE "payment_methods" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("code")
);

-- Rows for the former enum values, so existing payments keep a valid reference
INSERT INTO "payment_methods" ("code", "name", "icon") VALUES
    ('CASH', 'Cash', 'banknote'),
    ('CARD', 'Card', 'credit-card'),
    ('TRANSFER', 'Bank transfer', 'landmark'),
    ('CRYPTO', 'Crypto', 'bitcoin');

-- AlterTable: enum column becomes a text reference
ALTER TABLE "payments" RENAME COLUMN "method" TO "method_code";
ALTER TABLE "payments" ALTER COLUMN "method_code" TYPE TEXT USING "method_code"::text;

-- DropEnum
DROP TYPE "PaymentMethod";

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_method_code_fkey" FOREIGN KEY ("method_code") REFERENCES "payment_methods"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
