import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type PaginationProps = { page: number; totalPages: number; onPageChange: (page: number) => void };

type Props = {
  title: string;
  toolbar?: ReactNode;
  pagination?: PaginationProps;
  children: ReactNode;
};

// Fixed width keeps the page label in place when a button is hidden.
const SLOT = "w-24";

function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const t = useTranslations("Common");

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4">
      {page > 1 ? (
        <Button variant="outline" className={SLOT} onClick={() => onPageChange(page - 1)}>
          {t("previous")}
        </Button>
      ) : (
        <span className={SLOT} aria-hidden />
      )}
      <span className="text-sm text-muted-foreground">{t("pageOf", { page, total: totalPages })}</span>
      {page < totalPages ? (
        <Button variant="outline" className={SLOT} onClick={() => onPageChange(page + 1)}>
          {t("next")}
        </Button>
      ) : (
        <span className={SLOT} aria-hidden />
      )}
    </div>
  );
}

// Shared shell of list pages: the content area takes the free height, so the pagination stays at the bottom.
export function ListPage({ title, toolbar, pagination, children }: Props) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {toolbar}
      {children}
      {pagination && <Pagination {...pagination} />}
    </div>
  );
}
