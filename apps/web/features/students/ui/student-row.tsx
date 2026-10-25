import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "../model/get-initials";
import type { StudentListItem } from "../model/types";

type Props = { student: StudentListItem; onSelect: (id: string) => void };

export function StudentRow({ student, onSelect }: Props) {
  const t = useTranslations("Students");
  return (
    <button
      type="button"
      onClick={() => onSelect(student.id)}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring ${student.isActive ? "bg-card" : "bg-muted/40"}`}
    >
      <Avatar size="sm" className={student.isActive ? undefined : "opacity-50"}>
        <AvatarFallback>{getInitials(student.fullName)}</AvatarFallback>
      </Avatar>
      <span
        className={`min-w-0 flex-1 truncate font-medium ${student.isActive ? "" : "text-muted-foreground"}`}
      >
        {student.fullName}
      </span>
      {student.telegramUsername && (
        <span className="truncate text-sm text-muted-foreground">@{student.telegramUsername}</span>
      )}
      {!student.isActive && <span className="sr-only">{t("statusInactive")}</span>}
    </button>
  );
}
