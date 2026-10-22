"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api";
import { logout, useMe } from "@/features/auth";

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, error } = useMe();
  const unauthorized = error instanceof ApiError && error.status === 401;

  // Clear the stale cookie first, otherwise proxy.ts bounces /login back to /.
  useEffect(() => {
    if (!unauthorized) return;
    logout()
      .catch(() => {})
      .finally(() => router.replace("/login"));
  }, [unauthorized, router]);

  // Nothing but a loader until the session is confirmed (loading, refreshing or redirecting).
  if (!data) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }
  return children;
}
