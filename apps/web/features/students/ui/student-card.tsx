import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "../model/get-initials";
import type { StudentListItem } from "../model/types";

type Props = { student: StudentListItem; onSelect: (id: string) => void };

export function StudentCard({ student, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(student.id)}
      className="flex flex-col items-center gap-3 rounded-xl border bg-card p-5 text-center transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Avatar size="lg">
        <AvatarFallback>{getInitials(student.fullName)}</AvatarFallback>
      </Avatar>
      <span className="grid gap-0.5">
        <span className="font-medium">{student.fullName}</span>
        {student.telegramUsername && (
          <span className="text-sm text-muted-foreground">@{student.telegramUsername}</span>
        )}
      </span>
    </button>
  );
}
