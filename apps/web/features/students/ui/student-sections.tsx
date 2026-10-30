"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AbsenceList } from "@/features/absences/ui/absence-list";
import { useMe } from "@/features/auth";
import { StudentBalance } from "@/features/ledger/ui/student-balance";
import { StudentSchedule } from "@/features/lessons/ui/student-schedule";
import { StudentPayments } from "@/features/payments/ui/student-payments";

type Section = "balance" | "schedule" | "payments" | "absences";
type Props = { studentId: string; isActive?: boolean; onDirtyChange: (dirty: boolean) => void };

export function StudentSections({ studentId, isActive, onDirtyChange }: Props) {
  const t = useTranslations("Students");
  const { data: me } = useMe();
  const [selected, setSelected] = useState<Section>("balance");

  const available: Section[] = [];
  if (me?.permissions.includes("balance.read")) available.push("balance");
  if (me?.permissions.includes("lessons.read")) available.push("schedule");
  if (me?.permissions.includes("payments.read")) available.push("payments");
  if (me?.permissions.includes("absences.manage")) available.push("absences");
  if (available.length === 0) return null;

  const active = available.includes(selected) ? selected : available[0];

  // Balance stays mounted (hidden, not unmounted) so an unsaved adjustment survives switching; Payments mounts on first open.
  return (
    <Tabs value={active} onValueChange={(next) => setSelected(next as Section)} className="gap-5 border-t pt-3">
      <TabsList className="w-full group-data-horizontal/tabs:h-10">
        {available.map((section) => (
          <TabsTrigger key={section} value={section}>
            {t(`section.${section}`)}
          </TabsTrigger>
        ))}
      </TabsList>
      {available.includes("balance") && (
        <TabsContent value="balance" forceMount hidden={active !== "balance"} className="text-base">
          <StudentBalance studentId={studentId} isActive={isActive} onDirtyChange={onDirtyChange} />
        </TabsContent>
      )}
      {available.includes("schedule") && (
        <TabsContent value="schedule" className="text-base">
          <StudentSchedule studentId={studentId} />
        </TabsContent>
      )}
      {available.includes("payments") && (
        <TabsContent value="payments" className="text-base">
          <StudentPayments studentId={studentId} />
        </TabsContent>
      )}
      {available.includes("absences") && (
        <TabsContent value="absences" className="text-base">
          <AbsenceList owner={{ studentId }} />
        </TabsContent>
      )}
    </Tabs>
  );
}
