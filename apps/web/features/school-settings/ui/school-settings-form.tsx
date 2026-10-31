"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SchoolSettings } from "../model/types";
import { schoolSettingsSchema, type SchoolSettingsFormValues } from "../model/school-settings-schema";
import { useUpdateSchoolSettings } from "../model/use-school-settings";

function toForm(settings: SchoolSettings): SchoolSettingsFormValues {
  return {
    lowBalanceThreshold: String(settings.lowBalanceThreshold),
    dayStartsAt: settings.dayStartsAt,
    eveningStartsAt: settings.eveningStartsAt,
    lateWindowMin: String(settings.lateWindowMin),
  };
}

export function SchoolSettingsForm({ settings }: { settings: SchoolSettings }) {
  const t = useTranslations("SchoolSettings");
  const update = useUpdateSchoolSettings();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid, isDirty },
  } = useForm<SchoolSettingsFormValues>({
    mode: "onChange",
    resolver: zodResolver(schoolSettingsSchema),
    defaultValues: toForm(settings),
  });

  async function submit(values: SchoolSettingsFormValues) {
    try {
      const saved = await update.mutateAsync({
        lowBalanceThreshold: Number(values.lowBalanceThreshold),
        dayStartsAt: values.dayStartsAt,
        eveningStartsAt: values.eveningStartsAt,
        lateWindowMin: Number(values.lateWindowMin),
      });
      reset(toForm(saved));
      toast.success(t("toastSaved"));
    } catch {
      toast.error(t("saveFailed"));
    }
  }

  const eveningError = errors.eveningStartsAt && (errors.eveningStartsAt.message === "order" ? t("errOrder") : t("errTime"));

  return (
    <form className="grid max-w-sm gap-4" noValidate onSubmit={handleSubmit(submit)}>
      <div className="grid gap-2">
        <Label htmlFor="lowBalanceThreshold">{t("fieldThreshold")}</Label>
        <Input
          id="lowBalanceThreshold"
          type="number"
          min={0}
          max={100}
          step={1}
          autoComplete="off"
          aria-invalid={!!errors.lowBalanceThreshold}
          {...register("lowBalanceThreshold")}
        />
        <p className="text-sm text-muted-foreground">{t("thresholdHint")}</p>
        {errors.lowBalanceThreshold && <p className="text-sm text-destructive">{t("errThreshold")}</p>}
      </div>

      <h2 className="mt-2 text-base font-semibold">{t("cancellationTitle")}</h2>
      <p className="text-sm text-muted-foreground">{t("cancellationHint")}</p>
      <div className="grid gap-2">
        <Label htmlFor="dayStartsAt">{t("fieldDayStartsAt")}</Label>
        <Input id="dayStartsAt" type="time" aria-invalid={!!errors.dayStartsAt} {...register("dayStartsAt", { deps: ["eveningStartsAt"] })} />
        {errors.dayStartsAt && <p className="text-sm text-destructive">{t("errTime")}</p>}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="eveningStartsAt">{t("fieldEveningStartsAt")}</Label>
        <Input id="eveningStartsAt" type="time" aria-invalid={!!errors.eveningStartsAt} {...register("eveningStartsAt")} />
        {eveningError && <p className="text-sm text-destructive">{eveningError}</p>}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="lateWindowMin">{t("fieldLateWindow")}</Label>
        <Input
          id="lateWindowMin"
          type="number"
          min={0}
          max={1440}
          step={1}
          autoComplete="off"
          aria-invalid={!!errors.lateWindowMin}
          {...register("lateWindowMin")}
        />
        {errors.lateWindowMin && <p className="text-sm text-destructive">{t("errLateWindow")}</p>}
      </div>

      <div>
        <Button type="submit" disabled={isSubmitting || !isValid || !isDirty}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
