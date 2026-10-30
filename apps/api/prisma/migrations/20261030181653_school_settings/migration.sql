-- CreateTable
CREATE TABLE "school_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "low_balance_threshold" INTEGER NOT NULL DEFAULT 2,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "school_settings_single_row" CHECK ("id" = 1)
);

INSERT INTO "school_settings" ("id", "updated_at") VALUES (1, CURRENT_TIMESTAMP);
