import { useTranslations } from "next-intl";
import { PageMessage } from "@/components/page-message";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function PaymentsSkeleton() {
  return (
    <div aria-busy="true" className="grid content-start gap-3">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

// `centered` is for a whole page; the student panel keeps the compact left-aligned form.
export function PaymentsEmpty({ centered = false }: { centered?: boolean }) {
  const t = useTranslations("Payments");
  const text = <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  return centered ? <PageMessage>{text}</PageMessage> : text;
}

export function PaymentsError({ onRetry, centered = false }: { onRetry: () => void; centered?: boolean }) {
  const t = useTranslations("Payments");
  const body = (
    <>
      <p className="text-sm text-muted-foreground">{t("loadError")}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t("retry")}
      </Button>
    </>
  );
  return centered ? (
    <PageMessage role="alert">{body}</PageMessage>
  ) : (
    <div role="alert" className="grid justify-items-start gap-2">
      {body}
    </div>
  );
}
