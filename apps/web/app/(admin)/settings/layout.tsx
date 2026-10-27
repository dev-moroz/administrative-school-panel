"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMe } from "@/features/auth";
import { SettingsNav, resolveSettingsAccess } from "@/features/settings";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me } = useMe();

  const access = me ? resolveSettingsAccess(pathname, me.permissions) : null;
  const redirectTo = access?.type === "redirect" ? access.to : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  // While the session loads, SessionGuard's overlay covers the children.
  if (!me) return <>{children}</>;
  if (redirectTo) return null;

  return (
    <div className="-m-4 flex flex-1">
      <SettingsNav permissions={me.permissions} />
      <div className="flex min-w-0 flex-1 flex-col p-4">{children}</div>
    </div>
  );
}
