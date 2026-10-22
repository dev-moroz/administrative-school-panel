import { useTranslations } from "next-intl";

export default function DashboardPage() {
  const t = useTranslations("Home");

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground">{t("subtitle")}</p>
    </div>
  );
}
