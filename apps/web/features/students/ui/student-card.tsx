import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "../model/get-initials";
import type { StudentListItem } from "../model/types";
import { StudentListBalance } from "./student-list-balance";

type Props = { student: StudentListItem; lowBalanceThreshold?: number; onSelect: (id: string) => void };

export function StudentCard({ student, lowBalanceThreshold, onSelect }: Props) {
  const t = useTranslations("Students");
  return (
    <button
      type="button"
      onClick={() => onSelect(student.id)}
      className={`flex flex-col items-center gap-3 rounded-xl border p-5 text-center transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring ${student.isActive ? "bg-card" : "bg-muted/40"}`}
    >
      <Avatar size="xl" className={student.isActive ? undefined : "opacity-50"}>
        <AvatarFallback>{getInitials(student.fullName)}</AvatarFallback>
      </Avatar>
      <span className="grid gap-0.5">
        <span className={student.isActive ? "font-medium" : "font-medium text-muted-foreground"}>
          {student.fullName}
        </span>
        {student.telegramUsername && (
          <span className="text-sm text-muted-foreground">@{student.telegramUsername}</span>
        )}
      </span>
      <StudentListBalance student={student} threshold={lowBalanceThreshold} />
      {!student.isActive && <span className="sr-only">{t("statusInactive")}</span>}
    </button>
  );
}
