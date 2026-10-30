import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { LedgerEntry } from "../model/types";

type Props = {
  items: LedgerEntry[];
  isPending: boolean;
  isError: boolean;
  hasMore: boolean;
  isFetchingMore: boolean;
  onShowMore: () => void;
  onRetry: () => void;
};

// Browser zone for now; the teacher's zone from settings replaces it later.
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

function formatDelta(delta: number) {
  return delta > 0 ? `+${delta}` : String(delta);
}

export function LedgerHistory({ items, isPending, isError, hasMore, isFetchingMore, onShowMore, onRetry }: Props) {
  const t = useTranslations("Ledger");
  const format = useFormatter();
  const timeZone = browserTimeZone();

  if (isError) {
    return (
      <div role="alert" className="grid justify-items-start gap-2">
        <p className="text-sm text-muted-foreground">{t("loadHistoryError")}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("retry")}
        </Button>
      </div>
    );
  }
  if (isPending) return <Skeleton className="h-16 w-full" />;
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{t("historyEmpty")}</p>;

  return (
    <div className="grid gap-3">
      <ul className="grid gap-3">
        {items.map((entry) => (
          <li key={entry.id} className="grid grid-cols-[3rem_1fr] gap-x-3 text-sm">
            <Badge variant={entry.delta < 0 ? "neutral" : "success"}>{formatDelta(entry.delta)}</Badge>
            <div className="grid gap-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <span>{t(`type.${entry.type}`)}</span>
                <time dateTime={entry.createdAt} className="text-xs text-muted-foreground">
                  {format.dateTime(new Date(entry.createdAt), { dateStyle: "medium", timeStyle: "short", timeZone })}
                </time>
              </div>
              {entry.comment && <span className="whitespace-pre-wrap text-muted-foreground">{entry.comment}</span>}
              <span className="text-xs text-muted-foreground">{entry.createdBy ? (entry.createdBy.name ?? entry.createdBy.email) : t("system")}</span>
            </div>
          </li>
        ))}
      </ul>
      {hasMore && (
        <Button variant="outline" size="sm" className="justify-self-center" disabled={isFetchingMore} onClick={onShowMore}>
          {t("showMore")}
        </Button>
      )}
    </div>
  );
}
