"use client";

import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import type { SeriesResult } from "./types";

// Warnings come as codes; the text is built here so it follows the UI language.
export function useSeriesWarnings() {
  const t = useTranslations("Lessons");
  const format = useFormatter();
  return ({ warnings }: SeriesResult) => {
    const dates = warnings
      .filter((w) => w.code === "SERIES_SLOT_SKIPPED")
      .map((w) => format.dateTime(new Date(`${w.date}T12:00:00Z`), { month: "short", day: "numeric", timeZone: "UTC" }));
    if (dates.length) toast.warning(t("slotsSkipped", { dates: dates.join(", ") }));
  };
}
