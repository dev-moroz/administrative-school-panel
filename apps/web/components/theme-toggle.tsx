"use client"

import { useSyncExternalStore } from "react"
import { Moon, Sun } from "lucide-react"
import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { Switch } from "@/components/ui/switch"

const subscribe = () => () => {}

// False on the server and during hydration, true afterwards.
function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}

export function ThemeToggle() {
  const t = useTranslations("Theme")
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()

  return (
    <div className="flex h-12 items-center gap-3 px-2 [&_svg]:size-5">
      {/* CSS picks the active icon, so the server and client markup match. */}
      <Sun className="text-foreground dark:text-muted-foreground" />
      <Switch
        aria-label={t("toggle")}
        checked={mounted && resolvedTheme === "dark"}
        disabled={!mounted}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
      />
      <Moon className="text-muted-foreground dark:text-foreground" />
    </div>
  )
}
