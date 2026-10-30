"use client";

import { useTranslations } from "next-intl";
import { ListPage } from "@/components/list-page";
import { PageMessage } from "@/components/page-message";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSchoolSettings } from "@/features/school-settings/model/use-school-settings";
import { SchoolSettingsForm } from "@/features/school-settings/ui/school-settings-form";

export default function SchoolSettingsPage() {
  const t = useTranslations("SchoolSettings");
  const settings = useSchoolSettings();

  function content() {
    if (settings.isError) {
      return (
        <PageMessage role="alert">
          <p className="text-sm text-muted-foreground">{t("loadError")}</p>
          <Button variant="outline" size="sm" onClick={() => settings.refetch()}>
            {t("retry")}
          </Button>
        </PageMessage>
      );
    }
    if (settings.isPending) {
      return (
        <div aria-busy="true" className="grid max-w-sm gap-3">
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }
    return <SchoolSettingsForm settings={settings.data} />;
  }

  return <ListPage title={t("title")}>{content()}</ListPage>;
}
