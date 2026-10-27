export type SettingsSection = {
  key: "currencies";
  href: string;
  permission: string;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { key: "currencies", href: "/settings/currencies", permission: "currencies.update" },
];

export function getAvailableSections(
  permissions: string[],
  sections: SettingsSection[] = SETTINGS_SECTIONS,
) {
  return sections.filter((section) => permissions.includes(section.permission));
}

export type SettingsAccess = { type: "allow" } | { type: "redirect"; to: string };

export function resolveSettingsAccess(
  pathname: string,
  permissions: string[],
  sections: SettingsSection[] = SETTINGS_SECTIONS,
): SettingsAccess {
  const available = getAvailableSections(permissions, sections);
  if (available.length === 0) return { type: "redirect", to: "/students" };

  const isOpen = (s: SettingsSection) => pathname === s.href || pathname.startsWith(`${s.href}/`);
  const requested = sections.find(isOpen);
  if (requested && !available.includes(requested)) return { type: "redirect", to: "/settings" };

  return { type: "allow" };
}
