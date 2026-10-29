"use client";

import { AbsenceList } from "@/features/absences/ui/absence-list";
import { useMe } from "@/features/auth";

export default function ProfileAbsencesPage() {
  const { data: me } = useMe();
  if (!me?.teacherId) return null;
  return <AbsenceList owner={{ teacherId: me.teacherId }} variant="page" />;
}
