import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Props = { page: number; totalPages: number; onPageChange: (page: number) => void };

export function StudentsPagination({ page, totalPages, onPageChange }: Props) {
  const t = useTranslations("Common");

  return (
    <div className="flex items-center justify-center gap-4">
      <Button variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        {t("previous")}
      </Button>
      <span className="text-sm text-muted-foreground">{t("pageOf", { page, total: totalPages })}</span>
      <Button variant="outline" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        {t("next")}
      </Button>
    </div>
  );
}
