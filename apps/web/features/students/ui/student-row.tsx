import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "../model/get-initials";
import type { StudentListItem } from "../model/types";

type Props = { student: StudentListItem; onSelect: (id: string) => void };

export function StudentRow({ student, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(student.id)}
      className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Avatar size="sm">
        <AvatarFallback>{getInitials(student.fullName)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate font-medium">{student.fullName}</span>
      {student.telegramUsername && (
        <span className="truncate text-sm text-muted-foreground">@{student.telegramUsername}</span>
      )}
    </button>
  );
}
