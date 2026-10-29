export type ProfileSection = { key: "absences"; href: string };

// Absences belong to the user's teacher record, so a user without one has no section.
export function getProfileSections(me: { teacherId: string | null; permissions: string[] }): ProfileSection[] {
  if (!me.teacherId || !me.permissions.includes("absences.manage")) return [];
  return [{ key: "absences", href: "/profile/absences" }];
}
