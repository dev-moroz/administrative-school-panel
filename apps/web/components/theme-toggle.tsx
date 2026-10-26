"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const OPTIONS = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
] as const

export function ThemeToggle() {
  const t = useTranslations("Theme")
  const { setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-12 w-full justify-start gap-2 px-2 text-base [&_svg]:size-5"
        >
          {/* Both icons are in the DOM; CSS picks one, so the server and client markup match. */}
          <Sun className="dark:hidden" />
          <Moon className="hidden dark:block" />
          <span>{t("toggle")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start">
        {OPTIONS.map(({ value, icon: Icon }) => (
          <DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
            <Icon />
            {t(value)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
