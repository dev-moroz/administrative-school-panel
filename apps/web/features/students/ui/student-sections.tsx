"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMe } from "@/features/auth";
import { StudentBalance } from "@/features/ledger/ui/student-balance";
import { StudentPayments } from "@/features/payments/ui/student-payments";

type Section = "balance" | "payments";
type Props = { studentId: string; onDirtyChange: (dirty: boolean) => void };

export function StudentSections({ studentId, onDirtyChange }: Props) {
  const t = useTranslations("Students");
  const { data: me } = useMe();
  const [selected, setSelected] = useState<Section>("balance");

  const available: Section[] = [];
  if (me?.permissions.includes("balance.read")) available.push("balance");
  if (me?.permissions.includes("payments.read")) available.push("payments");
  if (available.length === 0) return null;

  const active = available.includes(selected) ? selected : available[0];

  // Both sections stay mounted and the inactive one is only hidden, so an unsaved balance adjustment survives switching.
  return (
    <div className="grid gap-5 border-t pt-8">
      <ToggleGroup
        type="single"
        variant="outline"
        className="justify-self-start"
        value={active}
        onValueChange={(next) => next && setSelected(next as Section)}
      >
        {available.map((section) => (
          <ToggleGroupItem key={section} value={section}>
            {t(`section.${section}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div hidden={active !== "balance"}>
        <StudentBalance studentId={studentId} onDirtyChange={onDirtyChange} />
      </div>
      <div hidden={active !== "payments"}>
        <StudentPayments studentId={studentId} />
      </div>
    </div>
  );
}
