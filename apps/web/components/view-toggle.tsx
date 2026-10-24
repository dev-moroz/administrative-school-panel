"use client";

import { LayoutGrid, List } from "lucide-react";
import { useTranslations } from "next-intl";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ViewMode } from "@/hooks/use-view-mode";

type Props = { value: ViewMode; onChange: (value: ViewMode) => void };

export function ViewToggle({ value, onChange }: Props) {
  const t = useTranslations("Common");

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value}
      // Radix sends "" when the active item is clicked again; keep the current view.
      onValueChange={(next) => next && onChange(next as ViewMode)}
    >
      <ToggleGroupItem value="cards" aria-label={t("cards")}>
        <LayoutGrid />
      </ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label={t("list")}>
        <List />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
