import { Pencil, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getInitials } from "../model/get-initials";
import type { Student } from "../model/types";

type Props = { student: Student; canEdit: boolean; onEdit: () => void };

const EMPTY = "—";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap">{children}</dd>
    </div>
  );
}

export function StudentDetails({ student, canEdit, onEdit }: Props) {
  const t = useTranslations("Students");
  const price = student.lessonPrice
    ? [student.lessonPrice, student.defaultCurrencyCode].filter(Boolean).join(" ")
    : EMPTY;

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-4">
        <Avatar size="lg">
          <AvatarFallback>{getInitials(student.fullName)}</AvatarFallback>
        </Avatar>
        <div className="grid min-w-0 flex-1 gap-1">
          <span className="truncate text-lg font-medium">{student.fullName}</span>
          <Badge variant={student.isActive ? "secondary" : "outline"} className="text-muted-foreground">
            {student.isActive ? t("statusActive") : t("statusInactive")}
          </Badge>
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil />
            {t("edit")}
          </Button>
        )}
      </div>
      <dl className="grid gap-4">
        <Row label={t("fieldNickname")}>
          <span className="inline-flex items-center gap-2">
            <span
              role="img"
              aria-label={student.telegramLinked ? t("telegramLinked") : t("telegramNotLinked")}
              className={student.telegramLinked ? "text-sky-500" : "text-muted-foreground/40"}
            >
              <Send className="size-4" />
            </span>
            {student.telegramUsername ? `@${student.telegramUsername}` : EMPTY}
          </span>
        </Row>
        <Row label={t("fieldLevel")}>{student.englishLevel ?? EMPTY}</Row>
        <Row label={t("fieldPrice")}>{price}</Row>
        <Row label={t("fieldTeacher")}>{student.teacher?.fullName ?? EMPTY}</Row>
        <Row label={t("fieldComment")}>{student.comment || EMPTY}</Row>
      </dl>
    </div>
  );
}
