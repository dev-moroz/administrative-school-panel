import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ViewMode } from "@/hooks/use-view-mode";
import type { StudentListItem } from "../model/types";
import { StudentCard } from "./student-card";
import { StudentRow } from "./student-row";

type Props = {
  view: ViewMode;
  students: StudentListItem[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelect: (id: string) => void;
};

const SKELETON_COUNT = 12;

const containerClass: Record<ViewMode, string> = {
  cards: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  list: "flex flex-col gap-2",
};

export function StudentsGrid({ view, students, isLoading, isError, onRetry, onSelect }: Props) {
  const t = useTranslations("Students");

  if (isError && !students) {
    return (
      <div role="alert" className="grid justify-items-center gap-3 py-12 text-center">
        <p className="text-muted-foreground">{t("loadError")}</p>
        <Button variant="outline" onClick={onRetry}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (isLoading && !students) {
    return (
      <div data-view={view} aria-busy="true" className={containerClass[view]}>
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <Skeleton key={i} className={view === "cards" ? "h-32" : "h-12"} />
        ))}
      </div>
    );
  }

  if (!students?.length) {
    return <p className="py-12 text-center text-muted-foreground">{t("empty")}</p>;
  }

  const Item = view === "cards" ? StudentCard : StudentRow;
  return (
    <div data-view={view} className={containerClass[view]}>
      {students.map((student) => (
        <Item key={student.id} student={student} onSelect={onSelect} />
      ))}
    </div>
  );
}
