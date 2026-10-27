"use client";

import type { LucideIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Option<T extends string> = { value: T; label: string; icon: LucideIcon };
type Props<T extends string> = { value: T; options: Option<T>[]; onChange: (value: T) => void };

export function ViewToggle<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value}
      // Radix sends "" when the active item is clicked again; keep the current view.
      onValueChange={(next) => next && onChange(next as T)}
    >
      {options.map(({ value: optionValue, label, icon: Icon }) => (
        <ToggleGroupItem key={optionValue} value={optionValue} aria-label={label}>
          <Icon />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
